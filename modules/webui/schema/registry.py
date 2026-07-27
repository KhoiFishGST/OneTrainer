import math
from typing import Any

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

KEY_DETAIL_MAP = {
    'adam_w_mode': {'title': 'Adam W Mode', 'tooltip': 'Whether to use weight decay correction for Adam optimizer.', 'type': 'bool'},
    'alpha': {'title': 'Alpha', 'tooltip': 'Smoothing parameter for RMSprop and others.', 'type': 'float'},
    'amsgrad': {'title': 'AMSGrad', 'tooltip': 'Whether to use the AMSGrad variant for Adam.', 'type': 'bool'},
    'beta1': {'title': 'Beta1', 'tooltip': 'optimizer_momentum term.', 'type': 'float'},
    'beta2': {'title': 'Beta2', 'tooltip': 'Coefficients for computing running averages of gradient.', 'type': 'float'},
    'beta3': {'title': 'Beta3', 'tooltip': 'Coefficient for computing the Prodigy stepsize.', 'type': 'float'},
    'bias_correction': {'title': 'Bias Correction', 'tooltip': 'Whether to use bias correction in optimization algorithms like Adam.', 'type': 'bool'},
    'block_wise': {'title': 'Block Wise', 'tooltip': 'Whether to perform block-wise model update.', 'type': 'bool'},
    'capturable': {'title': 'Capturable', 'tooltip': 'Whether some property of the optimizer can be captured.', 'type': 'bool'},
    'centered': {'title': 'Centered', 'tooltip': 'Whether to center the gradient before scaling.', 'type': 'bool'},
    'clip_threshold': {'title': 'Clip Threshold', 'tooltip': 'Clipping value for gradients.', 'type': 'float'},
    'd0': {'title': 'Initial D', 'tooltip': 'Initial D estimate for D-adaptation.', 'type': 'float'},
    'd_coef': {'title': 'D Coefficient', 'tooltip': 'Coefficient in the expression for the estimate of d.', 'type': 'float'},
    'dampening': {'title': 'Dampening', 'tooltip': 'Dampening for optimizer_momentum.', 'type': 'float'},
    'decay_rate': {'title': 'Decay Rate', 'tooltip': 'Rate of decay for moment estimation.', 'type': 'float'},
    'decouple': {'title': 'Decouple', 'tooltip': 'Use AdamW style optimizer_decoupled weight decay.', 'type': 'bool'},
    'differentiable': {'title': 'Differentiable', 'tooltip': 'Whether the optimization function is optimizer_differentiable.', 'type': 'bool'},
    'eps': {'title': 'EPS', 'tooltip': 'A small value to prevent division by zero.', 'type': 'float'},
    'eps2': {'title': 'EPS 2', 'tooltip': 'A small value to prevent division by zero.', 'type': 'float'},
    'foreach': {'title': 'ForEach', 'tooltip': 'Whether to use a foreach implementation if available.', 'type': 'bool'},
    'fsdp_in_use': {'title': 'FSDP in Use', 'tooltip': 'Flag for using sharded parameters.', 'type': 'bool'},
    'fused': {'title': 'Fused', 'tooltip': 'Whether to use a fused implementation if available.', 'type': 'bool'},
    'fused_back_pass': {'title': 'Fused Back Pass', 'tooltip': 'Whether to fuse the back propagation pass with the optimizer step.', 'type': 'bool'},
    'growth_rate': {'title': 'Growth Rate', 'tooltip': 'Limit for D estimate growth rate.', 'type': 'float'},
    'initial_accumulator_value': {'title': 'Initial Accumulator Value', 'tooltip': 'Initial value for Adagrad optimizer.', 'type': 'float'},
    'initial_accumulator': {'title': 'Initial Accumulator', 'tooltip': 'Sets the starting value for both moment estimates.', 'type': 'float'},
    'is_paged': {'title': 'Is Paged', 'tooltip': "Whether the optimizer's internal state should be paged to CPU.", 'type': 'bool'},
    'log_every': {'title': 'Log Every', 'tooltip': 'Intervals at which logging should occur.', 'type': 'int'},
    'lr_decay': {'title': 'LR Decay', 'tooltip': 'Rate at which learning rate decreases.', 'type': 'float'},
    'max_unorm': {'title': 'Max Unorm', 'tooltip': 'Maximum value for gradient clipping by norms.', 'type': 'float'},
    'maximize': {'title': 'Maximize', 'tooltip': 'Whether to optimizer_maximize the optimization function.', 'type': 'bool'},
    'min_8bit_size': {'title': 'Min 8bit Size', 'tooltip': 'Minimum tensor size for 8-bit quantization.', 'type': 'int'},
    'quant_block_size': {'title': 'Quant Block Size', 'tooltip': 'Size of a block of normalized 8-bit quantization data.', 'type': 'int'},
    'momentum': {'title': 'Momentum', 'tooltip': 'Factor to accelerate SGD in relevant direction.', 'type': 'float'},
    'nesterov': {'title': 'Nesterov', 'tooltip': 'Whether to enable Nesterov optimizer_momentum.', 'type': 'bool'},
    'no_prox': {'title': 'No Prox', 'tooltip': 'Whether to use proximity updates or not.', 'type': 'bool'},
    'optim_bits': {'title': 'Optim Bits', 'tooltip': 'Number of bits used for optimization.', 'type': 'int'},
    'percentile_clipping': {'title': 'Percentile Clipping', 'tooltip': 'Gradient clipping based on percentile values.', 'type': 'int'},
    'relative_step': {'title': 'Relative Step', 'tooltip': 'Whether to use a relative step size.', 'type': 'bool'},
    'safeguard_warmup': {'title': 'Safeguard Warmup', 'tooltip': 'Avoid issues during warm-up stage.', 'type': 'bool'},
    'scale_parameter': {'title': 'Scale Parameter', 'tooltip': 'Whether to scale the parameter or not.', 'type': 'bool'},
    'stochastic_rounding': {'title': 'Stochastic Rounding', 'tooltip': 'Stochastic rounding for weight updates.', 'type': 'bool'},
    'use_bias_correction': {'title': 'Bias Correction', 'tooltip': "Turn on Adam's bias correction.", 'type': 'bool'},
    'use_triton': {'title': 'Use Triton', 'tooltip': 'Whether Triton optimization should be used.', 'type': 'bool'},
    'warmup_init': {'title': 'Warmup Initialization', 'tooltip': 'Whether to warm-up the optimizer initialization.', 'type': 'bool'},
    'weight_decay': {'title': 'Weight Decay', 'tooltip': 'Regularization to prevent overfitting.', 'type': 'float'},
    'weight_lr_power': {'title': 'Weight LR Power', 'tooltip': 'During warmup, the weights in the average will be equal to lr raised to this power.', 'type': 'float'},
    'decoupled_decay': {'title': 'Decoupled Decay', 'tooltip': 'If set as True, then the optimizer uses decoupled weight decay as in AdamW.', 'type': 'bool'},
    'fixed_decay': {'title': 'Fixed Decay', 'tooltip': 'Applies fixed weight decay when True.', 'type': 'bool'},
    'rectify': {'title': 'Rectify', 'tooltip': 'Perform the rectified update similar to RAdam.', 'type': 'bool'},
    'degenerated_to_sgd': {'title': 'Degenerated to SGD', 'tooltip': 'Performs SGD update when gradient variance is high.', 'type': 'bool'},
    'k': {'title': 'K', 'tooltip': 'Number of vector projected per iteration.', 'type': 'int'},
    'xi': {'title': 'Xi', 'tooltip': 'Term used in vector projections to avoid division by zero.', 'type': 'float'},
    'n_sma_threshold': {'title': 'N SMA Threshold', 'tooltip': 'Number of SMA threshold.', 'type': 'int'},
    'ams_bound': {'title': 'AMS Bound', 'tooltip': 'Whether to use the AMSBound variant.', 'type': 'bool'},
    'r': {'title': 'R', 'tooltip': 'EMA factor.', 'type': 'float'},
    'adanorm': {'title': 'AdaNorm', 'tooltip': 'Whether to use the AdaNorm variant', 'type': 'bool'},
    'adam_debias': {'title': 'Adam Debias', 'tooltip': 'Only correct the denominator to avoid inflating step sizes early in training.', 'type': 'bool'},
    'slice_p': {'title': 'Slice parameters', 'tooltip': 'Reduce memory usage by calculating LR adaptation statistics on only every pth entry.', 'type': 'int'},
    'cautious': {'title': 'Cautious', 'tooltip': 'Whether to use the Cautious variant', 'type': 'bool'},
    'weight_decay_by_lr': {'title': 'weight_decay_by_lr', 'tooltip': 'Automatically adjust weight decay based on lr', 'type': 'bool'},
    'prodigy_steps': {'title': 'prodigy_steps', 'tooltip': 'Turn off Prodigy after N steps', 'type': 'int'},
    'use_speed': {'title': 'use_speed', 'tooltip': 'use_speed method', 'type': 'bool'},
    'split_groups': {'title': 'split_groups', 'tooltip': 'Use split groups when training multiple params', 'type': 'bool'},
    'split_groups_mean': {'title': 'split_groups_mean', 'tooltip': 'Use mean for split groups', 'type': 'bool'},
    'factored': {'title': 'factored', 'tooltip': 'Use factored', 'type': 'bool'},
    'factored_fp32': {'title': 'factored_fp32', 'tooltip': 'Use factored_fp32', 'type': 'bool'},
    'use_stableadamw': {'title': 'use_stableadamw', 'tooltip': 'Use use_stableadamw for gradient scaling', 'type': 'bool'},
    'use_cautious': {'title': 'use_cautious', 'tooltip': 'Use cautious method', 'type': 'bool'},
    'use_grams': {'title': 'use_grams', 'tooltip': 'Use grams method', 'type': 'bool'},
    'use_adopt': {'title': 'use_adopt', 'tooltip': 'Use adopt method', 'type': 'bool'},
    'd_limiter': {'title': 'd_limiter', 'tooltip': 'Prevent over-estimated LRs when gradients and EMA are still stabilizing', 'type': 'bool'},
    'use_schedulefree': {'title': 'use_schedulefree', 'tooltip': 'Use Schedulefree method', 'type': 'bool'},
    'use_orthograd': {'title': 'use_orthograd', 'tooltip': 'Use orthograd method', 'type': 'bool'},
    'nnmf_factor': {'title': 'Factored Optimizer', 'tooltip': 'Enables a memory-efficient mode by applying fast low-rank factorization.', 'type': 'bool'},
    'orthogonal_gradient': {'title': 'OrthoGrad', 'tooltip': 'Reduces overfitting by removing gradient component parallel to weight.', 'type': 'bool'},
    'use_atan2': {'title': 'Atan2 Scaling', 'tooltip': 'A robust replacement for eps, incorporating gradient clipping.', 'type': 'bool'},
    'use_AdEMAMix': {'title': 'AdEMAMix EMA', 'tooltip': 'Adds a second, slow-moving EMA.', 'type': 'bool'},
    'beta3_ema': {'title': 'Beta3 EMA', 'tooltip': 'Coefficient for slow-moving EMA of AdEMAMix.', 'type': 'float'},
    'beta1_warmup': {'title': 'Beta1 Warmup Steps', 'tooltip': 'Number of warmup steps to gradually increase beta1.', 'type': 'int'},
    'min_beta1': {'title': 'Minimum Beta1', 'tooltip': 'Starting beta1 value for warmup scheduling.', 'type': 'float'},
    'Simplified_AdEMAMix': {'title': 'Simplified AdEMAMix', 'tooltip': "Enables a simplified, single-EMA variant of AdEMAMix.", 'type': 'bool'},
    'alpha_grad': {'title': 'Grad α', 'tooltip': 'Controls mixing coefficient between raw gradients and momentum gradients.', 'type': 'float'},
    'kourkoutas_beta': {'title': 'Kourkoutas Beta', 'tooltip': 'Enables layer-wise dynamic β₂ adaptation.', 'type': 'bool'},
    'schedulefree_c': {'title': 'Schedule free averaging strength', 'tooltip': 'Larger values = more responsive; smaller values = smoother.', 'type': 'float'},
    'ns_steps': {'title': 'Newton-Schulz Iterations', 'tooltip': 'Controls iterations for update orthogonalization.', 'type': 'int'},
    'MuonWithAuxAdam': {'title': 'MuonWithAuxAdam', 'tooltip': 'Whether to use standard way of Muon.', 'type': 'bool'},
    'muon_hidden_layers': {'title': 'Hidden Layers', 'tooltip': 'Comma-separated list of hidden layers to train using Muon.', 'type': 'str'},
    'muon_adam_regex': {'title': 'Use Regex', 'tooltip': 'Whether to use regular expressions for hidden layers.', 'type': 'bool'},
    'muon_adam_lr': {'title': 'Auxiliary Adam LR', 'tooltip': 'Learning rate for auxiliary AdamW optimizer.', 'type': 'float'},
    'muon_te1_adam_lr': {'title': 'AuxAdam TE1 LR', 'tooltip': 'Learning rate for auxiliary AdamW optimizer for TE1.', 'type': 'float'},
    'muon_te2_adam_lr': {'title': 'AuxAdam TE2 LR', 'tooltip': 'Learning rate for auxiliary AdamW optimizer for TE2.', 'type': 'float'},
    'rms_rescaling': {'title': 'RMS Rescaling', 'tooltip': 'Integrates a more accurate method to match Adam LR.', 'type': 'bool'},
    'normuon_variant': {'title': 'NorMuon Variant', 'tooltip': 'Enables NorMuon optimizer variant.', 'type': 'bool'},
    'beta2_normuon': {'title': 'NorMuon Beta2', 'tooltip': 'Exponential decay rate for second-moment estimator in NorMuon.', 'type': 'float'},
    'low_rank_ortho': {'title': 'Low-rank Orthogonalization', 'tooltip': 'Use low-rank orthogonalization to accelerate Muon.', 'type': 'bool'},
    'ortho_rank': {'title': 'Ortho Rank', 'tooltip': 'Target rank for low-rank orthogonalization.', 'type': 'int'},
    'accelerated_ns': {'title': 'Accelerated Newton-Schulz', 'tooltip': 'Applies an enhanced Newton-Schulz variant.', 'type': 'bool'},
    'cautious_wd': {'title': 'Cautious Weight Decay', 'tooltip': 'Applies weight decay only when signs align.', 'type': 'bool'},
    'approx_mars': {'title': 'Approx MARS-M', 'tooltip': 'Enables Approximated MARS-M.', 'type': 'bool'},
    'auto_kappa_p': {'title': 'Auto Lion-K', 'tooltip': 'Automatically determines optimal P-value.', 'type': 'bool'},
    'compile': {'title': 'Compiled Optimizer', 'tooltip': 'Enables PyTorch compilation for optimizer step.', 'type': 'bool'},
}


FALLBACK_OPTIMIZER_DEFAULTS = {
    "ADAMW": {
        "beta1": 0.9,
        "beta2": 0.999,
        "eps": 1e-8,
        "weight_decay": 1e-2,
        "amsgrad": False,
        "foreach": False,
        "maximize": False,
        "capturable": False,
        "differentiable": False,
        "fused": True,
        "stochastic_rounding": False,
        "fused_back_pass": False,
    },
    "ADAMW_8BIT": {
        "beta1": 0.9,
        "beta2": 0.999,
        "eps": 1e-8,
        "weight_decay": 1e-2,
        "amsgrad": False,
        "optim_bits": 32,
        "min_8bit_size": 4096,
        "percentile_clipping": 100,
        "block_wise": True,
        "is_paged": False,
    },
    "ADAMW_ADV": {
        "beta1": 0.9,
        "beta2": 0.99,
        "eps": 1e-8,
        "cautious_wd": False,
        "weight_decay": 0.0,
        "nnmf_factor": False,
        "stochastic_rounding": True,
        "compile": False,
        "fused_back_pass": False,
        "use_atan2": False,
        "orthogonal_gradient": False,
        "use_AdEMAMix": False,
        "beta3_ema": 0.9999,
        "alpha": 5,
        "kourkoutas_beta": False,
    },
    "MUON": {
        "momentum": 0.95,
        "weight_decay": 0.0,
        "MuonWithAuxAdam": True,
        "muon_hidden_layers": None,
        "muon_adam_regex": False,
        "muon_adam_lr": 3e-4,
        "muon_te1_adam_lr": None,
        "muon_te2_adam_lr": None,
        "muon_adam_config": {},
    },
    "PRODIGY": {
        "beta1": 0.9,
        "beta2": 0.999,
        "beta3": None,
        "d0": 1e-6,
        "d_coef": 1.0,
        "weight_decay": 0.0,
        "decouple": True,
        "use_bias_correction": False,
        "safeguard_warmup": False,
        "slice_p": 11,
    },
    "ADAFACTOR": {
        "eps": 1e-30,
        "eps2": 1e-3,
        "clip_threshold": 1.0,
        "decay_rate": -0.8,
        "beta1": None,
        "weight_decay": 0.0,
        "scale_parameter": False,
        "relative_step": False,
        "warmup_init": False,
        "stochastic_rounding": True,
        "fused_back_pass": False,
    },
    "CAME": {
        "beta1": 0.9,
        "beta2": 0.999,
        "beta3": 0.9999,
        "eps": 1e-30,
        "eps2": 1e-16,
        "weight_decay": 1e-2,
        "stochastic_rounding": False,
        "use_cautious": False,
        "fused_back_pass": False,
    },
    "SGD": {
        "momentum": 0,
        "dampening": 0,
        "weight_decay": 0,
        "nesterov": False,
        "foreach": False,
        "maximize": False,
        "differentiable": False,
    },
    "LION": {
        "beta1": 0.9,
        "beta2": 0.99,
        "weight_decay": 0.0,
        "use_triton": False,
    },
}


def build_optimizer_sub_schemas() -> dict[str, dict[str, Any]]:
    try:
        from modules.util.optimizer_util import OPTIMIZER_DEFAULT_PARAMETERS
        source_defaults = OPTIMIZER_DEFAULT_PARAMETERS
    except Exception:
        source_defaults = FALLBACK_OPTIMIZER_DEFAULTS

    schemas = {}
    for opt_enum, params in source_defaults.items():
        opt_key = str(opt_enum.value if hasattr(opt_enum, "value") else opt_enum)
        opt_schema = {}
        for key, default_val in params.items():
            meta = KEY_DETAIL_MAP.get(key, {})
            val_type = meta.get("type")
            if not val_type:
                if isinstance(default_val, bool):
                    val_type = "bool"
                elif isinstance(default_val, int):
                    val_type = "int"
                elif isinstance(default_val, (float, type(None))):
                    val_type = "float"
                else:
                    val_type = "str"

            sanitized_default = (
                ("-inf" if default_val < 0 else "inf")
                if isinstance(default_val, float) and math.isinf(default_val)
                else default_val
            )

            opt_schema[key] = {
                "type": val_type,
                "default": sanitized_default,
                "label": meta.get("title", key.replace("_", " ").title()),
                "tooltip": meta.get("tooltip", ""),
            }
        schemas[opt_key] = opt_schema
    return schemas


OPTIMIZER_SUB_SCHEMAS = build_optimizer_sub_schemas()

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
            "optimizer_sub_schemas": build_optimizer_sub_schemas(),
            "scheduler_sub_schemas": SCHEDULER_SUB_SCHEMAS,
        }
