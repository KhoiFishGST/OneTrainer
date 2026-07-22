from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from modules.webui.config_service import ConfigService
    from modules.webui.directories import DirectoryService
    from modules.webui.events import EventHub
    from modules.webui.presets import PresetService
    from modules.webui.schema import SchemaRegistry


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
