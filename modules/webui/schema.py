from dataclasses import dataclass
from enum import Enum

from modules.ui.TopBarController import TopBarController
from modules.util.config.TrainConfig import TrainConfig
from modules.util.enum.GradientReducePrecision import GradientReducePrecision
from modules.util.enum.ModelType import ModelType
from modules.util.enum.TimeUnit import TimeUnit
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.util.type_util import issubclass_safe


@dataclass(frozen=True)
class Option:
    value: str
    label: str

    def to_dict(self) -> dict[str, object]:
        return {"value": self.value, "label": self.label}


@dataclass(frozen=True)
class Field:
    id: str
    keys: tuple[str, ...]
    label: str
    tooltip: str
    control: str
    path_mode: str | None = None
    required: bool = False

    def to_dict(self, config_template: TrainConfig) -> dict[str, object]:
        nullable = any(config_template.nullables.get(k, False) for k in self.keys)

        if len(self.keys) == 1:
            raw_val = getattr(config_template, self.keys[0], None)
            default_val = raw_val.value if isinstance(raw_val, Enum) else raw_val
        else:
            default_val = []
            for k in self.keys:
                raw_val = getattr(config_template, k, None)
                default_val.append(raw_val.value if isinstance(raw_val, Enum) else raw_val)

        options = None
        key_type = config_template.types.get(self.keys[0])
        if issubclass_safe(key_type, Enum):
            options = [{"value": e.value, "label": e.value} for e in key_type]

        res: dict[str, object] = {
            "id": self.id,
            "keys": list(self.keys),
            "label": self.label,
            "tooltip": self.tooltip,
            "control": self.control,
            "required": self.required,
            "nullable": nullable,
            "default": default_val,
        }
        if self.path_mode is not None:
            res["path_mode"] = self.path_mode
        if options is not None:
            res["options"] = options
        return res


@dataclass(frozen=True)
class Group:
    id: str
    label: str
    fields: tuple[Field, ...]

    def to_dict(self, config_template: TrainConfig) -> dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "fields": [field.to_dict(config_template) for field in self.fields],
        }


@dataclass(frozen=True)
class Tab:
    id: str
    label: str
    groups: tuple[Group, ...]

    def to_dict(self, config_template: TrainConfig) -> dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "groups": [group.to_dict(config_template) for group in self.groups],
        }


PHASE_A_KEYS = {
    "workspace_dir",
    "cache_dir",
    "continue_last_backup",
    "only_cache",
    "prevent_overwrites",
    "debug_mode",
    "debug_dir",
    "tensorboard",
    "tensorboard_always_on",
    "tensorboard_expose",
    "tensorboard_port",
    "validation",
    "validate_after",
    "validate_after_unit",
    "dataloader_threads",
    "train_device",
    "async_offloading",
    "multi_gpu",
    "device_indexes",
    "gradient_reduce_precision",
    "fused_gradient_reduce",
    "async_gradient_reduce",
    "async_gradient_reduce_buffer",
    "temp_device",
    "aspect_ratio_bucketing",
    "latent_caching",
    "clear_cache_before_training",
    "backup_after",
    "backup_after_unit",
    "rolling_backup",
    "rolling_backup_count",
    "backup_before_save",
    "save_every",
    "save_every_unit",
    "save_skip_first",
    "save_filename_prefix",
}

TABS = (
    Tab(
        "general",
        "General",
        (
            Group(
                "workspace",
                "Workspace",
                (
                    Field(
                        "workspace-dir",
                        ("workspace_dir",),
                        "Workspace Directory",
                        "The directory where all files of this training run are saved",
                        "directory",
                        path_mode="directory",
                    ),
                    Field(
                        "cache-dir",
                        ("cache_dir",),
                        "Cache Directory",
                        "The directory where cached data is saved",
                        "directory",
                        path_mode="directory",
                    ),
                    Field(
                        "continue-backup",
                        ("continue_last_backup",),
                        "Continue from last backup",
                        "Automatically continues training from the last backup saved in <workspace>/backup",
                        "toggle",
                    ),
                    Field(
                        "only-cache",
                        ("only_cache",),
                        "Only Cache",
                        "Only populate the cache, without any training",
                        "toggle",
                    ),
                    Field(
                        "prevent-overwrites",
                        ("prevent_overwrites",),
                        "Prevent Overwrites",
                        "When enabled, output paths that already exist on disk will be flagged as invalid to avoid accidental overwrites",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "debug",
                "Debug",
                (
                    Field(
                        "debug-mode",
                        ("debug_mode",),
                        "Debug mode",
                        "Save debug information during the training into the debug directory",
                        "toggle",
                    ),
                    Field(
                        "debug-dir",
                        ("debug_dir",),
                        "Debug Directory",
                        "The directory where debug data is saved",
                        "directory",
                        path_mode="directory",
                    ),
                ),
            ),
            Group(
                "tensorboard",
                "TensorBoard",
                (
                    Field(
                        "tensorboard",
                        ("tensorboard",),
                        "Tensorboard",
                        "Starts the Tensorboard Web UI during training",
                        "toggle",
                    ),
                    Field(
                        "tensorboard-always",
                        ("tensorboard_always_on",),
                        "Always-On Tensorboard",
                        "Keep Tensorboard accessible even when not training. Useful for monitoring completed training sessions.",
                        "toggle",
                    ),
                    Field(
                        "tensorboard-expose",
                        ("tensorboard_expose",),
                        "Expose Tensorboard",
                        "Exposes Tensorboard Web UI to all network interfaces (makes it accessible from the network)",
                        "toggle",
                    ),
                    Field(
                        "tensorboard-port",
                        ("tensorboard_port",),
                        "Tensorboard Port",
                        "Port to use for Tensorboard link",
                        "number",
                    ),
                ),
            ),
            Group(
                "validation",
                "Validation",
                (
                    Field(
                        "validation",
                        ("validation",),
                        "Validation",
                        "Enable validation steps and add new graph in tensorboard",
                        "toggle",
                    ),
                    Field(
                        "validate-after",
                        ("validate_after", "validate_after_unit"),
                        "Validate after",
                        "The interval used when validate training",
                        "time",
                    ),
                ),
            ),
            Group(
                "devices",
                "Devices",
                (
                    Field(
                        "dataloader-threads",
                        ("dataloader_threads",),
                        "Dataloader Threads",
                        "Number of threads used for the data loader. Increase if your GPU has room during caching, decrease if it's going out of memory during caching.",
                        "number",
                        required=True,
                    ),
                    Field(
                        "train-device",
                        ("train_device",),
                        "Train Device",
                        'The device used for training. Can be "cuda", "cuda:0", "cuda:1" etc. Default:"cuda". Must be "cuda" for multi-GPU training.',
                        "text",
                        required=True,
                    ),
                    Field(
                        "async-offloading",
                        ("async_offloading",),
                        "Async Offloading",
                        "Overlaps CPU<->GPU transfers with computation using CUDA streams. Applies to every offloaded component",
                        "toggle",
                    ),
                    Field(
                        "multi-gpu",
                        ("multi_gpu",),
                        "Multi-GPU",
                        "Enable multi-GPU training",
                        "toggle",
                    ),
                    Field(
                        "device-indexes",
                        ("device_indexes",),
                        "Device Indexes",
                        'Multi-GPU: A comma-separated list of device indexes. If empty, all your GPUs are used. With a list such as "0,1,3,4" you can omit a GPU, for example an on-board graphics GPU.',
                        "text",
                    ),
                    Field(
                        "gradient-reduce-precision",
                        ("gradient_reduce_precision",),
                        "Gradient Reduce Precision",
                        "WEIGHT_DTYPE: Reduce gradients between GPUs in your weight data type; can be imprecise, but more efficient than float32\nWEIGHT_DTYPE_STOCHASTIC: Sum up the gradients in your weight data type, but average them in float32 and stochastically round if your weight data type is bfloat16\nFLOAT_32: Reduce gradients in float32\nFLOAT_32_STOCHASTIC: Reduce gradients in float32; use stochastic rounding to bfloat16 if your weight data type is bfloat16",
                        "select",
                    ),
                    Field(
                        "fused-gradient-reduce",
                        ("fused_gradient_reduce",),
                        "Fused Gradient Reduce",
                        "Multi-GPU: Gradient synchronisation during the backward pass. Can be more efficient, especially with Async Gradient Reduce",
                        "toggle",
                    ),
                    Field(
                        "async-gradient-reduce",
                        ("async_gradient_reduce",),
                        "Async Gradient Reduce",
                        "Multi-GPU: Asynchroniously start the gradient reduce operations during the backward pass. Can be more efficient, but requires some VRAM.",
                        "toggle",
                    ),
                    Field(
                        "async-gradient-buffer",
                        ("async_gradient_reduce_buffer",),
                        "Buffer size (MB)",
                        'Multi-GPU: Maximum VRAM for "Async Gradient Reduce", in megabytes. A multiple of this value can be needed if combined with "Fused Back Pass" and/or "Layer offload fraction"',
                        "number",
                    ),
                    Field(
                        "temp-device",
                        ("temp_device",),
                        "Temp Device",
                        'The device used to temporarily offload models while they are not used. Default:"cpu"',
                        "text",
                    ),
                ),
            ),
        ),
    ),
    Tab(
        "data",
        "Data",
        (
            Group(
                "caching",
                "Data and caching",
                (
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
    ),
    Tab(
        "backup",
        "Backup",
        (
            Group(
                "backup",
                "Backup and save",
                (
                    Field(
                        "backup-after",
                        ("backup_after", "backup_after_unit"),
                        "Backup After",
                        "The interval used when automatically creating model backups during training",
                        "time",
                    ),
                    Field(
                        "rolling-backup",
                        ("rolling_backup",),
                        "Rolling Backup",
                        "If rolling backups are enabled, older backups are deleted automatically",
                        "toggle",
                    ),
                    Field(
                        "rolling-count",
                        ("rolling_backup_count",),
                        "Rolling Backup Count",
                        "Defines the number of backups to keep if rolling backups are enabled",
                        "number",
                    ),
                    Field(
                        "backup-before-save",
                        ("backup_before_save",),
                        "Backup Before Save",
                        "Create a full backup before saving the final model",
                        "toggle",
                    ),
                    Field(
                        "save-every",
                        ("save_every", "save_every_unit"),
                        "Save Every",
                        "The interval used when automatically saving the model during training",
                        "time",
                    ),
                    Field(
                        "save-skip-first",
                        ("save_skip_first",),
                        "Skip First",
                        "Start saving automatically after this interval has elapsed",
                        "number",
                    ),
                    Field(
                        "save-prefix",
                        ("save_filename_prefix",),
                        "Save Filename Prefix",
                        "The prefix for filenames used when saving the model during training",
                        "text",
                    ),
                ),
            ),
        ),
    ),
)


class SchemaRegistry:
    def build(self, model_type: str, training_method: str) -> dict[str, object]:
        try:
            model_type_enum = ModelType(model_type)
            training_method_enum = TrainingMethod(training_method)
        except ValueError as error:
            raise ValueError(f"Training method is not supported: {error}") from error

        if training_method_enum not in model_type_enum.supported_training_methods():
            raise ValueError(f"Training method is not supported for model type {model_type}")

        config_template = TrainConfig.default_values()
        return {
            "model_type": model_type_enum.value,
            "training_method": training_method_enum.value,
            "tabs": [tab.to_dict(config_template) for tab in TABS],
        }

    def meta(self) -> dict[str, object]:
        controller = TopBarController(TrainConfig.default_values())
        model_types = []
        for label, model_type_enum in controller.get_model_types():
            methods = [
                {"value": method_enum.value, "label": method_label}
                for method_label, method_enum in controller.get_training_methods(model_type_enum)
            ]
            model_types.append(
                {
                    "value": model_type_enum.value,
                    "label": label,
                    "training_methods": methods,
                }
            )

        enums = {
            "TimeUnit": [e.value for e in TimeUnit],
            "GradientReducePrecision": [e.value for e in GradientReducePrecision],
            "ModelType": [e.value for e in ModelType],
            "TrainingMethod": [e.value for e in TrainingMethod],
        }

        return {
            "model_types": model_types,
            "enums": enums,
        }
