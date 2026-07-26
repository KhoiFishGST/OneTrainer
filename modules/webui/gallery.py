import contextlib
import hashlib
import json
import mimetypes
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from modules.modelSampler.BaseModelSampler import ModelSamplerOutput
from modules.util import path_util
from modules.util.config.SampleConfig import SampleConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.enum.EMAMode import EMAMode
from modules.util.enum.FileType import FileType
from modules.webui.atomic_io import copy_file_atomic, save_pil_atomic, write_json_atomic

from PIL import Image

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
        self._last_run_key: str | None = None
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
            self._last_run_key = None
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
            self._last_run_key = self._active_run_key
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

    def _record_unassigned_error(self, filename: str, error: str) -> None:
        if self._active_run_dir is None or self._active_batch_id is None:
            return
        manifest_path = self._active_run_dir / "manifest.json"
        if not manifest_path.exists():
            return
        with contextlib.suppress(Exception):
            doc = json.loads(manifest_path.read_text(encoding="utf-8"))
            for batch in doc.get("batches", []):
                if batch.get("batch_id") == self._active_batch_id:
                    batch.setdefault("unassigned_errors", []).append({
                        "filename": filename,
                        "error": error,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    break
            write_json_atomic(manifest_path, doc)

    def record_default_sample(self, sampler_output: ModelSamplerOutput) -> dict[str, Any] | None:
        with self._lock:
            if self._active_run_dir is None or self._active_batch_id is None:
                return None

            if getattr(sampler_output, "file_type", None) != FileType.IMAGE:
                return None

            filepath = getattr(sampler_output, "filepath", None)
            if not filepath or not isinstance(filepath, str):
                return None

            source = Path(filepath).resolve()
            if not source.exists() or not source.is_file():
                return None

            if self._active_workspace is None:
                return None

            ws_samples = (self._active_workspace / "samples").resolve()
            try:
                source.relative_to(ws_samples)
            except ValueError:
                return None

            manifest_path = self._active_run_dir / "manifest.json"
            prompts_path = self._active_run_dir / "prompts.json"
            if not manifest_path.exists() or not prompts_path.exists():
                return None

            try:
                manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
                prompts_doc = json.loads(prompts_path.read_text(encoding="utf-8"))
            except Exception:
                return None

            active_batch = None
            for b in manifest_doc.get("batches", []):
                if b.get("batch_id") == self._active_batch_id:
                    active_batch = b
                    break

            if not active_batch:
                return None

            rev_id = active_batch.get("prompt_revision_id")
            revisions = prompts_doc.get("revisions", {})
            rev = revisions.get(rev_id, {})
            prompt_defs = rev.get("prompts", [])

            matched_prompt = None
            matched_variant: SampleVariant | None = None
            for prompt_def in prompt_defs:
                source_index = prompt_def.get("source_index", 0)
                safe_text = path_util.safe_filename(prompt_def.get("prompt", ""))
                primary_parent = f"{source_index} - {safe_text}"
                non_ema_parent = f"{primary_parent} - no-ema"

                if source.parent.name == non_ema_parent:
                    matched_prompt = prompt_def
                    matched_variant = "non_ema"
                    break
                if source.parent.name == primary_parent:
                    matched_prompt = prompt_def
                    matched_variant = "base" if (self._active_config and self._active_config.ema == EMAMode.OFF) else "ema"
                    break

            if matched_prompt is None or matched_variant is None:
                self._record_unassigned_error(source.name, "source directory did not match captured prompt")
                return None

            matched_slot = None
            for slot in active_batch.get("samples", []):
                if (
                    slot.get("webui_prompt_id") == matched_prompt["webui_id"]
                    and slot.get("variant") == matched_variant
                    and slot.get("status") == "pending"
                ):
                    matched_slot = slot
                    break

            if matched_slot is None:
                return None

            batch_id = active_batch["batch_id"]
            global_step = active_batch.get("progress", {}).get("global_step", 0)
            source_index = matched_prompt.get("source_index", 0)
            variant_slug = matched_variant.replace("_", "-")
            stem = f"{batch_id:06d}-step-{global_step:09d}-prompt-{source_index:03d}-{variant_slug}"
            filename = f"{stem}{source.suffix.lower()}"
            thumbnail_filename = f"{stem}-thumb.webp"

            target_path = self._active_run_dir / filename
            thumb_path = self._active_run_dir / thumbnail_filename

            try:
                full_etag = copy_file_atomic(source, target_path)
            except Exception as e:
                matched_slot["status"] = "error"
                matched_slot["error"] = str(e)
                write_json_atomic(manifest_path, manifest_doc)
                return None

            thumbnail_error = None
            try:
                with Image.open(source) as img:
                    img.thumbnail(self._thumbnail_max_size)
                    thumb_etag = save_pil_atomic(img, thumb_path, image_format="WEBP")
                    actual_thumb_filename = thumbnail_filename
            except Exception as e:
                actual_thumb_filename = filename
                thumb_etag = full_etag
                thumbnail_error = str(e)

            matched_slot["status"] = "ready"
            matched_slot["filename"] = filename
            matched_slot["thumbnail_filename"] = actual_thumb_filename
            matched_slot["etag"] = full_etag
            matched_slot["thumbnail_etag"] = thumb_etag
            if thumbnail_error:
                matched_slot["thumbnail_error"] = thumbnail_error

            write_json_atomic(manifest_path, manifest_doc)

            return {
                "run_key": self._active_run_key,
                "batch_id": batch_id,
                "webui_prompt_id": matched_prompt["webui_id"],
                "variant": matched_variant,
                "status": "ready",
            }

    def list_runs(self) -> list[dict[str, Any]]:
        with self._lock:
            ws = self._active_workspace
            if ws is None:
                raw_ws = self._workspace_provider()
                ws_path = Path(raw_ws)
                ws = (self._root_dir / ws_path).resolve() if not ws_path.is_absolute() else ws_path.resolve()

            samples_dir = ws / "web" / "samples"
            if not samples_dir.is_dir():
                return []

            runs: list[dict[str, Any]] = []
            for item in samples_dir.iterdir():
                if not item.is_dir():
                    continue
                manifest_path = item / "manifest.json"
                if not manifest_path.exists():
                    continue
                try:
                    data = json.loads(manifest_path.read_text(encoding="utf-8"))
                    if data.get("schema_version") != 1:
                        continue
                    run_info = data.get("run", {})
                    key = run_info.get("key") or item.name
                    config_filename = run_info.get("config_filename", "")
                    started_at = run_info.get("started_at")
                    batches = data.get("batches", [])
                    batch_count = len(batches)
                    latest_sampled_at = None
                    if batches:
                        latest_sampled_at = batches[-1].get("created_at")

                    runs.append({
                        "key": key,
                        "config_filename": config_filename,
                        "started_at": started_at,
                        "batch_count": batch_count,
                        "latest_sampled_at": latest_sampled_at,
                        "active": key == self._active_run_key,
                    })
                except Exception:
                    continue

            runs.sort(key=lambda r: r.get("started_at") or "", reverse=True)
            return runs

    def get_run_model(self, run_key: str) -> dict[str, Any]:
        with self._lock:
            ws = self._active_workspace
            if ws is None:
                raw_ws = self._workspace_provider()
                ws_path = Path(raw_ws)
                ws = (self._root_dir / ws_path).resolve() if not ws_path.is_absolute() else ws_path.resolve()

            run_dir = ws / "web" / "samples" / run_key
            manifest_path = run_dir / "manifest.json"
            if not run_dir.is_dir() or not manifest_path.exists():
                raise GalleryNotFound(f"Run '{run_key}' not found")

            try:
                manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
                if manifest_doc.get("schema_version") != 1:
                    raise GalleryNotFound(f"Run '{run_key}' has invalid schema version")
            except GalleryNotFound:
                raise
            except Exception as e:
                raise GalleryNotFound(f"Failed to read run '{run_key}': {e}") from e

            prompts_path = run_dir / "prompts.json"
            revisions: dict[str, Any] = {}
            if prompts_path.exists():
                with contextlib.suppress(Exception):
                    prompts_doc = json.loads(prompts_path.read_text(encoding="utf-8"))
                    if prompts_doc.get("schema_version") == 1:
                        revisions = prompts_doc.get("revisions", {})

            manifest_dirty = False
            batches = manifest_doc.get("batches", [])
            for batch in batches:
                for sample in batch.get("samples", []):
                    if sample.get("status") == "ready":
                        filename = sample.get("filename")
                        if filename:
                            file_path = run_dir / filename
                            if not file_path.is_file():
                                sample["status"] = "unavailable"
                                manifest_dirty = True

            if manifest_dirty:
                with contextlib.suppress(Exception):
                    write_json_atomic(manifest_path, manifest_doc)

            is_active = (run_key == self._active_run_key) and (self._active_config is not None)

            return {
                "active": is_active,
                "run": manifest_doc.get("run"),
                "batches": batches,
                "revisions": revisions,
            }

    def get_current_model(self) -> dict[str, Any]:
        with self._lock:
            if self._active_run_key is not None:
                try:
                    return self.get_run_model(self._active_run_key)
                except GalleryNotFound:
                    pass
            elif self._last_run_key is not None:
                try:
                    model = self.get_run_model(self._last_run_key)
                    model["active"] = False
                    return model
                except GalleryNotFound:
                    pass

            return {
                "active": self._active_config is not None,
                "run": None,
                "batches": [],
                "revisions": {},
            }

    def get_image(self, run_key: str, filename: str) -> GalleryImage:
        with self._lock:
            if Path(filename).name != filename or ".." in filename or "/" in filename or "\\" in filename:
                raise GalleryNotFound("Invalid filename traversal")

            ws = self._active_workspace
            if ws is None:
                raw_ws = self._workspace_provider()
                ws_path = Path(raw_ws)
                ws = (self._root_dir / ws_path).resolve() if not ws_path.is_absolute() else ws_path.resolve()

            run_dir = (ws / "web" / "samples" / run_key).resolve()
            expected_parent = (ws / "web" / "samples").resolve()
            try:
                run_dir.relative_to(expected_parent)
            except ValueError as err:
                raise GalleryNotFound(f"Run key '{run_key}' escapes directory") from err

            manifest_path = run_dir / "manifest.json"
            if not run_dir.is_dir() or not manifest_path.exists():
                raise GalleryNotFound(f"Run '{run_key}' not found")

            try:
                manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception as e:
                raise GalleryNotFound(f"Corrupt manifest: {e}") from e

            matching_sample = None
            is_thumbnail = False
            for batch in manifest_doc.get("batches", []):
                for sample in batch.get("samples", []):
                    if sample.get("status") == "ready":
                        if sample.get("filename") == filename:
                            matching_sample = sample
                            is_thumbnail = False
                            break
                        if sample.get("thumbnail_filename") == filename:
                            matching_sample = sample
                            is_thumbnail = True
                            break
                if matching_sample:
                    break

            if not matching_sample:
                raise GalleryNotFound(f"Filename '{filename}' is not referenced as a ready sample in run '{run_key}'")

            image_path = (run_dir / filename).resolve()
            try:
                image_path.relative_to(run_dir)
            except ValueError as err:
                raise GalleryNotFound(f"Path '{filename}' escapes run directory") from err

            if not image_path.is_file():
                matching_sample["status"] = "unavailable"
                with contextlib.suppress(Exception):
                    write_json_atomic(manifest_path, manifest_doc)
                raise GalleryNotFound(f"Referenced image file '{filename}' does not exist")

            digest = matching_sample.get("thumbnail_etag") if is_thumbnail else matching_sample.get("etag")
            if not digest:
                digest = matching_sample.get("etag") or ""

            etag = f'"{digest}"'

            ext = image_path.suffix.lower()
            media_type_map = {
                ".png": "image/png",
                ".webp": "image/webp",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".avif": "image/avif",
            }
            media_type = media_type_map.get(ext, mimetypes.guess_type(image_path.name)[0] or "image/png")

            return GalleryImage(
                path=image_path,
                media_type=media_type,
                etag=etag,
            )

