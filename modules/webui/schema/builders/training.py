from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_training_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    groups = []

    # 1. Base Settings
    base_fields = [
        Field("training-method", ("training_method",), "Training Method", "Training method mode", "select"),
        Field("optimizer", ("optimizer.optimizer",), "Optimizer", "The type of optimizer", "select"),
        Field("lr-scheduler", ("learning_rate_scheduler",), "LR Scheduler", "Learning rate scheduler strategy", "select"),
        Field("custom-lr-scheduler", ("custom_learning_rate_scheduler",), "Custom LR Scheduler", "Python class for custom learning rate scheduler", "text"),
        Field("scheduler-params", ("scheduler_params",), "Scheduler Parameters", "Key-value parameters for custom LR scheduler", "text"),
        Field("learning-rate", ("learning_rate",), "Learning Rate", "Base learning rate", "number"),
        Field("lr-warmup-steps", ("learning_rate_warmup_steps",), "LR Warmup Steps", "Warmup steps or ratio for learning rate schedule", "number"),
        Field("lr-min-factor", ("learning_rate_min_factor",), "LR Min Factor", "Minimum learning rate multiplier factor", "number"),
        Field("lr-cycles", ("learning_rate_cycles",), "LR Cycles", "Cosine decay cycles", "number"),
        Field("epochs", ("epochs",), "Epochs", "Total number of training epochs", "number"),
        Field("batch-size", ("batch_size",), "Batch Size", "Training batch size per step", "number"),
        Field("grad-accum-steps", ("gradient_accumulation_steps",), "Gradient Accumulation Steps", "Number of steps to accumulate gradients", "number"),
        Field("lr-scaler", ("learning_rate_scaler",), "LR Scaler", "Learning rate scaling strategy", "select"),
        Field("clip-grad-norm", ("clip_grad_norm",), "Clip Grad Norm", "Maximum gradient norm for gradient clipping", "number"),
    ]
    groups.append(Group("base_settings", "Base Settings", tuple(base_fields)))

    # 2. Text Encoders
    if model_type.is_stable_diffusion_3() or model_type.is_flux_1() or model_type.is_hunyuan_video() or model_type.is_hi_dream():
        if model_type.is_stable_diffusion_3():
            te_specs = [
                (1, True, False, False),
                (2, True, False, False),
                (3, True, True, False),
            ]
        elif model_type.is_flux_1():
            te_specs = [
                (1, True, False, False),
                (2, True, True, True),
            ]
        elif model_type.is_hunyuan_video():
            te_specs = [
                (1, True, True, False),
                (2, True, False, False),
            ]
        else:
            te_specs = [
                (1, True, False, False),
                (2, True, False, False),
            ]
        for i, supp_include, supp_offload, supp_seq_len in te_specs:
            prefix = f"text_encoder_{i}" if i > 1 else "text_encoder"
            id_prefix = f"text-encoder-{i}" if i > 1 else "text-encoder"
            label_prefix = f"Text Encoder {i}"
            f_list = []
            if supp_include:
                f_list.append(Field(f"{id_prefix}-include", (f"{prefix}.include",), f"Include {label_prefix}", f"Include {label_prefix} in training", "toggle"))
            f_list.append(Field(f"train-{id_prefix}", (f"{prefix}.train",), f"Train {label_prefix}", f"Enable training of {label_prefix}", "toggle"))
            f_list.append(Field(f"{id_prefix}-gradient-checkpointing", (f"{prefix}.gradient_checkpointing",), "Gradient Checkpointing", f"Enable gradient checkpointing for {label_prefix}", "toggle"))
            if supp_offload:
                f_list.append(Field(f"{id_prefix}-offload-fraction", (f"{prefix}.offload_fraction",), "Layer Offload Fraction", f"Fraction of layers to offload to RAM for {label_prefix}", "number"))
            f_list.append(Field(f"{id_prefix}-stop-after", (f"{prefix}.stop_training_after",), "Stop Training After", f"Stop training {label_prefix} after N steps or ratio", "number"))
            f_list.append(Field(f"{id_prefix}-lr", (f"{prefix}.learning_rate",), f"{label_prefix} Learning Rate", f"Learning rate for {label_prefix}", "number"))
            if supp_seq_len:
                f_list.append(Field(f"{id_prefix}-sequence-length", (f"{prefix}_sequence_length",), f"{label_prefix} Sequence Length", f"Sequence length for {label_prefix}", "number"))
            groups.append(Group(f"{prefix}_settings", f"{label_prefix} Settings", tuple(f_list)))
    elif model_type.is_stable_diffusion_xl():
        te_fields = [
            Field("train-text-encoder", ("text_encoder.train",), "Train Text Encoder 1", "Enable training of Text Encoder 1", "toggle"),
            Field("text-encoder-gradient-checkpointing", ("text_encoder.gradient_checkpointing",), "Gradient Checkpointing", "Enable gradient checkpointing for TE1", "toggle"),
            Field("text-encoder-stop-after", ("text_encoder.stop_training_after",), "Stop Training After", "Stop training TE1 after N steps or ratio", "number"),
            Field("text-encoder-lr", ("text_encoder.learning_rate",), "TE1 Learning Rate", "Learning rate for TE1", "number"),
            Field("train-text-encoder-2", ("text_encoder_2.train",), "Train Text Encoder 2", "Enable training of Text Encoder 2", "toggle"),
            Field("text-encoder-2-gradient-checkpointing", ("text_encoder_2.gradient_checkpointing",), "Gradient Checkpointing", "Enable gradient checkpointing for TE2", "toggle"),
            Field("text-encoder-2-stop-after", ("text_encoder_2.stop_training_after",), "Stop Training After", "Stop training TE2 after N steps or ratio", "number"),
            Field("text-encoder-2-lr", ("text_encoder_2.learning_rate",), "TE2 Learning Rate", "Learning rate for TE2", "number"),
            Field("text-encoder-layer-skip", ("text_encoder_layer_skip",), "Text Encoder Layer Skip", "Number of layers to skip in Text Encoders", "number"),
            Field("text-encoder-caption-dropout", ("text_encoder.dropout_probability",), "Caption Dropout Probability", "Probability of dropping captions during training", "number"),
        ]
        groups.append(Group("text_encoders", "Text Encoder Settings", tuple(te_fields)))
    else:
        supports_training = not (model_type.is_z_image() or model_type.is_anima() or model_type.is_krea2() or model_type.is_flux_2() or model_type.is_ernie() or model_type.is_ideogram())
        supports_clip_skip = model_type.is_stable_diffusion() or model_type.is_wuerstchen() or model_type.is_pixart_alpha() or model_type.is_chroma() or model_type.is_sana()
        supports_sequence_length = model_type.is_flux_2()
        supports_offload = model_type.is_z_image() or model_type.is_pixart_alpha() or model_type.is_chroma() or model_type.is_qwen() or model_type.is_anima() or model_type.is_krea2() or model_type.is_ernie() or model_type.is_ideogram() or model_type.is_sana() or model_type.is_flux_2()
        supports_dropout = not model_type.is_ideogram()

        te_fields = []
        if supports_training:
            te_fields.append(Field("train-text-encoder", ("text_encoder.train",), "Train Text Encoder", "Enable training of Text Encoder", "toggle"))
        te_fields.append(Field("text-encoder-gradient-checkpointing", ("text_encoder.gradient_checkpointing",), "Gradient Checkpointing", "Enable gradient checkpointing for Text Encoder", "toggle"))
        if supports_offload:
            te_fields.append(Field("text-encoder-offload-fraction", ("text_encoder.offload_fraction",), "Layer Offload Fraction", "Fraction of layers to offload to RAM", "number"))
        if supports_training:
            te_fields.append(Field("text-encoder-stop-after", ("text_encoder.stop_training_after",), "Stop Training After", "Stop training Text Encoder after N steps or ratio", "number"))
            te_fields.append(Field("text-encoder-lr", ("text_encoder.learning_rate",), "Text Encoder Learning Rate", "Learning rate for Text Encoder", "number"))
        if supports_clip_skip:
            te_fields.append(Field("text-encoder-layer-skip", ("text_encoder_layer_skip",), "Text Encoder Layer Skip", "Number of layers to skip in Text Encoder", "number"))
        if supports_sequence_length:
            te_fields.append(Field("text-encoder-sequence-length", ("text_encoder_sequence_length",), "Text Encoder Sequence Length", "Sequence length for Text Encoder", "number"))
        if supports_dropout:
            te_fields.append(Field("text-encoder-caption-dropout", ("text_encoder.dropout_probability",), "Caption Dropout Probability", "Probability of dropping captions", "number"))
        groups.append(Group("text_encoders", "Text Encoder Settings", tuple(te_fields)))

    # 3. Embeddings
    supports_embeddings = model_type.is_stable_diffusion() or model_type.is_stable_diffusion_3() or model_type.is_stable_diffusion_xl() or model_type.is_wuerstchen() or model_type.is_pixart_alpha() or model_type.is_flux_1() or model_type.is_chroma() or model_type.is_sana() or model_type.is_hunyuan_video() or model_type.is_hi_dream()
    if supports_embeddings:
        emb_fields = [
            Field("training-embedding-lr", ("embedding_learning_rate",), "Embedding Learning Rate", "Learning rate for textual inversion embeddings", "number"),
            Field("training-preserve-embedding-norm", ("preserve_embedding_norm",), "Preserve Embedding Norm", "Keep norm of trained embedding tokens close to initial norm", "toggle"),
        ]
        groups.append(Group("embeddings", "Embedding Settings", tuple(emb_fields)))

    # 4. Execution & Environment
    supports_circular_padding = model_type.is_stable_diffusion() or model_type.is_stable_diffusion_xl() or model_type.is_wuerstchen()
    video_training = model_type.is_hunyuan_video()

    exec_fields = [
        Field("attention-mechanism", ("attention_mechanism",), "Attention Mechanism", "Attention implementation engine", "select"),
        Field("ema", ("ema",), "EMA Mode", "Exponential Moving Average mode", "select"),
        Field("ema-decay", ("ema_decay",), "EMA Decay", "Decay rate for Exponential Moving Average", "number"),
        Field("ema-update-interval", ("ema_update_step_interval",), "EMA Update Interval", "Step interval for EMA updates", "number"),
        Field("train-dtype", ("train_dtype",), "Train Dtype", "Data type for training computations", "select"),
        Field("fallback-train-dtype", ("fallback_train_dtype",), "Fallback Train Dtype", "Fallback data type for training", "select"),
        Field("autocast-cache", ("enable_autocast_cache",), "Enable Autocast Cache", "Cache autocast linear layers for speedup", "toggle"),
        Field("resolution", ("resolution",), "Resolution", "Training image resolution e.g. 512,512", "text"),
    ]
    if video_training:
        exec_fields.append(Field("frames", ("frames",), "Frames", "Frame count specification for video models", "text"))
    if supports_circular_padding:
        exec_fields.append(Field("force-circular-padding", ("force_circular_padding",), "Force Circular Padding", "Enables circular padding for all conv layers to better train seamless images", "toggle"))
    groups.append(Group("execution", "Execution & Environment", tuple(exec_fields)))

    # 5. Denoising Model
    if model_type.is_stable_diffusion() or model_type.is_stable_diffusion_xl():
        denoising_fields = [
            Field("train-unet", ("unet.train",), "Train UNet", "Enable training of UNet model", "toggle"),
            Field("unet-gradient-checkpointing", ("unet.gradient_checkpointing",), "Gradient Checkpointing", "Enable gradient checkpointing for UNet", "toggle"),
            Field("unet-stop-after", ("unet.stop_training_after",), "Stop Training After", "Stop training UNet after N steps or ratio", "number"),
            Field("unet-lr", ("unet.learning_rate",), "UNet Learning Rate", "Learning rate for UNet model", "number"),
            Field("rescale-noise-to-zero-snr", ("rescale_noise_scheduler_to_zero_terminal_snr",), "Rescale to Zero Terminal SNR", "Rescale noise scheduler to zero terminal SNR", "toggle"),
            Field("force-v-prediction", ("force_v_prediction",), "Force V Prediction", "Force V-prediction mode", "toggle"),
            Field("force-epsilon-prediction", ("force_epsilon_prediction",), "Force Epsilon Prediction", "Force Epsilon-prediction mode", "toggle"),
        ]
        groups.append(Group("denoising_model", "Denoising Model (UNet)", tuple(denoising_fields)))
    elif model_type.is_wuerstchen():
        denoising_fields = [
            Field("train-prior", ("prior.train",), "Train Prior", "Enable training of Prior model", "toggle"),
            Field("prior-gradient-checkpointing", ("prior.gradient_checkpointing",), "Gradient Checkpointing", "Enable gradient checkpointing for Prior", "toggle"),
            Field("prior-stop-after", ("prior.stop_training_after",), "Stop Training After", "Stop training Prior after N steps or ratio", "number"),
            Field("prior-lr", ("prior.learning_rate",), "Prior Learning Rate", "Learning rate for Prior model", "number"),
        ]
        groups.append(Group("denoising_model", "Denoising Model (Prior)", tuple(denoising_fields)))
    else:
        supports_guidance_scale = model_type.is_flux_1() or model_type.is_flux_2() or model_type.is_hunyuan_video() or model_type.is_hi_dream()
        denoising_fields = [
            Field("train-transformer", ("transformer.train",), "Train Transformer", "Enable training of Transformer model", "toggle"),
            Field("transformer-gradient-checkpointing", ("transformer.gradient_checkpointing",), "Gradient Checkpointing", "Enable gradient checkpointing for Transformer", "toggle"),
            Field("transformer-offload-fraction", ("transformer.offload_fraction",), "Layer Offload Fraction", "Fraction of layers to offload to RAM", "number"),
            Field("transformer-offload-activations", ("transformer.offload_activations",), "Offload Activations", "Offload activations to CPU memory", "toggle"),
            Field("transformer-stop-after", ("transformer.stop_training_after",), "Stop Training After", "Stop training Transformer after N steps or ratio", "number"),
            Field("transformer-lr", ("transformer.learning_rate",), "Transformer Learning Rate", "Learning rate for Transformer model", "number"),
        ]
        if supports_guidance_scale:
            denoising_fields.append(Field("guidance-scale", ("guidance_scale",), "Guidance Scale", "Guidance scale for transformer models", "number"))
        groups.append(Group("denoising_model", "Denoising Model (Transformer)", tuple(denoising_fields)))

    # 6. Noise & Timesteps
    supports_gen_offset = model_type.is_stable_diffusion() or model_type.is_stable_diffusion_xl()
    supports_dynamic_shift = model_type.is_flux_1() or model_type.is_flux_2() or model_type.is_z_image() or model_type.is_qwen() or model_type.is_anima() or model_type.is_krea2() or model_type.is_ernie() or model_type.is_ideogram()

    noise_fields = [
        Field("offset-noise-weight", ("offset_noise_weight",), "Offset Noise Weight", "Weight for offset noise addition", "number"),
    ]
    if supports_gen_offset:
        noise_fields.append(Field("generalized-offset-noise", ("generalized_offset_noise",), "Generalized Offset Noise", "Enable generalized offset noise calculation", "toggle"))
    noise_fields.extend([
        Field("perturbation-noise-weight", ("perturbation_noise_weight",), "Perturbation Noise Weight", "Weight for input perturbation noise", "number"),
        Field("timestep-distribution", ("timestep_distribution",), "Timestep Distribution", "Distribution mode for sampling timesteps", "select"),
        Field("min-noising-strength", ("min_noising_strength",), "Min Noising Strength", "Minimum noising strength bound", "number"),
        Field("max-noising-strength", ("max_noising_strength",), "Max Noising Strength", "Maximum noising strength bound", "number"),
        Field("noising-weight", ("noising_weight",), "Noising Weight", "Weight parameter for timestep distribution", "number"),
        Field("noising-bias", ("noising_bias",), "Noising Bias", "Bias parameter for timestep distribution", "number"),
        Field("timestep-shift", ("timestep_shift",), "Timestep Shift", "Shift offset for sampling timesteps", "number"),
    ])
    if supports_dynamic_shift:
        noise_fields.append(Field("dynamic-timestep-shifting", ("dynamic_timestep_shifting",), "Dynamic Timestep Shifting", "Enable resolution-based dynamic timestep shifting", "toggle"))
    groups.append(Group("noise_and_timesteps", "Noise & Timesteps", tuple(noise_fields)))

    # 7. Masking & Conditioning
    mask_fields = [
        Field("masked-training", ("masked_training",), "Masked Training", "Enable masked training", "toggle"),
        Field("unmasked-probability", ("unmasked_probability",), "Unmasked Probability", "Probability of sampling unmasked images", "number"),
        Field("unmasked-weight", ("unmasked_weight",), "Unmasked Weight", "Loss weight for unmasked regions", "number"),
        Field("normalize-masked-loss", ("normalize_masked_area_loss",), "Normalize Masked Area Loss", "Normalize loss by area of mask", "toggle"),
        Field("masked-prior-preservation-weight", ("masked_prior_preservation_weight",), "Masked Prior Preservation Weight", "Weight for prior preservation in masked regions", "number"),
        Field("custom-conditioning-image", ("custom_conditioning_image",), "Custom Conditioning Image", "Enable custom conditioning image inputs", "toggle"),
    ]
    groups.append(Group("masking_and_conditioning", "Masking & Conditioning", tuple(mask_fields)))

    # 8. Loss Configuration
    loss_fields = [
        Field("mse-strength", ("mse_strength",), "MSE Loss Strength", "Multiplier for Mean Squared Error loss", "number"),
        Field("mae-strength", ("mae_strength",), "MAE Loss Strength", "Multiplier for Mean Absolute Error loss", "number"),
        Field("log-cosh-strength", ("log_cosh_strength",), "Log-Cosh Loss Strength", "Multiplier for Log-Cosh loss", "number"),
        Field("huber-strength", ("huber_strength",), "Huber Loss Strength", "Multiplier for Huber loss", "number"),
        Field("huber-delta", ("huber_delta",), "Huber Delta", "Delta parameter for Huber loss", "number"),
        Field("vb-loss-strength", ("vb_loss_strength",), "VB Loss Strength", "Multiplier for Variational Bound loss", "number"),
        Field("loss-weight-fn", ("loss_weight_fn",), "Loss Weight Function", "Loss weighting strategy", "select"),
        Field("loss-weight-strength", ("loss_weight_strength",), "Loss Weight Strength", "Strength multiplier for loss weight function", "number"),
        Field("loss-scaler", ("loss_scaler",), "Loss Scaler", "Dynamic or fixed loss scaling strategy", "select"),
    ]
    groups.append(Group("loss", "Loss Configuration", tuple(loss_fields)))

    # 9. Layer Filtering
    layer_fields = [
        Field("layer-filter-preset", ("layer_filter_preset",), "Layer Filter Preset", "Preset name for layer filtering", "text"),
        Field("layer-filter", ("layer_filter",), "Layer Filter", "Comma-separated list of target layers", "text"),
        Field("layer-filter-regex", ("layer_filter_regex",), "Layer Filter Regex", "Treat layer filter pattern as regular expression", "toggle"),
    ]
    groups.append(Group("layer_filtering", "Layer Filtering", tuple(layer_fields)))

    return Tab("training", "Training", tuple(groups))
