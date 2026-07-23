from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_sampling_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
        "sampling",
        "Sampling",
        (
            Group(
                "sampling_settings",
                "Sample Settings",
                (
                    Field(
                        "sample-def-filename",
                        ("sample_definition_file_name",),
                        "Sample Definition Filename",
                        "File path for sample definitions JSON",
                        "file",
                        path_mode="file",
                    ),
                    Field(
                        "samples",
                        ("samples",),
                        "Samples Config",
                        "Inline list of sample configurations",
                        "text",
                    ),
                    Field(
                        "sample-after",
                        ("sample_after", "sample_after_unit"),
                        "Sample After",
                        "Interval for generating preview samples",
                        "time",
                    ),
                    Field(
                        "sample-skip-first",
                        ("sample_skip_first",),
                        "Sample Skip First",
                        "Skip preview sampling for initial steps/epochs",
                        "number",
                    ),
                    Field(
                        "sample-image-format",
                        ("sample_image_format",),
                        "Sample Image Format",
                        "File format for saved sample images",
                        "select",
                    ),
                    Field(
                        "sample-video-format",
                        ("sample_video_format",),
                        "Sample Video Format",
                        "File format for saved sample videos",
                        "select",
                    ),
                    Field(
                        "sample-audio-format",
                        ("sample_audio_format",),
                        "Sample Audio Format",
                        "File format for saved sample audio",
                        "select",
                    ),
                    Field(
                        "samples-to-tensorboard",
                        ("samples_to_tensorboard",),
                        "Samples To TensorBoard",
                        "Log sample previews into TensorBoard",
                        "toggle",
                    ),
                    Field(
                        "non-ema-sampling",
                        ("non_ema_sampling",),
                        "Non-EMA Sampling",
                        "Generate sample previews using base model without EMA",
                        "toggle",
                    ),
                ),
            ),
        ),
    )
