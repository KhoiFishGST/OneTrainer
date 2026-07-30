import contextlib
import threading

# The web UI needs two behaviours that core OneTrainer does not provide:
#   1. the on-disk path of each written sample, for the gallery
#   2. real-time loss/lr metrics, for the training chart
# Both are installed here as runtime patches so no core file is modified.

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

    def patched(writer_self, tag, scalar_value, global_step=None, walltime=None):
        with contextlib.suppress(Exception):
            original(writer_self, tag, scalar_value, global_step, walltime)

        from modules.webui import training as training_module

        service = training_module._active_training_service
        if service is None:
            return

        try:
            tag_lower = tag.lower()
            value = float(scalar_value)
            payload = {
                "step": global_step if global_step is not None else service._step,
                "epoch": service._epoch,
                tag.replace("/", "_"): value,
            }
            if "loss" in tag_lower:
                payload["loss"] = value
            if "lr" in tag_lower or "learning_rate" in tag_lower:
                payload["lr"] = value
            service.record_metric(payload)
        except Exception:
            pass

    SummaryWriter.add_scalar = patched
