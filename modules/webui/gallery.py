import contextlib
import hashlib
import json
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from modules.util.config.SampleConfig import SampleConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.enum.EMAMode import EMAMode
from modules.webui.atomic_io import write_json_atomic

SampleVariant = Literal["base", "ema", "non_ema"]
SampleStatus = Literal["pending", "ready", "unavailable", "error"]


@dataclass(frozen=True)
class TrainingProgressSnapshot:
    epoch: int
    epoch_step: int
    global_step: int


@dataclass(frozen=True)
class FileSignature:
    mtime_ns: int
    size: int
    sha256: str


@dataclass(frozen=True)
class GalleryImage:
    path: Path
    media_type: str
    etag: str


class GalleryNotFound(LookupError):
    pass


def _file_signature(path: Path) -> FileSignature:
    stat = path.stat()
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1024 * 1024):
            digest.update(chunk)
    return FileSignature(
        mtime_ns=stat.st_mtime_ns,
        size=stat.st_size,
        sha256=digest.hexdigest(),
    )


def _expected_variants(config: TrainConfig) -> list[SampleVariant]:
    if config.ema == EMAMode.OFF:
        return ["base"]
    if config.non_ema_sampling:
        return ["ema", "non_ema"]
    return ["ema"]


def _normalize_definitions(definitions: list[dict[str, Any]], config: TrainConfig) -> list[dict[str, Any]]:
    normalized_definitions: list[dict[str, Any]] = []
    for source_index, source in enumerate(definitions):
        sample = SampleConfig.default_values(config.model_type).from_dict(source)
        sample.from_train_config(config)
        effective = {**source, **sample.to_dict()}
        effective["webui_id"] = source["webui_id"]
        effective["source_index"] = source_index
        normalized_definitions.append(effective)
    return normalized_definitions


def _revision_id(definitions: list[dict[str, Any]]) -> str:
    encoded = json.dumps(definitions, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


class GalleryService:
    def __init__(
        self,
        root_dir: Path,
        workspace_provider: Callable[[], str | Path],
        warning_sink: Callable[[str, dict[str, Any]], None] | None = None,
        thumbnail_max_size: tuple[int, int] = (512, 512),
    ) -> None:
        self._root_dir = root_dir.resolve()
        self._workspace_provider = workspace_provider
        self._warning_sink = warning_sink
        self._thumbnail_max_size = thumbnail_max_size
        self._lock = threading.RLock()

        self._active_config: TrainConfig | None = None
        self._active_workspace: Path | None = None
        self._active_run_key: str | None = None
        self._active_run_dir: Path | None = None
        self._active_batch_id: int | None = None
        self._started_at: datetime | None = None
        self._started_at_str: str | None = None
        self._resolution_attempted: bool = False
        self._disabled: bool = False
        self._config_signatures: dict[str, FileSignature] = {}
        self._resolved_config_filename: str | None = None

    @property
    def active_run_key(self) -> str | None:
        with self._lock:
            return self._active_run_key

    @property
    def active_run_dir(self) -> Path | None:
        with self._lock:
            return self._active_run_dir

    def begin_training(self, config: TrainConfig, *, started_at: datetime | None = None) -> None:
        with self._lock:
            self._active_config = config
            raw_ws = self._workspace_provider()
            ws_path = Path(raw_ws)
            ws_path = (self._root_dir / ws_path).resolve() if not ws_path.is_absolute() else ws_path.resolve()
            self._active_workspace = ws_path
            self._active_run_key = None
            self._active_run_dir = None
            self._active_batch_id = None
            self._resolution_attempted = False
            self._disabled = False
            self._resolved_config_filename = None

            now = started_at or datetime.now(timezone.utc)
            self._started_at = now
            self._started_at_str = now.isoformat()

            self._config_signatures.clear()
            config_dir = ws_path / "config"
            if config_dir.is_dir():
                for item in config_dir.iterdir():
                    if item.is_file() and item.suffix.lower() == ".json":
                        with contextlib.suppress(OSError):
                            self._config_signatures[item.name] = _file_signature(item)

    def _resolve_run(self, config: TrainConfig) -> None:
        ws = self._active_workspace
        if ws is None:
            self._disabled = True
            return

        config_dir = ws / "config"
        if not config_dir.is_dir():
            if self._warning_sink:
                self._warning_sink(
                    "Gallery persistence disabled: missing core config candidate",
                    {"workspace": str(ws)},
                )
            self._disabled = True
            return

        prefix = config.save_filename_prefix or ""
        candidates: list[Path] = []

        for item in config_dir.iterdir():
            if not (item.is_file() and item.suffix.lower() == ".json"):
                continue
            if prefix and not item.name.startswith(prefix):
                continue

            # Candidate must be new or changed signature
            if item.name not in self._config_signatures:
                candidates.append(item)
            else:
                with contextlib.suppress(OSError):
                    current_sig = _file_signature(item)
                    if current_sig != self._config_signatures[item.name]:
                        candidates.append(item)

        if len(candidates) == 0:
            if self._warning_sink:
                self._warning_sink(
                    "Gallery persistence disabled: missing core config candidate",
                    {"workspace": str(ws)},
                )
            self._disabled = True
            return

        if len(candidates) > 1:
            if self._warning_sink:
                self._warning_sink(
                    "Gallery persistence disabled: ambiguous core config candidate",
                    {"workspace": str(ws)},
                )
            self._disabled = True
            return

        candidate = candidates[0]
        run_key = candidate.stem
        target_dir = ws / "web" / "samples" / run_key
        manifest_path = target_dir / "manifest.json"

        if manifest_path.exists():
            existing_started_at: str | None = None
            with contextlib.suppress(Exception):
                data = json.loads(manifest_path.read_text(encoding="utf-8"))
                existing_started_at = data.get("run", {}).get("started_at")

            if existing_started_at != self._started_at_str:
                if self._warning_sink:
                    self._warning_sink(
                        "Gallery persistence disabled: run key collision",
                        {"run_key": run_key},
                    )
                self._disabled = True
                return

        self._active_run_key = run_key
        self._active_run_dir = target_dir
        self._resolved_config_filename = candidate.name

    def begin_batch(
        self,
        definitions: list[dict[str, Any]],
        config: TrainConfig,
        progress: TrainingProgressSnapshot,
    ) -> int | None:
        with self._lock:
            if self._active_workspace is None:
                return None

            if self._active_run_key is None:
                if self._disabled or self._resolution_attempted:
                    return None
                self._resolution_attempted = True
                self._resolve_run(config)
                if self._active_run_key is None:
                    return None

            run_dir = self._active_run_dir
            assert run_dir is not None
            run_dir.mkdir(parents=True, exist_ok=True)

            normalized_defs = _normalize_definitions(definitions, config)
            rev_id = _revision_id(normalized_defs)

            prompts_path = run_dir / "prompts.json"
            prompts_doc: dict[str, Any] = {"schema_version": 1, "revisions": {}}
            if prompts_path.exists():
                with contextlib.suppress(Exception):
                    prompts_doc = json.loads(prompts_path.read_text(encoding="utf-8"))

            if "revisions" not in prompts_doc:
                prompts_doc["revisions"] = {}

            if rev_id not in prompts_doc["revisions"]:
                prompts_doc["revisions"][rev_id] = {
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                    "prompts": normalized_defs,
                }
            write_json_atomic(prompts_path, prompts_doc)

            manifest_path = run_dir / "manifest.json"
            manifest_doc: dict[str, Any] = {
                "schema_version": 1,
                "run": {
                    "key": self._active_run_key,
                    "config_filename": self._resolved_config_filename or "",
                    "started_at": self._started_at_str,
                },
                "batches": [],
            }
            if manifest_path.exists():
                with contextlib.suppress(Exception):
                    manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))

            if "batches" not in manifest_doc or not isinstance(manifest_doc["batches"], list):
                manifest_doc["batches"] = []

            batch_id = len(manifest_doc["batches"]) + 1
            exp_variants = _expected_variants(config)

            sample_slots: list[dict[str, Any]] = []
            for prompt_item in normalized_defs:
                if prompt_item.get("enabled", True):
                    sample_slots.extend(
                        {
                            "webui_prompt_id": prompt_item["webui_id"],
                            "source_index": prompt_item["source_index"],
                            "variant": var,
                            "status": "pending",
                            "filename": None,
                            "thumbnail_filename": None,
                            "etag": None,
                            "thumbnail_etag": None,
                        }
                        for var in exp_variants
                    )

            new_batch = {
                "batch_id": batch_id,
                "prompt_revision_id": rev_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "progress": {
                    "epoch": progress.epoch,
                    "epoch_step": progress.epoch_step,
                    "global_step": progress.global_step,
                },
                "expected_variants": exp_variants,
                "samples": sample_slots,
                "unassigned_errors": [],
            }

            manifest_doc["batches"].append(new_batch)
            write_json_atomic(manifest_path, manifest_doc)

            self._active_batch_id = batch_id
            return batch_id

    def finish_batch(self) -> None:
        with self._lock:
            if self._active_run_dir is None or self._active_batch_id is None:
                return
            manifest_path = self._active_run_dir / "manifest.json"
            if not manifest_path.exists():
                self._active_batch_id = None
                return
            try:
                manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
                batches = manifest_doc.get("batches", [])
                for batch in batches:
                    if batch.get("batch_id") == self._active_batch_id:
                        for sample in batch.get("samples", []):
                            if sample.get("status") == "pending":
                                sample["status"] = "unavailable"
                        break
                write_json_atomic(manifest_path, manifest_doc)
            except Exception:
                pass
            finally:
                self._active_batch_id = None

    def finish_training(self) -> None:
        with self._lock:
            if self._active_batch_id is not None:
                self.finish_batch()
            self._active_config = None
            self._active_workspace = None
            self._active_run_key = None
            self._active_run_dir = None
            self._active_batch_id = None
            self._started_at = None
            self._started_at_str = None
            self._resolution_attempted = False
            self._disabled = False
            self._config_signatures.clear()
            self._resolved_config_filename = None
