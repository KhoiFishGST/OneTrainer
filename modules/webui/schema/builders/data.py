from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_data_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
        "data",
        "Data",
        (
            Group(
                "caching",
                "Data & Caching",
                (
                    Field(
                        "datasets-dir",
                        ("datasets_dir",),
                        "Datasets Directory",
                        "Base directory path for training datasets.",
                        "directory",
                        path_mode="directory",
                    ),
                    Field(
                        "aspect-ratio",
                        ("aspect_ratio_bucketing",),
                        "Aspect Ratio Bucketing",
                        "Aspect ratio bucketing enables training on images with different aspect ratios",
                        "toggle",
                    ),
                    Field(
                        "latent-caching",
                        ("latent_caching",),
                        "Latent Caching",
                        "Caching of intermediate training data that can be re-used between epochs",
                        "toggle",
                    ),
                    Field(
                        "clear-cache",
                        ("clear_cache_before_training",),
                        "Clear cache before training",
                        "Clears the cache directory before starting to train. Only disable this if you want to continue using the same cached data. Disabling this can lead to errors, if other settings are changed during a restart",
                        "toggle",
                    ),
                ),
            ),
        ),
    )
