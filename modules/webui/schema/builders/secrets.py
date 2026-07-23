from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_secrets_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
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
    )
