import asyncio
import json
import logging
import uuid
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path

from typing import Any, Optional

from modules.util.config.config_io import load_secrets, load_train_config, save_settings
from modules.util.config.TrainConfig import TrainConfig
from modules.util.path_util import write_json_atomic
from modules.webui.config_codec import decode_settings_document
from modules.webui.state import WebUISettings

logger = logging.getLogger(__name__)


class ConceptDictWrapper:
    def __init__(self, data: dict):
        self._data = data

    def to_dict(self) -> dict:
        return self._data


def _wrap_concept(item: Any) -> Any:
    if hasattr(item, "to_dict"):
        return item
    if isinstance(item, dict):
        return ConceptDictWrapper(item)
    return item


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
        self._concepts: list | None = None


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

    def get_config(self) -> TrainConfig:
        return self._config

    def _resolve_concept_file_path(self) -> Path | None:
        if not getattr(self._config, "concept_file_name", None):
            return None
        path = Path(self._config.concept_file_name)
        if not path.is_absolute():
            path = self.settings.root_dir / path
        return path

    async def get_concepts(self) -> list:
        async with self._lock:
            if self._concepts is None:
                if getattr(self._config, "concepts", None) is not None:
                    if isinstance(self._config.concepts, list):
                        self._concepts = [
                            c.to_dict() if hasattr(c, "to_dict") else c
                            for c in self._config.concepts
                        ]
                    else:
                        self._concepts = []
                else:
                    concept_path = self._resolve_concept_file_path()
                    if concept_path and concept_path.exists():
                        try:
                            with open(concept_path, "r", encoding="utf-8") as f:
                                loaded = json.load(f)
                                self._concepts = loaded if isinstance(loaded, list) else []
                        except Exception:
                            self._concepts = []
                    else:
                        self._concepts = []
            return deepcopy(self._concepts)

    async def update_concepts(self, concepts: list) -> list:
        async with self._lock:
            self._concepts = [c.to_dict() if hasattr(c, "to_dict") else deepcopy(c) for c in concepts]
            self._config.concepts = [_wrap_concept(c) for c in concepts]

            concept_path = self._resolve_concept_file_path()
            if concept_path:
                concept_path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    write_json_atomic(str(concept_path), self._concepts)
                except Exception as error:
                    logger.warning(f"Could not save concepts file: {error}")

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

        return deepcopy(self._concepts)

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
            self._concepts = None
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

    def _resolve_sample_file_path(self) -> Optional[Path]:
        if not self._config:
            return None
        file_name = getattr(self._config, "sample_definition_file_name", None) or "training_samples/samples.json"
        path = Path(file_name)
        if not path.is_absolute() and self.settings.config_path:
            path = self.settings.config_path.parent / path
        return path

    async def get_sample_definitions(self) -> list:
        async with self._lock:
            if self._config and getattr(self._config, "samples", None):
                return [s.to_dict() if hasattr(s, "to_dict") else deepcopy(s) for s in self._config.samples]
            sample_path = self._resolve_sample_file_path()
            if sample_path and sample_path.exists():
                try:
                    with open(sample_path, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                        return loaded if isinstance(loaded, list) else []
                except Exception:
                    return []
            return []

    async def update_sample_definitions(self, samples: list) -> list:
        async with self._lock:
            clean_samples = [s.to_dict() if hasattr(s, "to_dict") else deepcopy(s) for s in samples]
            sample_path = self._resolve_sample_file_path()
            if sample_path:
                sample_path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    write_json_atomic(str(sample_path), clean_samples)
                except Exception as error:
                    logger.warning(f"Could not save samples file: {error}")
            return clean_samples

