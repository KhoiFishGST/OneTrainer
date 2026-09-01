from collections.abc import Callable

from modules.util.enum.ModelType import ModelType
from modules.util.enum.TrainingMethod import TrainingMethod
from modules.webui.schema.builders.backup import build_backup_tab
from modules.webui.schema.builders.data import build_data_tab
from modules.webui.schema.builders.embeddings import build_embeddings_tab
from modules.webui.schema.builders.general import build_general_tab
from modules.webui.schema.builders.lora_embedding import build_lora_embedding_tab
from modules.webui.schema.builders.model import build_model_tab
from modules.webui.schema.builders.sampling import build_sampling_tab
from modules.webui.schema.builders.secrets import build_secrets_tab
from modules.webui.schema.builders.training import build_training_tab
from modules.webui.schema.types import Tab

TAB_BUILDERS: list[tuple[str, Callable[[ModelType, TrainingMethod], Tab]]] = [
    ("general", build_general_tab),
    ("model", build_model_tab),
    ("training", build_training_tab),
    ("sampling", build_sampling_tab),
    ("lora_embedding", build_lora_embedding_tab),
    ("embeddings", build_embeddings_tab),
    ("data", build_data_tab),
    ("backup", build_backup_tab),
    ("secrets", build_secrets_tab),
]
