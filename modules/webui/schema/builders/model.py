from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_model_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    parts = model_type.model_parts()

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
        if model_type.is_stable_cascade():
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
    has_multiple = model_type.has_multiple_text_encoders()
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
