from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_lora_embedding_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
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
    )
