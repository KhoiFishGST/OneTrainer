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
from modules.webui.metrics_store import METRICS_FILENAME
from modules.webui.run_key import RunKeyResolver

from PIL import Image

SampleVariant = Literal["base", "ema", "non_ema"]
SampleStatus = Literal["pending", "ready", "unavailable", "error"]


@dataclass(frozen=True)
class TrainingProgressSnapshot:
    epoch: int
    epoch_step: int
    global_step: int



@dataclass(frozen=True)
class GalleryImage:
    path: Path
    media_type: str
    etag: str


class GalleryNotFound(LookupError):
    pass


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
        run_resolved_sink: Callable[[Path], None] | None = None,
        thumbnail_max_size: tuple[int, int] = (512, 512),
    ) -> None:
        self._root_dir = root_dir.resolve()
        self._workspace_provider = workspace_provider
        self._warning_sink = warning_sink
        self._run_resolved_sink = run_resolved_sink
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
        self._run_key_resolver = RunKeyResolver()
        self._resolved_config_filename: str | None = None

    @property
    def active_run_key(self) -> str | None:
        with self._lock:
            return self._active_run_key

    @property
    def active_run_dir(self) -> Path | None:
        with self._lock:
            return self._active_run_dir

    def _get_workspace_dir(self) -> Path:
        if self._active_workspace is not None:
            return self._active_workspace
        raw_ws = self._workspace_provider()
        ws_path = Path(raw_ws)
        return (self._root_dir / ws_path).resolve() if not ws_path.is_absolute() else ws_path.resolve()

    def begin_training(self, config: TrainConfig, *, started_at: datetime | None = None) -> None:
        with self._lock:
            self._active_config = config
            self._active_workspace = self._get_workspace_dir()
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

            self._run_key_resolver.snapshot(self._active_workspace / "config")

    def _resolve_run(self, config: TrainConfig) -> None:
        ws = self._active_workspace
        if ws is None:
            self._disabled = True
            return

        result = self._run_key_resolver.resolve(ws / "config", config.save_filename_prefix or "")

        if result.reason == "no_config_dir" or result.reason == "missing":
            if self._warning_sink:
                self._warning_sink(
                    "Gallery persistence disabled: missing core config candidate",
                    {"workspace": str(ws)},
                )
            self._disabled = True
            return

        if result.reason == "ambiguous":
            if self._warning_sink:
                self._warning_sink(
                    "Gallery persistence disabled: ambiguous core config candidate",
                    {"workspace": str(ws)},
                )
            self._disabled = True
            return

        run_key = result.key
        assert run_key is not None
        config_filename = result.config_filename or ""
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
        self._resolved_config_filename = config_filename

        # Metrics start at step 1 but this only runs on the first sample batch,
        # so this is the signal that buffered rows finally have somewhere to go.
        if self._run_resolved_sink is not None:
            with contextlib.suppress(Exception):
                self._run_resolved_sink(target_dir)

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

            exp_prompt_ids = [p["webui_id"] for p in normalized_defs if p.get("enabled", True)]

            new_batch = {
                "id": batch_id,
                "batch_id": batch_id,
                "epoch": progress.epoch,
                "epoch_step": progress.epoch_step,
                "global_step": progress.global_step,
                "prompt_revision_id": rev_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "sampled_at": datetime.now(timezone.utc).isoformat(),
                "progress": {
                    "epoch": progress.epoch,
                    "epoch_step": progress.epoch_step,
                    "global_step": progress.global_step,
                },
                "expected_prompt_ids": exp_prompt_ids,
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
            active_run_dir = self._active_run_dir
            active_batch_id = self._active_batch_id
            active_workspace = self._active_workspace
            active_run_key = self._active_run_key
            active_config = self._active_config

        if active_run_dir is None or active_batch_id is None or active_workspace is None or active_run_key is None:
            return None

        if getattr(sampler_output, "file_type", None) != FileType.IMAGE:
            return None

        filepath = getattr(sampler_output, "filepath", None)
        if not filepath or not isinstance(filepath, str):
            return None

        source = Path(filepath).resolve()
        if not source.exists() or not source.is_file():
            return None

        ws_samples = (active_workspace / "samples").resolve()
        try:
            source.relative_to(ws_samples)
        except ValueError:
            return None

        manifest_path = active_run_dir / "manifest.json"
        prompts_path = active_run_dir / "prompts.json"
        if not manifest_path.exists() or not prompts_path.exists():
            return None

        try:
            manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
            prompts_doc = json.loads(prompts_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        active_batch = None
        for b in manifest_doc.get("batches", []):
            if b.get("batch_id") == active_batch_id:
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
                matched_variant = "base" if (active_config and active_config.ema == EMAMode.OFF) else "ema"
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

        target_path = active_run_dir / filename
        thumb_path = active_run_dir / thumbnail_filename

        try:
            full_etag = copy_file_atomic(source, target_path)
        except Exception as e:
            with self._lock, contextlib.suppress(Exception):
                m_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
                for b in m_doc.get("batches", []):
                    if b.get("batch_id") == active_batch_id:
                        for slot in b.get("samples", []):
                            if (
                                slot.get("webui_prompt_id") == matched_prompt["webui_id"]
                                and slot.get("variant") == matched_variant
                                and slot.get("status") == "pending"
                            ):
                                slot["status"] = "error"
                                slot["error"] = str(e)
                                write_json_atomic(manifest_path, m_doc)
                                break
            return None

        thumbnail_error = None
        try:
            with Image.open(source) as img:
                img.thumbnail(self._thumbnail_max_size)
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA" if "A" in img.mode or "transparency" in img.info else "RGB")
                thumb_etag = save_pil_atomic(img, thumb_path, image_format="WEBP")
                actual_thumb_filename = thumbnail_filename
        except Exception as e:
            actual_thumb_filename = filename
            thumb_etag = full_etag
            thumbnail_error = str(e)

        with self._lock:
            try:
                manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
                for b in manifest_doc.get("batches", []):
                    if b.get("batch_id") == active_batch_id:
                        for slot in b.get("samples", []):
                            if (
                                slot.get("webui_prompt_id") == matched_prompt["webui_id"]
                                and slot.get("variant") == matched_variant
                                and slot.get("status") == "pending"
                            ):
                                slot["status"] = "ready"
                                slot["filename"] = filename
                                slot["thumbnail_filename"] = actual_thumb_filename
                                slot["etag"] = full_etag
                                slot["thumbnail_etag"] = thumb_etag
                                if thumbnail_error:
                                    slot["thumbnail_error"] = thumbnail_error
                                break
                        break
                write_json_atomic(manifest_path, manifest_doc)
            except Exception:
                return None

        return {
            "run_key": active_run_key,
            "batch_id": batch_id,
            "webui_prompt_id": matched_prompt["webui_id"],
            "variant": matched_variant,
            "status": "ready",
        }

    def list_runs(self) -> list[dict[str, Any]]:
        with self._lock:
            ws = self._get_workspace_dir()
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

    @staticmethod
    def _is_unsafe_run_key(run_key: str) -> bool:
        """Check if a run key contains path traversal attempts or unsafe characters."""
        return Path(run_key).name != run_key or ".." in run_key or "/" in run_key or "\\" in run_key

    def get_run_config_path(self, run_key: str) -> Path:
        """Resolve the config file a completed run was trained from.

        The manifest records only a bare filename; the file itself lives in the
        workspace config directory. The name is forced through Path().name so a
        hand-edited manifest cannot escape that directory. The returned path is
        not checked for existence -- callers report that case separately.
        """
        with self._lock:
            if self._is_unsafe_run_key(run_key):
                raise GalleryNotFound("Run not found")

            ws = self._get_workspace_dir()
            manifest_path = ws / "web" / "samples" / run_key / "manifest.json"
            if not manifest_path.exists():
                raise GalleryNotFound("Run not found")

            try:
                manifest_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception as e:
                raise GalleryNotFound("Run not found") from e

            config_filename = str((manifest_doc.get("run") or {}).get("config_filename") or "")
            if not config_filename:
                raise GalleryNotFound("Run has no recorded config file")

            return ws / "config" / Path(config_filename).name

    def get_run_metrics_path(self, run_key: str) -> Path:
        """Resolve a run's metrics.jsonl.

        Mirrors get_run_config_path: the run key is forced through the same
        containment check so a crafted key cannot read outside web/samples. The
        returned path is not checked for existence -- a run that predates
        metrics persistence simply has no file, which callers report as empty.
        """
        with self._lock:
            if self._is_unsafe_run_key(run_key):
                raise GalleryNotFound("Run not found")

            ws = self._get_workspace_dir()
            run_dir = ws / "web" / "samples" / run_key
            if not (run_dir / "manifest.json").exists():
                raise GalleryNotFound("Run not found")

            return run_dir / METRICS_FILENAME

    def get_run_model(self, run_key: str) -> dict[str, Any]:
        with self._lock:
            if self._is_unsafe_run_key(run_key):
                raise GalleryNotFound(f"Invalid run key '{run_key}'")

            ws = self._get_workspace_dir()
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
                if "id" not in batch:
                    batch["id"] = batch.get("batch_id", 1)
                if "sampled_at" not in batch:
                    batch["sampled_at"] = batch.get("created_at", "")
                if "expected_prompt_ids" not in batch:
                    samples = batch.get("samples", [])
                    extracted_ids: list[str] = []
                    for s in samples:
                        pid = s.get("webui_prompt_id")
                        if pid and pid not in extracted_ids:
                            extracted_ids.append(pid)
                    batch["expected_prompt_ids"] = extracted_ids
                if "epoch" not in batch:
                    batch["epoch"] = batch.get("progress", {}).get("epoch", 0)
                if "epoch_step" not in batch:
                    batch["epoch_step"] = batch.get("progress", {}).get("epoch_step", 0)
                if "global_step" not in batch:
                    batch["global_step"] = batch.get("progress", {}).get("global_step", 0)
                if "expected_variants" not in batch:
                    samples = batch.get("samples", [])
                    extracted_vars: list[str] = []
                    for s in samples:
                        v = s.get("variant")
                        if v and v not in extracted_vars:
                            extracted_vars.append(v)
                    batch["expected_variants"] = extracted_vars or ["ema"]

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
            if Path(run_key).name != run_key or ".." in run_key or "/" in run_key or "\\" in run_key:
                raise GalleryNotFound(f"Invalid run key '{run_key}'")
            if Path(filename).name != filename or ".." in filename or "/" in filename or "\\" in filename:
                raise GalleryNotFound("Invalid filename traversal")

            ws = self._get_workspace_dir()
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

