import asyncio
import logging
import uuid
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass

from modules.util.config.config_io import load_secrets, load_train_config, save_settings
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_codec import decode_settings_document
from modules.webui.state import WebUISettings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ConfigSnapshot:
    config: dict[str, object]
    revision: str


class RevisionConflict(Exception):
    def __init__(self, current: ConfigSnapshot):
        super().__init__("Config revision is stale")
        self.current = current


class ConfigPersistenceError(Exception):
    pass


class ConfigService:
    def __init__(self, settings: WebUISettings, config: TrainConfig, warnings: list[str]):
        self.settings = settings
        self._config = config
        self._warnings = warnings
        self._instance_id = uuid.uuid4().hex
        self._counter = 0
        self._lock = asyncio.Lock()
        self._change_listeners: list[Callable] = []

    @classmethod
    def load(cls, settings: WebUISettings) -> "ConfigService":
        warnings: list[str] = []
        try:
            config = load_train_config(settings.config_path, settings.secrets_path)
        except Exception as error:
            warnings.append(f"Could not load last-session config: {error}")
            config = None
        if config is None:
            # A missing or malformed last-session file must not discard secrets.json:
            # fall back to default settings but still load secrets independently.
            config = TrainConfig.default_values()
            try:
                secrets = load_secrets(settings.secrets_path)
                if secrets is not None:
                    config.secrets = secrets
            except Exception as error:
                warnings.append(f"Could not load secrets: {error}")
        return cls(settings, config, warnings)

    def _revision(self) -> str:
        return f"{self._instance_id}:{self._counter}"

    def _snapshot_unlocked(self) -> ConfigSnapshot:
        return ConfigSnapshot(deepcopy(self._config.to_settings_dict(secrets=False)), self._revision())

    async def snapshot(self) -> ConfigSnapshot:
        async with self._lock:
            return self._snapshot_unlocked()

    async def replace_config(
        self, config: TrainConfig, expected_revision: str, overwrite: bool = False
    ) -> ConfigSnapshot:
        async with self._lock:
            if self._revision() != expected_revision:
                raise RevisionConflict(self._snapshot_unlocked())

            config.secrets = deepcopy(self._config.secrets)
            try:
                save_settings(config, self.settings.config_path)
            except OSError as error:
                raise ConfigPersistenceError(f"Could not save config: {error}") from error

            self._config = config
            self._counter += 1
            snapshot = self._snapshot_unlocked()
            listeners = list(self._change_listeners)

        async def _notify(listener):
            try:
                res = listener(snapshot)
                if asyncio.iscoroutine(res):
                    await res
            except Exception:
                logger.exception("Error in config change listener")

        for listener in listeners:
            await _notify(listener)

        return snapshot

    async def replace(self, document: object, expected_revision: str, overwrite: bool = False) -> ConfigSnapshot:
        async with self._lock:
            current_secrets = deepcopy(self._config.secrets)
        config = decode_settings_document(document, current_secrets)
        return await self.replace_config(config, expected_revision, overwrite=overwrite)

    async def overwrite(self, document: object, expected_revision: str) -> ConfigSnapshot:
        return await self.replace(document, expected_revision, overwrite=True)

    @property
    def warnings(self) -> list[str]:
        return list(self._warnings)

    @property
    def current_workspace(self) -> str:
        return self._config.workspace_dir

    def add_change_listener(self, listener: Callable) -> None:
        if listener not in self._change_listeners:
            self._change_listeners.append(listener)

    def remove_change_listener(self, listener: Callable) -> None:
        if listener in self._change_listeners:
            self._change_listeners.remove(listener)
