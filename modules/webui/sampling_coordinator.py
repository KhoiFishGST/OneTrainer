import contextlib
import json
import threading
import uuid
from collections.abc import Callable, Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from modules.modelSampler.BaseModelSampler import ModelSamplerOutput
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.atomic_io import write_json_atomic
from modules.webui.gallery import GalleryService, TrainingProgressSnapshot


@dataclass(frozen=True)
class PromptDefinitionsState:
    samples: list[dict[str, Any]]
    queued: bool


class PromptDefinitionsError(ValueError):
    pass


class PromptPersistenceError(OSError):
    pass


def _normalize_ids(samples: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source in samples:
        if not isinstance(source, Mapping):
            raise PromptDefinitionsError("Each sample definition must be an object")
        sample = deepcopy(dict(source))
        candidate = sample.get("webui_id")
        if not isinstance(candidate, str) or not candidate.startswith("prompt_") or candidate in seen:
            candidate = f"prompt_{uuid.uuid4().hex}"
        sample["webui_id"] = candidate
        seen.add(candidate)
        normalized.append(sample)
    return normalized


class SamplingCoordinator:
    def __init__(
        self,
        root_dir: Path,
        sample_path_provider: Callable[[], Path | None],
        gallery: GalleryService,
    ) -> None:
        self._root_dir = Path(root_dir).resolve()
        self._sample_path_provider = sample_path_provider
        self._gallery = gallery
        self._lock = threading.RLock()
        self._active_config: TrainConfig | None = None
        self._sampling_active: bool = False
        self._batch_open: bool = False

    def _resolve_prompt_path(self) -> Path | None:
        if self._active_config is not None:
            file_name = getattr(self._active_config, "sample_definition_file_name", None)
            if file_name:
                path = Path(file_name)
                if not path.is_absolute():
                    path = self._root_dir / path
                return path
        path = self._sample_path_provider()
        if path is not None and not path.is_absolute():
            path = self._root_dir / path
        return path

    def _is_queued(self) -> bool:
        return self._sampling_active or bool(
            self._active_config is not None and getattr(self._active_config, "samples", None)
        )

    def get_definitions(self) -> PromptDefinitionsState:
        with self._lock:
            path = self._resolve_prompt_path()
            samples: list[dict[str, Any]] = []
            if path is not None:
                pending_path = Path(f"{path}.webui-pending")
                target_path = pending_path if pending_path.exists() else path
                if target_path.exists():
                    with contextlib.suppress(Exception), target_path.open("r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            samples = data
            elif self._active_config is not None and getattr(self._active_config, "samples", None):
                samples = [s.to_dict() if hasattr(s, "to_dict") else dict(s) for s in self._active_config.samples]

            normalized = _normalize_ids(samples)
            return PromptDefinitionsState(samples=normalized, queued=self._is_queued())

    def put_definitions(self, samples: Sequence[Mapping[str, Any]]) -> PromptDefinitionsState:
        with self._lock:
            normalized = _normalize_ids(samples)
            path = self._resolve_prompt_path()
            if path is None:
                raise PromptPersistenceError("No sample definition path configured")

            queued = self._is_queued()
            try:
                if queued:
                    pending_path = Path(f"{path}.webui-pending")
                    write_json_atomic(pending_path, normalized)
                else:
                    write_json_atomic(path, normalized)
                    pending_path = Path(f"{path}.webui-pending")
                    pending_path.unlink(missing_ok=True)
            except OSError as e:
                raise PromptPersistenceError(str(e)) from e

            return PromptDefinitionsState(samples=normalized, queued=queued)

    def recover_pending(self) -> None:
        with self._lock:
            path = self._resolve_prompt_path()
            if path is None:
                return
            pending_path = Path(f"{path}.webui-pending")
            if pending_path.exists():
                try:
                    with pending_path.open("r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, list):
                        normalized = _normalize_ids(data)
                        write_json_atomic(path, normalized)
                    pending_path.unlink(missing_ok=True)
                except OSError as e:
                    raise PromptPersistenceError(str(e)) from e

    def begin_training(self, config: TrainConfig) -> None:
        with self._lock:
            self._active_config = config
            self.recover_pending()
            self._gallery.begin_training(config)

    def on_status(self, status: str, progress: TrainingProgressSnapshot) -> None:
        with self._lock:
            is_sampling = status.startswith("Sampling")
            if is_sampling:
                if not self._batch_open:
                    self._sampling_active = True
                    self._batch_open = True
                    if self._active_config is not None and getattr(self._active_config, "samples", None):
                        raw_samples = [
                            s.to_dict() if hasattr(s, "to_dict") else dict(s)
                            for s in self._active_config.samples
                        ]
                        defs = _normalize_ids(raw_samples)
                    else:
                        state = self.get_definitions()
                        defs = state.samples
                        path = self._resolve_prompt_path()
                        if path and path.exists():
                            with contextlib.suppress(OSError):
                                write_json_atomic(path, defs)

                    self._gallery.begin_batch(defs, self._active_config, progress)
            else:
                if self._batch_open:
                    self._gallery.finish_batch()
                    self._batch_open = False
                    self.recover_pending()
                    self._sampling_active = False

    def on_default_sample(self, sampler_output: ModelSamplerOutput) -> dict[str, Any] | None:
        with self._lock:
            return self._gallery.record_default_sample(sampler_output)

    def finish_training(self) -> None:
        with self._lock:
            try:
                if self._batch_open:
                    with contextlib.suppress(Exception):
                        self._gallery.finish_batch()
                    self._batch_open = False
                    with contextlib.suppress(Exception):
                        self.recover_pending()
                    self._sampling_active = False
                self._gallery.finish_training()
            finally:
                self._active_config = None
