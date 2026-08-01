from modules.util.enum.FileType import FileType
from modules.util.enum.ImageFormat import ImageFormat
from modules.util.enum.VideoFormat import VideoFormat
from modules.webui import runtime_patches
from modules.webui.runtime_patches import install_runtime_patches

from PIL import Image


def test_save_sampler_output_signature_is_what_we_patch():
    # Guards against upstream changing the seam the patch depends on. Checked
    # against the pristine original (captured at install time) rather than
    # BaseModelSampler.save_sampler_output directly, since by the time this
    # runs in the full suite an earlier test module may have already
    # installed the patches, at which point that attribute is our own
    # `patched` wrapper -- whose signature is hard-coded to these names and
    # so can never fail this assertion.
    import inspect

    install_runtime_patches()

    params = list(inspect.signature(runtime_patches._original_save_sampler_output).parameters)
    assert params == [
        "sampler_output",
        "destination",
        "image_format",
        "video_format",
        "audio_format",
        "fps",
    ]


def test_patch_records_image_filepath(tmp_path):
    from modules.modelSampler.BaseModelSampler import BaseModelSampler, ModelSamplerOutput

    install_runtime_patches()

    output = ModelSamplerOutput(FileType.IMAGE, Image.new("RGB", (4, 4)))
    destination = str(tmp_path / "sample")
    BaseModelSampler.save_sampler_output(
        output, destination, ImageFormat.PNG, VideoFormat.MP4, None
    )

    assert output.filepath == destination + ImageFormat.PNG.extension()
    assert (tmp_path / f"sample{ImageFormat.PNG.extension()}").is_file()


def test_patch_is_idempotent(tmp_path):
    from modules.modelSampler.BaseModelSampler import BaseModelSampler, ModelSamplerOutput

    install_runtime_patches()
    first = BaseModelSampler.save_sampler_output
    install_runtime_patches()
    assert BaseModelSampler.save_sampler_output is first

    output = ModelSamplerOutput(FileType.IMAGE, Image.new("RGB", (4, 4)))
    destination = str(tmp_path / "again")
    BaseModelSampler.save_sampler_output(
        output, destination, ImageFormat.PNG, VideoFormat.MP4, None
    )
    assert output.filepath == destination + ImageFormat.PNG.extension()


def _record_scalars(tags_and_values):
    """Drive the patched add_scalar with a fake service and return the rows."""
    from modules.webui import training as training_module

    from torch.utils.tensorboard import SummaryWriter

    install_runtime_patches()

    recorded = []

    class FakeService:
        _step = 7
        _epoch = 2

        def record_metric(self, payload):
            recorded.append(payload)

    previous = training_module._active_training_service
    training_module._active_training_service = FakeService()
    try:
        for tag, value, step in tags_and_values:
            SummaryWriter.add_scalar(object(), tag, value, step)
    finally:
        training_module._active_training_service = previous

    return recorded


def test_metrics_are_recorded_exactly_once_per_scalar():
    # Regression test: training.py previously patched SummaryWriter.add_scalar
    # twice (module level plus once per run), so run N recorded N+1 points.
    recorded = _record_scalars([("loss/train_step", 0.5, 7)])

    assert len(recorded) == 1
    assert recorded[0]["loss_train_step"] == 0.5
    assert recorded[0]["step"] == 7
    assert recorded[0]["epoch"] == 2


def test_distinct_loss_tags_do_not_collapse_onto_one_key():
    # Regression: `if "loss" in tag_lower` merged raw loss, the trainer's own
    # smoothed loss, and validation loss into a single `loss` key, so the chart
    # plotted three unrelated series as one zigzagging line.
    recorded = _record_scalars([
        ("loss/train_step", 0.5, 7),
        ("smooth_loss/train_step", 0.52, 7),
        ("loss/validation_step/total_average", 0.61, 7),
    ])

    assert recorded[0]["loss_train_step"] == 0.5
    assert recorded[1]["smooth_loss_train_step"] == 0.52
    assert recorded[2]["loss_validation_step_total_average"] == 0.61
    assert all("loss" not in row for row in recorded)


def test_distinct_lr_tags_do_not_collapse_onto_one_key():
    # Regression: every `lr/<param_group>` wrote into a single `lr` key, so a
    # run with a separately-tuned text encoder rendered as a zigzag.
    recorded = _record_scalars([
        ("lr/unet", 1e-4, 7),
        ("lr/text_encoder", 3e-6, 7),
    ])

    assert recorded[0]["lr_unet"] == 1e-4
    assert recorded[1]["lr_text_encoder"] == 3e-6
    assert all("lr" not in row for row in recorded)
