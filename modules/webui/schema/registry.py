from modules.ui.TopBarController import TopBarController
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
from modules.webui.schema.builders import TAB_BUILDERS

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


class SchemaRegistry:
    @classmethod
    def get_all_field_names(cls) -> list[str]:
        field_names = set()
        for model_type in ModelType:
            for training_method in model_type.supported_training_methods():
                for _, builder_fn in TAB_BUILDERS:
                    tab = builder_fn(model_type, training_method)
                    for group in tab.groups:
                        for field in group.fields:
                            for key in field.keys:
                                field_names.add(key.split(".")[0])
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
        return list(field_names | set(top_level_components))

    @classmethod
    def get_schema_for_domain(cls, domain: str) -> dict[str, object] | None:
        config_template = TrainConfig.default_values()
        for tab_id, builder_fn in TAB_BUILDERS:
            if tab_id == domain:
                tab = builder_fn(ModelType.STABLE_DIFFUSION_15, TrainingMethod.FINE_TUNE)
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
        for _, builder_fn in TAB_BUILDERS:
            tab = builder_fn(model_type_enum, training_method_enum)
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
