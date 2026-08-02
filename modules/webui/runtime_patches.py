import contextlib
import logging
import threading

# The web UI needs three behaviours that core OneTrainer does not provide:
#   1. the on-disk path of each written sample, for the gallery
#   2. real-time loss/lr metrics, for the training chart
#   3. notification of each written checkpoint, for downloads
# All are installed here as runtime patches so no core file is modified.
#
# The patches are process-lifetime: they are installed exactly once, on the
# first call, and are never removed. Installation happens only from
# create_app(), so the desktop UI -- which imports the same modules -- runs
# unpatched. There is intentionally no uninstall_runtime_patches(): unwinding a
# monkeypatch mid-process would race with in-flight training threads, and the
# web UI server has no lifecycle stage at which reverting would be correct.

_installed = False
_install_lock = threading.Lock()

# The pristine, unwrapped save_sampler_output, captured the first (and only)
# time the patch is installed. Kept around so tests can assert against the
# real upstream signature even after the patch has already been applied by
# an earlier test module.
_original_save_sampler_output = None


def install_runtime_patches() -> None:
    global _installed
    if _installed:
        return
    with _install_lock:
        if _installed:
            return
        _patch_sampler_output()
        _patch_summary_writer()
        _patch_model_saver()
        _installed = True


def _patch_sampler_output() -> None:
    # save_sampler_output is the single point every concrete sampler writes
    # through, and each one calls it before invoking on_sample, so filepath is
    # populated by the time the web UI callback runs.
    global _original_save_sampler_output

    from modules.modelSampler.BaseModelSampler import BaseModelSampler
    from modules.util.enum.FileType import FileType

    original = BaseModelSampler.__dict__["save_sampler_output"].__func__
    _original_save_sampler_output = original

    def patched(
        sampler_output,
        destination,
        image_format,
        video_format,
        audio_format,
        fps: int = 24,
    ):
        result = original(
            sampler_output, destination, image_format, video_format, audio_format, fps
        )
        with contextlib.suppress(Exception):
            if sampler_output.file_type == FileType.IMAGE and image_format is not None:
                sampler_output.filepath = destination + image_format.extension()
            elif sampler_output.file_type == FileType.VIDEO and video_format is not None:
                sampler_output.filepath = destination + video_format.extension()
        return result

    BaseModelSampler.save_sampler_output = staticmethod(patched)


def _patch_summary_writer() -> None:
    try:
        from torch.utils.tensorboard import SummaryWriter
    except Exception:
        return

    original = SummaryWriter.add_scalar

    def patched(writer_self, tag, scalar_value, *args, **kwargs):
        # *args/**kwargs passthrough so the wrapper never narrows torch's real
        # signature (which also takes new_style / double_precision).
        with contextlib.suppress(Exception):
            original(writer_self, tag, scalar_value, *args, **kwargs)

        # global_step is the first optional parameter, so it may arrive
        # positionally or by keyword.
        global_step = args[0] if args else kwargs.get("global_step")

        from modules.webui import training as training_module

        service = training_module._active_training_service
        if service is None:
            return

        try:
            # Keep only the faithful, namespaced key. The old collapsed `loss`
            # and `lr` aliases used substring matching, so every loss-family tag
            # (loss/train_step, smooth_loss/train_step, loss/validation_step/*)
            # and every lr/<param_group> overwrote a single key -- and since each
            # scalar is recorded as its own row, the chart drew several unrelated
            # series as one interleaved line. Consumers discover keys by prefix.
            payload = {
                "step": global_step if global_step is not None else service._step,
                "epoch": service._epoch,
                tag.replace("/", "_"): float(scalar_value),
            }
            service.record_metric(payload)
        except Exception:
            pass

    SummaryWriter.add_scalar = patched


def _patch_model_saver() -> None:
    # BaseModelSaver.save is abstract and every concrete saver overrides it, so
    # the base class intercepts nothing. Construction is the single chokepoint:
    # BaseTrainer.create_model_saver (:73-74) calls create.create_model_saver as
    # a module attribute -- resolved at call time -- and GenericTrainer routes
    # backup (:449), save (:500) and the final model (:870) through the one
    # instance it stores (:151).
    #
    # Guarded because this import reaches the whole training dependency graph --
    # dataloaders, every model class, LoRAModule, diffusers. install_runtime_patches()
    # runs from create_app(), so an unguarded failure anywhere in there would stop
    # the web UI from starting at all rather than just leaving Downloads empty.
    try:
        from modules.util import create as create_module
    except Exception:
        logging.exception("Checkpoint capture disabled: could not import the model saver factory")
        return

    original_factory = create_module.create_model_saver

    def patched_factory(*args, **kwargs):
        saver = original_factory(*args, **kwargs)
        if saver is None:
            return None

        def wrapped_save(*save_args, **save_kwargs):
            result = type(saver).save(saver, *save_args, **save_kwargs)

            # Capture only after the real write returned, so a recorded
            # checkpoint always exists on disk.
            with contextlib.suppress(Exception):
                store = _active_checkpoint_store()
                if store is not None:
                    model_format = save_kwargs.get(
                        "output_model_format",
                        save_args[2] if len(save_args) > 2 else None,
                    )
                    destination = save_kwargs.get(
                        "output_model_destination",
                        save_args[3] if len(save_args) > 3 else None,
                    )
                    if model_format is not None and destination is not None:
                        store.capture(model_format, str(destination))

            return result

        # An instance attribute shadows the class method under the normal
        # attribute lookup that `self.model_saver.save(...)` performs.
        saver.save = wrapped_save
        return saver

    create_module.create_model_saver = patched_factory


def _active_checkpoint_store():
    from modules.webui import training as training_module

    service = training_module._active_training_service
    if service is None:
        return None
    return getattr(service, "_checkpoint_store", None)

