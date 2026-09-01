from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_embeddings_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
        "embeddings",
        "Embeddings",
        (
            Group(
                "embeddings",
                "Textual Inversion Embeddings",
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
                        "embedding-weight-dtype",
                        ("embedding_weight_dtype",),
                        "Embedding Weight Data Type",
                        "Data type for saving textual inversion embeddings",
                        "select",
                    ),
                ),
            ),
        ),
    )
