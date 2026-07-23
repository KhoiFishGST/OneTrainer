from dataclasses import dataclass
from enum import Enum

from modules.ui.TopBarController import TopBarController
from modules.util.config.BaseConfig import BaseConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.enum.AttentionMechanism import AttentionMechanism
from modules.util.enum.ConfigPart import ConfigPart
from modules.util.enum.DataType import DataType
from modules.util.enum.EMAMode import EMAMode
from modules.util.enum.GradientReducePrecision import GradientReducePrecision
from modules.util.enum.ImageFormat import ImageFormat
from modules.util.enum.LearningRateScaler import LearningRateScaler
from modules.util.enum.LearningRateScheduler import LearningRateScheduler
from modules.util.enum.LossScaler import LossScaler
from modules.util.enum.LossWeight import LossWeight
from modules.util.enum.ModelFormat import ModelFormat
from modules.util.enum.ModelType import ModelType, PeftType
from modules.util.enum.Optimizer import Optimizer
from modules.util.enum.TimestepDistribution import TimestepDistribution
from modules.util.enum.TimeUnit import TimeUnit
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.util.enum.VideoFormat import VideoFormat
from modules.util.type_util import issubclass_safe


def serialize_val(val: object) -> object:
    if isinstance(val, Enum):
        return val.value
    if isinstance(val, BaseConfig):
        return val.to_dict()
    if isinstance(val, list):
        return [serialize_val(x) for x in val]
    if isinstance(val, dict):
        return {k: serialize_val(v) for k, v in val.items()}
    return val


def getattr_nested(obj: object, path: str) -> object:
    curr = obj
    for part in path.split("."):
        if curr is None:
            return None
        if isinstance(curr, dict):
            curr = curr.get(part)
        else:
            curr = getattr(curr, part, None)
    return curr


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
        first_key = self.keys[0]
        nullable = any(config_template.nullables.get(k, False) for k in self.keys)

        if len(self.keys) == 1:
            raw_val = getattr_nested(config_template, first_key)
            default_val = serialize_val(raw_val)
        else:
            default_val = []
            for k in self.keys:
                raw_val = getattr_nested(config_template, k)
                default_val.append(serialize_val(raw_val))

        options = None
        key_type = None
        parts = first_key.split(".")
        if len(parts) == 2 and parts[0] in config_template.types:
            sub_cls = config_template.types[parts[0]]
            if hasattr(sub_cls, "default_values"):
                sub_defaults = sub_cls.default_values()
                key_type = sub_defaults.types.get(parts[1])
        else:
            key_type = config_template.types.get(first_key)

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

OPTIMIZER_SUB_SCHEMAS = {
    "AdamW": {
        "beta1": {"type": "float", "default": 0.9, "label": "Beta 1", "tooltip": "Exponential decay rate for first moment estimates"},
        "beta2": {"type": "float", "default": 0.999, "label": "Beta 2", "tooltip": "Exponential decay rate for second moment estimates"},
        "eps": {"type": "float", "default": 1e-8, "label": "Epsilon", "tooltip": "Small constant for numerical stability"},
        "weight_decay": {"type": "float", "default": 0.01, "label": "Weight Decay", "tooltip": "Weight decay regularization factor"},
        "amsgrad": {"type": "bool", "default": False, "label": "AMSGrad", "tooltip": "Whether to use AMSGrad variant"},
    },
    "Prodigy": {
        "beta1": {"type": "float", "default": 0.9, "label": "Beta 1", "tooltip": "Exponential decay rate for first moment estimates"},
        "beta2": {"type": "float", "default": 0.999, "label": "Beta 2", "tooltip": "Exponential decay rate for second moment estimates"},
        "beta3": {"type": "float", "default": None, "label": "Beta 3", "tooltip": "Prodigy step size coefficient"},
        "d0": {"type": "float", "default": 1e-6, "label": "Initial D", "tooltip": "Initial D estimate for D-adaptation"},
        "d_coef": {"type": "float", "default": 1.0, "label": "D Coefficient", "tooltip": "Coefficient for estimate of D"},
        "weight_decay": {"type": "float", "default": 0.0, "label": "Weight Decay", "tooltip": "Weight decay regularization factor"},
        "decouple": {"type": "bool", "default": True, "label": "Decouple", "tooltip": "Use AdamW style decoupled weight decay"},
        "use_bias_correction": {"type": "bool", "default": False, "label": "Bias Correction", "tooltip": "Use bias correction"},
        "safeguard_warmup": {"type": "bool", "default": False, "label": "Safeguard Warmup", "tooltip": "Safeguard warmup stage"},
        "slice_p": {"type": "int", "default": 11, "label": "Slice Parameters", "tooltip": "Slice parameter reduction factor"},
    },
    "CAME": {
        "beta1": {"type": "float", "default": 0.9, "label": "Beta 1", "tooltip": "Exponential decay rate for first moment estimates"},
        "beta2": {"type": "float", "default": 0.999, "label": "Beta 2", "tooltip": "Exponential decay rate for second moment estimates"},
        "beta3": {"type": "float", "default": 0.9999, "label": "Beta 3", "tooltip": "Exponential decay rate for third moment estimates"},
        "eps": {"type": "float", "default": 1e-30, "label": "Epsilon 1", "tooltip": "First small constant for numerical stability"},
        "eps2": {"type": "float", "default": 1e-16, "label": "Epsilon 2", "tooltip": "Second small constant for numerical stability"},
        "weight_decay": {"type": "float", "default": 0.01, "label": "Weight Decay", "tooltip": "Weight decay regularization factor"},
    },
    "ADAM_8BIT": {
        "beta1": {"type": "float", "default": 0.9, "label": "Beta 1", "tooltip": "Exponential decay rate for first moment estimates"},
        "beta2": {"type": "float", "default": 0.999, "label": "Beta 2", "tooltip": "Exponential decay rate for second moment estimates"},
        "eps": {"type": "float", "default": 1e-8, "label": "Epsilon", "tooltip": "Small constant for numerical stability"},
        "weight_decay": {"type": "float", "default": 0.0, "label": "Weight Decay", "tooltip": "Weight decay regularization factor"},
        "block_wise": {"type": "bool", "default": True, "label": "Block Wise", "tooltip": "Perform block-wise 8-bit quantization"},
        "min_8bit_size": {"type": "int", "default": 4096, "label": "Min 8-bit Size", "tooltip": "Minimum tensor size for 8-bit quantization"},
    },
    "Adafactor": {
        "eps": {"type": "float", "default": 1e-30, "label": "Epsilon 1", "tooltip": "First epsilon value"},
        "eps2": {"type": "float", "default": 1e-3, "label": "Epsilon 2", "tooltip": "Second epsilon value"},
        "clip_threshold": {"type": "float", "default": 1.0, "label": "Clip Threshold", "tooltip": "Clipping threshold for update RMS"},
        "decay_rate": {"type": "float", "default": -0.8, "label": "Decay Rate", "tooltip": "Decay rate coefficient"},
        "beta1": {"type": "float", "default": None, "label": "Beta 1", "tooltip": "Beta 1 factor"},
        "weight_decay": {"type": "float", "default": 0.0, "label": "Weight Decay", "tooltip": "Weight decay regularization factor"},
        "scale_parameter": {"type": "bool", "default": False, "label": "Scale Parameter", "tooltip": "Scale learning rate by root mean square of parameter"},
        "relative_step": {"type": "bool", "default": False, "label": "Relative Step", "tooltip": "Use relative step size"},
        "warmup_init": {"type": "bool", "default": False, "label": "Warmup Initialization", "tooltip": "Warmup initialization"},
    },
}

SCHEDULER_SUB_SCHEMAS = {
    "Cosine": {
        "learning_rate_cycles": {"type": "float", "default": 0.5, "label": "Cycles", "tooltip": "Number of cosine cycles"},
        "learning_rate_min_factor": {"type": "float", "default": 0.0, "label": "Min LR Factor", "tooltip": "Minimum learning rate multiplier factor"},
        "learning_rate_warmup_steps": {"type": "float", "default": 0, "label": "Warmup Steps", "tooltip": "Number of warmup steps or ratio"},
    },
    "Linear": {
        "learning_rate_min_factor": {"type": "float", "default": 0.0, "label": "Min LR Factor", "tooltip": "Minimum learning rate multiplier factor"},
        "learning_rate_warmup_steps": {"type": "float", "default": 0, "label": "Warmup Steps", "tooltip": "Number of warmup steps or ratio"},
    },
    "Polynomial": {
        "power": {"type": "float", "default": 1.0, "label": "Power", "tooltip": "Polynomial decay power exponent"},
        "learning_rate_min_factor": {"type": "float", "default": 0.0, "label": "Min LR Factor", "tooltip": "Minimum learning rate multiplier factor"},
        "learning_rate_warmup_steps": {"type": "float", "default": 0, "label": "Warmup Steps", "tooltip": "Number of warmup steps or ratio"},
    },
    "Constant with Warmup": {
        "learning_rate_warmup_steps": {"type": "float", "default": 0, "label": "Warmup Steps", "tooltip": "Number of warmup steps or ratio"},
    },
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
            Group(
                "training_options",
                "Training Options",
                (
                    Field(
                        "force-circular-padding",
                        ("force_circular_padding",),
                        "Force Circular Padding",
                        "Enables circular padding for all conv layers to better train seamless images",
                        "toggle",
                    ),
                    Field(
                        "text-encoder-layer-skip",
                        ("text_encoder_layer_skip",),
                        "Text Encoder Layer Skip",
                        "Number of layers to skip in Text Encoder",
                        "number",
                    ),
                    Field(
                        "text-encoder-sequence-length",
                        ("text_encoder_sequence_length",),
                        "Text Encoder Sequence Length",
                        "Sequence length for Text Encoder",
                        "number",
                    ),
                ),
            ),
        ),
    ),
    Tab(
        "model",
        "Model",
        (
            Group(
                "base_model",
                "Base Model",
                (
                    Field(
                        "base-model-name",
                        ("base_model_name",),
                        "Base Model Name",
                        "The base model file path or name",
                        "text",
                    ),
                    Field(
                        "model-type",
                        ("model_type",),
                        "Model Type",
                        "Type of base model",
                        "select",
                    ),
                    Field(
                        "output-dtype",
                        ("output_dtype",),
                        "Output Dtype",
                        "Data type for saved model weights",
                        "select",
                    ),
                    Field(
                        "output-model-format",
                        ("output_model_format",),
                        "Output Model Format",
                        "Format for saved model file",
                        "select",
                    ),
                    Field(
                        "output-model-destination",
                        ("output_model_destination",),
                        "Output Destination",
                        "Output model file path",
                        "text",
                    ),
                    Field(
                        "include-train-config",
                        ("include_train_config",),
                        "Include Config",
                        "Save training configuration inside output model",
                        "select",
                    ),
                    Field(
                        "compile",
                        ("compile",),
                        "Compile transformer blocks",
                        "Uses torch.compile and Triton to significantly speed up training. Only applies to transformer/unet. Disable in case of compatibility issues.",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "model_components",
                "Model Components",
                (
                    Field(
                        "unet",
                        ("unet",),
                        "UNet Config",
                        "UNet model component configuration",
                        "text",
                    ),
                    Field(
                        "prior",
                        ("prior",),
                        "Prior Config",
                        "Prior model component configuration",
                        "text",
                    ),
                    Field(
                        "transformer",
                        ("transformer",),
                        "Transformer Config",
                        "Transformer model component configuration",
                        "text",
                    ),
                    Field(
                        "unconditional-transformer",
                        ("unconditional_transformer",),
                        "Unconditional Transformer",
                        "Unconditional transformer model component configuration",
                        "text",
                    ),
                    Field(
                        "quantization",
                        ("quantization",),
                        "Quantization Config",
                        "Model quantization configuration",
                        "text",
                    ),
                    Field(
                        "text-encoder",
                        ("text_encoder",),
                        "Text Encoder",
                        "Text Encoder model component configuration",
                        "text",
                    ),
                    Field(
                        "text-encoder-layer-skip",
                        ("text_encoder_layer_skip",),
                        "Text Encoder Layer Skip",
                        "Number of layers to skip in Text Encoder",
                        "number",
                    ),
                    Field(
                        "text-encoder-sequence-length",
                        ("text_encoder_sequence_length",),
                        "Text Encoder Sequence Length",
                        "Sequence length for Text Encoder",
                        "number",
                    ),
                    Field(
                        "text-encoder-2",
                        ("text_encoder_2",),
                        "Text Encoder 2",
                        "Text Encoder 2 model component configuration",
                        "text",
                    ),
                    Field(
                        "text-encoder-2-layer-skip",
                        ("text_encoder_2_layer_skip",),
                        "Text Encoder 2 Layer Skip",
                        "Number of layers to skip in Text Encoder 2",
                        "number",
                    ),
                    Field(
                        "text-encoder-2-sequence-length",
                        ("text_encoder_2_sequence_length",),
                        "Text Encoder 2 Sequence Length",
                        "Sequence length for Text Encoder 2",
                        "number",
                    ),
                    Field(
                        "text-encoder-3",
                        ("text_encoder_3",),
                        "Text Encoder 3",
                        "Text Encoder 3 model component configuration",
                        "text",
                    ),
                    Field(
                        "text-encoder-3-layer-skip",
                        ("text_encoder_3_layer_skip",),
                        "Text Encoder 3 Layer Skip",
                        "Number of layers to skip in Text Encoder 3",
                        "number",
                    ),
                    Field(
                        "text-encoder-4",
                        ("text_encoder_4",),
                        "Text Encoder 4",
                        "Text Encoder 4 model component configuration",
                        "text",
                    ),
                    Field(
                        "text-encoder-4-layer-skip",
                        ("text_encoder_4_layer_skip",),
                        "Text Encoder 4 Layer Skip",
                        "Number of layers to skip in Text Encoder 4",
                        "number",
                    ),
                    Field(
                        "vae",
                        ("vae",),
                        "VAE Config",
                        "VAE model component configuration",
                        "text",
                    ),
                    Field(
                        "effnet-encoder",
                        ("effnet_encoder",),
                        "EffNet Encoder Config",
                        "EffNet Encoder component configuration",
                        "text",
                    ),
                    Field(
                        "decoder",
                        ("decoder",),
                        "Decoder Config",
                        "Decoder component configuration",
                        "text",
                    ),
                    Field(
                        "decoder-text-encoder",
                        ("decoder_text_encoder",),
                        "Decoder Text Encoder Config",
                        "Decoder Text Encoder component configuration",
                        "text",
                    ),
                    Field(
                        "decoder-vqgan",
                        ("decoder_vqgan",),
                        "Decoder VQGAN Config",
                        "Decoder VQGAN component configuration",
                        "text",
                    ),
                ),
            ),
        ),
    ),
    Tab(
        "training",
        "Training",
        (
            Group(
                "basic_training",
                "Basic Training",
                (
                    Field(
                        "training-method",
                        ("training_method",),
                        "Training Method",
                        "Training method mode",
                        "select",
                    ),
                    Field(
                        "learning-rate",
                        ("learning_rate",),
                        "Learning Rate",
                        "Base learning rate",
                        "number",
                    ),
                    Field(
                        "lr-scheduler",
                        ("learning_rate_scheduler",),
                        "LR Scheduler",
                        "Learning rate scheduler strategy",
                        "select",
                    ),
                    Field(
                        "custom-lr-scheduler",
                        ("custom_learning_rate_scheduler",),
                        "Custom LR Scheduler",
                        "Python class for custom learning rate scheduler",
                        "text",
                    ),
                    Field(
                        "scheduler-params",
                        ("scheduler_params",),
                        "Scheduler Parameters",
                        "Key-value parameters for custom LR scheduler",
                        "text",
                    ),
                    Field(
                        "lr-warmup-steps",
                        ("learning_rate_warmup_steps",),
                        "LR Warmup Steps",
                        "Warmup steps or ratio for learning rate schedule",
                        "number",
                    ),
                    Field(
                        "lr-cycles",
                        ("learning_rate_cycles",),
                        "LR Cycles",
                        "Cosine decay cycles",
                        "number",
                    ),
                    Field(
                        "lr-min-factor",
                        ("learning_rate_min_factor",),
                        "LR Min Factor",
                        "Minimum learning rate multiplier factor",
                        "number",
                    ),
                    Field(
                        "epochs",
                        ("epochs",),
                        "Epochs",
                        "Total number of training epochs",
                        "number",
                    ),
                    Field(
                        "batch-size",
                        ("batch_size",),
                        "Batch Size",
                        "Training batch size per step",
                        "number",
                    ),
                    Field(
                        "grad-accum-steps",
                        ("gradient_accumulation_steps",),
                        "Gradient Accumulation Steps",
                        "Number of steps to accumulate gradients",
                        "number",
                    ),
                    Field(
                        "train-dtype",
                        ("train_dtype",),
                        "Train Dtype",
                        "Data type for training computations",
                        "select",
                    ),
                    Field(
                        "fallback-train-dtype",
                        ("fallback_train_dtype",),
                        "Fallback Train Dtype",
                        "Fallback data type for training",
                        "select",
                    ),
                    Field(
                        "autocast-cache",
                        ("enable_autocast_cache",),
                        "Enable Autocast Cache",
                        "Cache autocast linear layers for speedup",
                        "toggle",
                    ),
                    Field(
                        "resolution",
                        ("resolution",),
                        "Resolution",
                        "Training image resolution e.g. 512,512",
                        "text",
                    ),
                    Field(
                        "frames",
                        ("frames",),
                        "Frames",
                        "Frame count specification for video models",
                        "text",
                    ),
                    Field(
                        "attention-mechanism",
                        ("attention_mechanism",),
                        "Attention Mechanism",
                        "Attention implementation engine",
                        "select",
                    ),
                    Field(
                        "clip-grad-norm",
                        ("clip_grad_norm",),
                        "Clip Grad Norm",
                        "Maximum gradient norm for gradient clipping",
                        "number",
                    ),
                ),
            ),
            Group(
                "optimizer_group",
                "Optimizer",
                (
                    Field(
                        "optimizer",
                        ("optimizer",),
                        "Optimizer Config",
                        "Primary optimizer settings",
                        "text",
                    ),
                    Field(
                        "optimizer-defaults",
                        ("optimizer_defaults",),
                        "Optimizer Defaults",
                        "Per-optimizer saved default settings",
                        "text",
                    ),
                ),
            ),
            Group(
                "ema_and_loss",
                "EMA & Loss",
                (
                    Field(
                        "ema",
                        ("ema",),
                        "EMA Mode",
                        "Exponential Moving Average mode",
                        "select",
                    ),
                    Field(
                        "ema-decay",
                        ("ema_decay",),
                        "EMA Decay",
                        "Decay rate for Exponential Moving Average",
                        "number",
                    ),
                    Field(
                        "ema-update-interval",
                        ("ema_update_step_interval",),
                        "EMA Update Interval",
                        "Step interval for EMA updates",
                        "number",
                    ),
                    Field(
                        "mse-strength",
                        ("mse_strength",),
                        "MSE Loss Strength",
                        "Multiplier for Mean Squared Error loss",
                        "number",
                    ),
                    Field(
                        "mae-strength",
                        ("mae_strength",),
                        "MAE Loss Strength",
                        "Multiplier for Mean Absolute Error loss",
                        "number",
                    ),
                    Field(
                        "log-cosh-strength",
                        ("log_cosh_strength",),
                        "Log-Cosh Loss Strength",
                        "Multiplier for Log-Cosh loss",
                        "number",
                    ),
                    Field(
                        "huber-strength",
                        ("huber_strength",),
                        "Huber Loss Strength",
                        "Multiplier for Huber loss",
                        "number",
                    ),
                    Field(
                        "huber-delta",
                        ("huber_delta",),
                        "Huber Delta",
                        "Delta parameter for Huber loss",
                        "number",
                    ),
                    Field(
                        "vb-loss-strength",
                        ("vb_loss_strength",),
                        "VB Loss Strength",
                        "Multiplier for Variational Bound loss",
                        "number",
                    ),
                    Field(
                        "loss-weight-fn",
                        ("loss_weight_fn",),
                        "Loss Weight Function",
                        "Loss weighting strategy",
                        "select",
                    ),
                    Field(
                        "loss-weight-strength",
                        ("loss_weight_strength",),
                        "Loss Weight Strength",
                        "Strength multiplier for loss weight function",
                        "number",
                    ),
                    Field(
                        "loss-scaler",
                        ("loss_scaler",),
                        "Loss Scaler",
                        "Dynamic or fixed loss scaling strategy",
                        "select",
                    ),
                    Field(
                        "lr-scaler",
                        ("learning_rate_scaler",),
                        "LR Scaler",
                        "Learning rate scaling strategy",
                        "select",
                    ),
                ),
            ),
            Group(
                "layer_filtering",
                "Layer Filtering",
                (
                    Field(
                        "layer-filter",
                        ("layer_filter",),
                        "Layer Filter",
                        "Comma-separated list of target layers",
                        "text",
                    ),
                    Field(
                        "layer-filter-preset",
                        ("layer_filter_preset",),
                        "Layer Filter Preset",
                        "Preset name for layer filtering",
                        "text",
                    ),
                    Field(
                        "layer-filter-regex",
                        ("layer_filter_regex",),
                        "Layer Filter Regex",
                        "Treat layer filter pattern as regular expression",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "noise_and_timesteps",
                "Noise & Timesteps",
                (
                    Field(
                        "offset-noise-weight",
                        ("offset_noise_weight",),
                        "Offset Noise Weight",
                        "Weight for offset noise addition",
                        "number",
                    ),
                    Field(
                        "generalized-offset-noise",
                        ("generalized_offset_noise",),
                        "Generalized Offset Noise",
                        "Enable generalized offset noise calculation",
                        "toggle",
                    ),
                    Field(
                        "perturbation-noise-weight",
                        ("perturbation_noise_weight",),
                        "Perturbation Noise Weight",
                        "Weight for input perturbation noise",
                        "number",
                    ),
                    Field(
                        "rescale-noise-to-zero-snr",
                        ("rescale_noise_scheduler_to_zero_terminal_snr",),
                        "Rescale to Zero Terminal SNR",
                        "Rescale noise scheduler to zero terminal SNR",
                        "toggle",
                    ),
                    Field(
                        "force-v-prediction",
                        ("force_v_prediction",),
                        "Force V Prediction",
                        "Force V-prediction mode",
                        "toggle",
                    ),
                    Field(
                        "force-epsilon-prediction",
                        ("force_epsilon_prediction",),
                        "Force Epsilon Prediction",
                        "Force Epsilon-prediction mode",
                        "toggle",
                    ),
                    Field(
                        "timestep-distribution",
                        ("timestep_distribution",),
                        "Timestep Distribution",
                        "Distribution mode for sampling timesteps",
                        "select",
                    ),
                    Field(
                        "min-noising-strength",
                        ("min_noising_strength",),
                        "Min Noising Strength",
                        "Minimum noising strength bound",
                        "number",
                    ),
                    Field(
                        "max-noising-strength",
                        ("max_noising_strength",),
                        "Max Noising Strength",
                        "Maximum noising strength bound",
                        "number",
                    ),
                    Field(
                        "noising-weight",
                        ("noising_weight",),
                        "Noising Weight",
                        "Weight parameter for timestep distribution",
                        "number",
                    ),
                    Field(
                        "noising-bias",
                        ("noising_bias",),
                        "Noising Bias",
                        "Bias parameter for timestep distribution",
                        "number",
                    ),
                    Field(
                        "timestep-shift",
                        ("timestep_shift",),
                        "Timestep Shift",
                        "Shift offset for sampling timesteps",
                        "number",
                    ),
                    Field(
                        "dynamic-timestep-shifting",
                        ("dynamic_timestep_shifting",),
                        "Dynamic Timestep Shifting",
                        "Enable resolution-based dynamic timestep shifting",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "masking_and_conditioning",
                "Masking & Conditioning",
                (
                    Field(
                        "masked-training",
                        ("masked_training",),
                        "Masked Training",
                        "Enable masked training",
                        "toggle",
                    ),
                    Field(
                        "unmasked-probability",
                        ("unmasked_probability",),
                        "Unmasked Probability",
                        "Probability of sampling unmasked images",
                        "number",
                    ),
                    Field(
                        "unmasked-weight",
                        ("unmasked_weight",),
                        "Unmasked Weight",
                        "Loss weight for unmasked regions",
                        "number",
                    ),
                    Field(
                        "normalize-masked-loss",
                        ("normalize_masked_area_loss",),
                        "Normalize Masked Area Loss",
                        "Normalize loss by area of mask",
                        "toggle",
                    ),
                    Field(
                        "masked-prior-preservation-weight",
                        ("masked_prior_preservation_weight",),
                        "Masked Prior Preservation Weight",
                        "Weight for prior preservation in masked regions",
                        "number",
                    ),
                    Field(
                        "custom-conditioning-image",
                        ("custom_conditioning_image",),
                        "Custom Conditioning Image",
                        "Enable custom conditioning image inputs",
                        "toggle",
                    ),
                ),
            ),
        ),
    ),
    Tab(
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
    ),
    Tab(
        "lora_embedding",
        "LoRA / Embedding",
        (
            Group(
                "lora",
                "LoRA / PEFT",
                (
                    Field(
                        "peft-type",
                        ("peft_type",),
                        "PEFT Type",
                        "Parameter-efficient fine-tuning type",
                        "select",
                    ),
                    Field(
                        "lora-model-name",
                        ("lora_model_name",),
                        "LoRA Model Name",
                        "Base LoRA model file path or name",
                        "text",
                    ),
                    Field(
                        "lora-rank",
                        ("lora_rank",),
                        "LoRA Rank",
                        "Dimension rank for LoRA matrices",
                        "number",
                    ),
                    Field(
                        "lora-alpha",
                        ("lora_alpha",),
                        "LoRA Alpha",
                        "Scaling factor alpha for LoRA weights",
                        "number",
                    ),
                    Field(
                        "lora-decompose",
                        ("lora_decompose",),
                        "LoRA Decompose (DoRA)",
                        "Enable Weight-Decomposed Low-Rank Adaptation (DoRA)",
                        "toggle",
                    ),
                    Field(
                        "lora-decompose-norm-eps",
                        ("lora_decompose_norm_epsilon",),
                        "DoRA Norm Epsilon",
                        "Norm epsilon for DoRA weight magnitude normalization",
                        "toggle",
                    ),
                    Field(
                        "lora-decompose-output-axis",
                        ("lora_decompose_output_axis",),
                        "DoRA Output Axis",
                        "Use output axis for DoRA magnitude vector",
                        "toggle",
                    ),
                    Field(
                        "lora-weight-dtype",
                        ("lora_weight_dtype",),
                        "LoRA Weight Dtype",
                        "Data type for LoRA model weights",
                        "select",
                    ),
                    Field(
                        "dropout-probability",
                        ("dropout_probability",),
                        "Dropout Probability",
                        "Dropout probability for LoRA / text encoder",
                        "number",
                    ),
                    Field(
                        "bundle-additional-embeddings",
                        ("bundle_additional_embeddings",),
                        "Bundle Additional Embeddings",
                        "Bundle additional embeddings into LoRA output checkpoint",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "oft",
                "OFT",
                (
                    Field(
                        "oft-block-size",
                        ("oft_block_size",),
                        "OFT Block Size",
                        "Block size for Orthogonal Fine-Tuning",
                        "number",
                    ),
                    Field(
                        "oft-block-share",
                        ("oft_block_share",),
                        "OFT Block Share",
                        "Share orthogonal block matrices across layers",
                        "toggle",
                    ),
                    Field(
                        "oft-scaled",
                        ("oft_scaled",),
                        "OFT Scaled",
                        "Use scaled orthogonal matrices in OFT",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "lokr",
                "LoKr",
                (
                    Field(
                        "lokr-dim",
                        ("lokr_dim",),
                        "LoKr Factor Factorization Dimension",
                        "Kronecker product dimension for LoKr",
                        "number",
                    ),
                    Field(
                        "lokr-decompose-both",
                        ("lokr_decompose_both",),
                        "LoKr Decompose Both",
                        "Decompose both Kronecker matrix factors into low-rank",
                        "toggle",
                    ),
                    Field(
                        "lokr-decompose-factor",
                        ("lokr_decompose_factor",),
                        "LoKr Decompose Factor",
                        "Factor for low-rank matrix decomposition",
                        "number",
                    ),
                    Field(
                        "lokr-use-tucker",
                        ("lokr_use_tucker",),
                        "LoKr Use Tucker",
                        "Use Tucker tensor decomposition for 4D convolutions",
                        "toggle",
                    ),
                    Field(
                        "lokr-weight-decompose",
                        ("lokr_weight_decompose",),
                        "LoKr Weight Decompose",
                        "Apply weight decomposition to LoKr updates",
                        "toggle",
                    ),
                    Field(
                        "lokr-dora-on-output",
                        ("lokr_dora_on_output",),
                        "LoKr DoRA on Output",
                        "Apply DoRA magnitude normalization on output axis",
                        "toggle",
                    ),
                    Field(
                        "lokr-full-matrix",
                        ("lokr_full_matrix",),
                        "LoKr Full Matrix",
                        "Use full matrix instead of Kronecker product decomposition",
                        "toggle",
                    ),
                    Field(
                        "lokr-vec-trick",
                        ("lokr_vec_trick",),
                        "LoKr Vector Trick",
                        "Use vectorization trick for faster Kronecker multiplication",
                        "toggle",
                    ),
                ),
            ),
            Group(
                "embeddings",
                "Embeddings",
                (
                    Field(
                        "embedding-lr",
                        ("embedding_learning_rate",),
                        "Embedding Learning Rate",
                        "Learning rate for textual inversion embeddings",
                        "number",
                    ),
                    Field(
                        "preserve-embedding-norm",
                        ("preserve_embedding_norm",),
                        "Preserve Embedding Norm",
                        "Keep norm of trained embedding tokens close to initial norm",
                        "toggle",
                    ),
                    Field(
                        "embedding",
                        ("embedding",),
                        "Primary Embedding Config",
                        "Primary textual inversion embedding configuration",
                        "text",
                    ),
                    Field(
                        "additional-embeddings",
                        ("additional_embeddings",),
                        "Additional Embeddings",
                        "List of additional textual inversion embedding configurations",
                        "text",
                    ),
                    Field(
                        "embedding-weight-dtype",
                        ("embedding_weight_dtype",),
                        "Embedding Weight Dtype",
                        "Data type for saving textual inversion embeddings",
                        "select",
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
            Group(
                "concepts_group",
                "Concepts",
                (
                    Field(
                        "concept-filename",
                        ("concept_file_name",),
                        "Concept File Name",
                        "File path for concepts dataset configuration JSON",
                        "file",
                        path_mode="file",
                    ),
                    Field(
                        "concepts",
                        ("concepts",),
                        "Concepts List",
                        "List of training concept dataset configurations",
                        "text",
                    ),
                ),
            ),
        ),
    ),
    Tab(
        "cloud",
        "Cloud",
        (
            Group(
                "cloud_group",
                "Cloud Settings",
                (
                    Field(
                        "cloud",
                        ("cloud",),
                        "Cloud Config",
                        "Cloud storage and remote synchronization settings",
                        "text",
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
    Tab(
        "secrets",
        "Secrets",
        (
            Group(
                "secrets_group",
                "Secrets",
                (
                    Field(
                        "secrets",
                        ("secrets",),
                        "Secrets Config",
                        "Authentication credentials and API secrets",
                        "text",
                    ),
                ),
            ),
        ),
    ),
)


def build_model_tab(model_type_enum: ModelType) -> Tab:
    parts = model_type_enum.model_parts()

    base_fields = [
        Field(
            "base-model-name",
            ("base_model_name",),
            "Base Model Name",
            "The base model file path or name",
            "text",
            path_mode="file",
        ),
        Field(
            "model-type",
            ("model_type",),
            "Model Type",
            "Type of base model",
            "select",
        ),
        Field(
            "output-dtype",
            ("output_dtype",),
            "Output Dtype",
            "Data type for saved model weights",
            "select",
        ),
        Field(
            "output-model-format",
            ("output_model_format",),
            "Output Model Format",
            "Format for saved model file",
            "select",
        ),
        Field(
            "output-model-destination",
            ("output_model_destination",),
            "Output Destination",
            "Output model file path",
            "text",
            path_mode="file",
        ),
        Field(
            "include-train-config",
            ("include_train_config",),
            "Include Config",
            "Include the training configuration in the final model. Only supported for safetensors files",
            "select",
        ),
        Field(
            "compile",
            ("compile",),
            "Compile transformer blocks",
            "Uses torch.compile and Triton to significantly speed up training. Only applies to transformer/unet. Disable in case of compatibility issues.",
            "toggle",
        ),
    ]

    component_fields = []

    # UNet
    if "unet" in parts:
        component_fields.append(
            Field(
                "unet-weight-dtype",
                ("unet.weight_dtype",),
                "UNet Data Type",
                "The unet weight data type",
                "select",
            )
        )

    # Prior
    if "prior" in parts:
        if model_type_enum.is_stable_cascade():
            component_fields.append(
                Field(
                    "prior-model-name",
                    ("prior.model_name",),
                    "Prior Model",
                    "Filename, directory or Hugging Face repository of the prior model",
                    "text",
                    path_mode="file",
                )
            )
        component_fields.append(
            Field(
                "prior-weight-dtype",
                ("prior.weight_dtype",),
                "Prior Data Type",
                "The prior weight data type",
                "select",
            )
        )

    # Transformer
    if "transformer" in parts:
        component_fields.append(
            Field(
                "transformer-model-name",
                ("transformer.model_name",),
                "Override Transformer / GGUF",
                "Can be used to override the transformer in the base model",
                "text",
                path_mode="file",
            )
        )
        component_fields.append(
            Field(
                "transformer-weight-dtype",
                ("transformer.weight_dtype",),
                "Transformer Data Type",
                "The transformer weight data type",
                "select",
            )
        )

    # Unconditional Transformer
    if "unconditional_transformer" in parts:
        component_fields.append(
            Field(
                "unconditional-transformer-weight-dtype",
                ("unconditional_transformer.weight_dtype",),
                "Unconditional Transformer Data Type",
                "Weight data type of unconditional transformer",
                "select",
            )
        )

    # Quantization
    component_fields.append(
        Field(
            "quantization-svd-dtype",
            ("quantization.svd_dtype",),
            "SVDQuant Data Type",
            "Datatype to use for SVDQuant weights decomposition",
            "select",
        )
    )
    component_fields.append(
        Field(
            "quantization-svd-rank",
            ("quantization.svd_rank",),
            "SVDQuant Rank",
            "Rank for SVDQuant weights decomposition",
            "number",
        )
    )

    # Text Encoders
    has_multiple = model_type_enum.has_multiple_text_encoders()
    if not has_multiple:
        component_fields.append(
            Field(
                "text-encoder-weight-dtype",
                ("text_encoder.weight_dtype",),
                "Text Encoder Data Type",
                "The text encoder weight data type",
                "select",
            )
        )
    else:
        component_fields.append(
            Field(
                "text-encoder-1-weight-dtype",
                ("text_encoder.weight_dtype",),
                "Text Encoder 1 Data Type",
                "The text encoder 1 weight data type",
                "select",
            )
        )

    if "text_encoder_2" in parts:
        component_fields.append(
            Field(
                "text-encoder-2-weight-dtype",
                ("text_encoder_2.weight_dtype",),
                "Text Encoder 2 Data Type",
                "The text encoder 2 weight data type",
                "select",
            )
        )

    if "text_encoder_3" in parts:
        component_fields.append(
            Field(
                "text-encoder-3-weight-dtype",
                ("text_encoder_3.weight_dtype",),
                "Text Encoder 3 Data Type",
                "The text encoder 3 weight data type",
                "select",
            )
        )

    if "text_encoder_4" in parts:
        component_fields.append(
            Field(
                "text-encoder-4-model-name",
                ("text_encoder_4.model_name",),
                "Text Encoder 4 Override",
                "Filename, directory or Hugging Face repository of text encoder 4",
                "text",
                path_mode="file",
            )
        )
        component_fields.append(
            Field(
                "text-encoder-4-weight-dtype",
                ("text_encoder_4.weight_dtype",),
                "Text Encoder 4 Data Type",
                "The text encoder 4 weight data type",
                "select",
            )
        )

    # VAE
    if "vae" in parts:
        component_fields.append(
            Field(
                "vae-model-name",
                ("vae.model_name",),
                "VAE Override",
                "Directory or Hugging Face repository of a VAE model in diffusers format",
                "text",
                path_mode="file",
            )
        )
        component_fields.append(
            Field(
                "vae-weight-dtype",
                ("vae.weight_dtype",),
                "VAE Data Type",
                "The VAE weight data type",
                "select",
            )
        )

    # EffNet Encoder
    if "effnet_encoder" in parts:
        component_fields.append(
            Field(
                "effnet-encoder-model-name",
                ("effnet_encoder.model_name",),
                "Effnet Encoder Model",
                "Filename, directory or Hugging Face repository of effnet encoder",
                "text",
                path_mode="file",
            )
        )
        component_fields.append(
            Field(
                "effnet-encoder-weight-dtype",
                ("effnet_encoder.weight_dtype",),
                "Effnet Encoder Data Type",
                "The effnet encoder weight data type",
                "select",
            )
        )

    # Decoder
    if "decoder" in parts:
        component_fields.append(
            Field(
                "decoder-model-name",
                ("decoder.model_name",),
                "Decoder Model",
                "Filename, directory or Hugging Face repository of decoder model",
                "text",
                path_mode="file",
            )
        )
        component_fields.append(
            Field(
                "decoder-weight-dtype",
                ("decoder.weight_dtype",),
                "Decoder Data Type",
                "The decoder weight data type",
                "select",
            )
        )

    groups = [
        Group("base_model", "Base Model", tuple(base_fields)),
        Group("model_components", "Model Components", tuple(component_fields)),
    ]

    return Tab("model", "Model", tuple(groups))


class SchemaRegistry:
    @classmethod
    def get_all_field_names(cls) -> list[str]:
        field_names = []
        for tab in TABS:
            for group in tab.groups:
                for field in group.fields:
                    field_names.extend(field.keys)
        top_level_components = [
            "unet",
            "transformer",
            "prior",
            "unconditional_transformer",
            "quantization",
            "text_encoder",
            "text_encoder_2",
            "text_encoder_3",
            "text_encoder_4",
            "vae",
            "effnet_encoder",
            "decoder",
            "decoder_text_encoder",
            "decoder_vqgan",
        ]
        return field_names + top_level_components

    @classmethod
    def get_schema_for_domain(cls, domain: str) -> dict[str, object] | None:
        config_template = TrainConfig.default_values()
        for tab in TABS:
            if tab.id == domain:
                return tab.to_dict(config_template)
        return None

    @classmethod
    def get_sub_schema(cls, key: str) -> dict[str, object]:
        if key == "optimizer":
            return OPTIMIZER_SUB_SCHEMAS
        if key in ("scheduler", "scheduler_params", "learning_rate_scheduler"):
            return SCHEDULER_SUB_SCHEMAS
        if key in OPTIMIZER_SUB_SCHEMAS:
            return OPTIMIZER_SUB_SCHEMAS[key]
        if key in SCHEDULER_SUB_SCHEMAS:
            return SCHEDULER_SUB_SCHEMAS[key]
        return {}

    def build(self, model_type: str, training_method: str) -> dict[str, object]:
        try:
            model_type_enum = ModelType(model_type)
            training_method_enum = TrainingMethod(training_method)
        except ValueError as error:
            raise ValueError(f"Training method is not supported: {error}") from error

        if training_method_enum not in model_type_enum.supported_training_methods():
            raise ValueError(f"Training method is not supported for model type {model_type}")

        config_template = TrainConfig.default_values()
        dynamic_tabs = []
        for tab in TABS:
            if tab.id == "model":
                dynamic_tab = build_model_tab(model_type_enum)
                dynamic_tabs.append(dynamic_tab.to_dict(config_template))
            else:
                dynamic_tabs.append(tab.to_dict(config_template))

        return {
            "model_type": model_type_enum.value,
            "training_method": training_method_enum.value,
            "tabs": dynamic_tabs,
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
            "AttentionMechanism": [e.value for e in AttentionMechanism],
            "ConfigPart": [e.value for e in ConfigPart],
            "DataType": [e.value for e in DataType],
            "EMAMode": [e.value for e in EMAMode],
            "ImageFormat": [e.value for e in ImageFormat],
            "LearningRateScaler": [e.value for e in LearningRateScaler],
            "LearningRateScheduler": [e.value for e in LearningRateScheduler],
            "LossScaler": [e.value for e in LossScaler],
            "LossWeight": [e.value for e in LossWeight],
            "ModelFormat": [e.value for e in ModelFormat],
            "Optimizer": [e.value for e in Optimizer],
            "PeftType": [e.value for e in PeftType],
            "TimestepDistribution": [e.value for e in TimestepDistribution],
            "VideoFormat": [e.value for e in VideoFormat],
        }

        return {
            "model_types": model_types,
            "enums": enums,
            "optimizer_sub_schemas": OPTIMIZER_SUB_SCHEMAS,
            "scheduler_sub_schemas": SCHEDULER_SUB_SCHEMAS,
        }
