from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.types import Field, Group, Tab


def build_cloud_tab(model_type: ModelType, training_method: TrainingMethod) -> Tab:
    return Tab(
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
    )
