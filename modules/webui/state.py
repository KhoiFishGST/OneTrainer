from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from modules.webui.config_service import ConfigService
    from modules.webui.directories import DirectoryService
    from modules.webui.events import EventHub
    from modules.webui.gallery import GalleryService
    from modules.webui.media import MediaService
    from modules.webui.presets import PresetService
    from modules.webui.sampling_coordinator import SamplingCoordinator
    from modules.webui.schema import SchemaRegistry
    from modules.webui.settings_store import SettingsStore
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
    gallery: "GalleryService | None" = None
    sampling: "SamplingCoordinator | None" = None
    media: "MediaService | None" = None
    media_service: "MediaService | None" = None
    store: "SettingsStore | None" = None

    def __post_init__(self) -> None:
        if self.media_service is None and self.media is not None:
            self.media_service = self.media
        elif self.media is None and self.media_service is not None:
            self.media = self.media_service

    @property
    def config_service(self) -> "ConfigService":
        return self.config

    @property
    def training_service(self) -> "TrainingService":
        if self.training is None:
            raise RuntimeError("TrainingService is not initialized on AppState")
        return self.training

    @property
    def gallery_service(self) -> "GalleryService":
        if self.gallery is None:
            raise RuntimeError("GalleryService is not initialized on AppState")
        return self.gallery

    @property
    def sampling_coordinator(self) -> "SamplingCoordinator":
        if self.sampling is None:
            raise RuntimeError("SamplingCoordinator is not initialized on AppState")
        return self.sampling

    @property
    def settings_store(self) -> "SettingsStore":
        if self.store is None:
            raise RuntimeError("SettingsStore is not initialized on AppState")
        return self.store

