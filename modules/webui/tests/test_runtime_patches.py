from modules.util.enum.FileType import FileType
from modules.util.enum.ImageFormat import ImageFormat
from modules.util.enum.VideoFormat import VideoFormat
from modules.webui.runtime_patches import install_runtime_patches

from PIL import Image


def test_save_sampler_output_signature_is_what_we_patch():
    # Guards against upstream changing the seam the patch depends on.
    import inspect

    from modules.modelSampler.BaseModelSampler import BaseModelSampler

    params = list(inspect.signature(BaseModelSampler.save_sampler_output).parameters)
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


def test_metrics_are_recorded_exactly_once_per_scalar():
    # Regression test: training.py previously patched SummaryWriter.add_scalar
    # twice (module level plus once per run), so run N recorded N+1 points.
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
        SummaryWriter.add_scalar(object(), "loss/train", 0.5, 7)
    finally:
        training_module._active_training_service = previous

    assert len(recorded) == 1
    assert recorded[0]["loss"] == 0.5
    assert recorded[0]["step"] == 7
    assert recorded[0]["epoch"] == 2
