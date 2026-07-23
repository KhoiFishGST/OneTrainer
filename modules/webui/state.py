from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from modules.webui.config_service import ConfigService
    from modules.webui.directories import DirectoryService
    from modules.webui.events import EventHub
    from modules.webui.presets import PresetService
    from modules.webui.schema import SchemaRegistry
    from modules.webui.training import TrainingService


@dataclass(frozen=True)
class WebUISettings:
    root_dir: Path
    config_path: Path
    secrets_path: Path
    presets_dir: Path
    static_dir: Path
    dev: bool = False
    allowed_dev_origin: str = "http://localhost:5173"


@dataclass
class AppState:
    settings: WebUISettings
    config: "ConfigService"
    schema: "SchemaRegistry"
    presets: "PresetService"
    directories: "DirectoryService"
    events: "EventHub | None" = None
    version: str = "unknown"
    warnings: list[str] = field(default_factory=list)
    capture: Any | None = None
    training: "TrainingService | None" = None

    @property
    def config_service(self) -> "ConfigService":
        return self.config

    @property
    def training_service(self) -> "TrainingService":
        if self.training is None:
            raise RuntimeError("TrainingService is not initialized on AppState")
        return self.training


