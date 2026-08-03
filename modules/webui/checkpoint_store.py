import contextlib
import json
import logging
import shutil
import threading
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from modules.util.config.TrainConfig import TrainConfig
from modules.util.enum.ModelFormat import ModelFormat
from modules.webui.atomic_io import link_or_copy, volume_key, write_json_atomic
from modules.webui.run_key import RunKeyResolver

logger = logging.getLogger(__name__)

# Beside the gallery's <workspace>/web/samples, so all web UI data shares a root.
CHECKPOINTS_SUBDIR = ("web", "checkpoints")
MANIFEST_FILENAME = "manifest.json"

KIND_SAVE = "save"
KIND_FINAL = "final"

# GenericTrainer.py:484-488 writes every scheduled and on-demand save into
# <workspace>/save/. Backups go to <workspace>/backup/ in INTERNAL format, and
# the final model goes wherever output_model_destination points.
SAVE_DIRNAME = "save"


def classify(model_format: ModelFormat, destination: str) -> str | None:
    """Decide what a completed saver write was, or None to skip it.

    INTERNAL is resume state, not a deliverable, so it is never captured.
    """
    if model_format is ModelFormat.INTERNAL:
        return None

    parent = Path(destination).parent.name
    if parent.lower() == SAVE_DIRNAME:
        return KIND_SAVE

    return KIND_FINAL


class CheckpointNotFound(LookupError):
    pass


def _is_unsafe_name(name: str) -> bool:
    """Reject anything that could escape the run directory."""
    return not name or Path(name).name != name or ".." in name or "/" in name or "\\" in name


def _tree_size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file())


class CheckpointStore:
    """Captures inference-ready checkpoints as the trainer writes them.

    Capture is best-effort throughout: any failure is logged once and disables
    capture for the rest of the run. A save that succeeded on disk must never be
    reported as failed because we could not link it.

    Work runs on a single background worker so the training thread is never
    blocked by a tree walk or a multi-gigabyte copy, and so manifest writes are
    naturally serialised.
    """

    def __init__(
        self,
        root_dir: Path,
        workspace_provider: Callable[[], str | Path],
    ) -> None:
        self._root_dir = Path(root_dir).resolve()
        self._workspace_provider = workspace_provider
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="webui-checkpoints")

        self._resolver = RunKeyResolver()
        self._config: TrainConfig | None = None
        self._workspace: Path | None = None
        self._run_key: str | None = None
        self._run_dir: Path | None = None
        self._config_filename: str = ""
        self._started_at: str | None = None
        self._disabled = False
        self._used_names: set[str] = set()
        self._link_support: dict[object, bool] = {}
        self._pending: list[Future] = []
        self._run_noted = False
        self._tensorboard_dirname: str | None = None

    # -- lifecycle ---------------------------------------------------------

    def _resolve_workspace(self) -> Path:
        raw = Path(self._workspace_provider())
        return raw.resolve() if raw.is_absolute() else (self._root_dir / raw).resolve()

    @property
    def workspace_dir(self) -> Path:
        """The resolved absolute workspace, for callers that read run artifacts."""
        return self._resolve_workspace()

    def begin_training(self, config: TrainConfig) -> None:
        with self._lock:
            self._config = config
            self._workspace = self._resolve_workspace()
            self._run_key = None
            self._run_dir = None
            self._config_filename = ""
            self._disabled = False
            self._used_names.clear()
            self._link_support.clear()
            self._pending.clear()
            self._run_noted = False
            self._tensorboard_dirname = None
            self._started_at = datetime.now(timezone.utc).isoformat()
            self._resolver.snapshot(self._workspace / "config")

    def note_run_active(self, log_dir: str | None) -> None:
        """Establish this run's Downloads entry. Called from add_scalar; never raises.

        This is the earliest and most reliable run marker available: the
        SummaryWriter is created at run start and the first scalar lands at step
        1, before any sample batch or save. Establishing the entry here is what
        makes a run that never saved a model reachable in Downloads.

        add_scalar fires several times per step for the entire run, so the flag
        check below must come before any lock or I/O.
        """
        if self._run_noted:
            return

        try:
            with self._lock:
                if self._run_noted or self._disabled or self._workspace is None:
                    return
                self._run_noted = True
                # Stored as a bare name, like run.config_filename, so a
                # hand-edited manifest cannot point the archiver outside the
                # workspace. Reconstructed as <workspace>/tensorboard/<name>.
                self._tensorboard_dirname = Path(log_dir).name if log_dir else None
                future = self._executor.submit(self._note_run_blocking)
                self._pending.append(future)
        except Exception:
            logger.exception("Could not establish the run entry for Downloads")

    def _note_run_blocking(self) -> None:
        try:
            with self._lock:
                if self._disabled:
                    return
                run_dir = self._ensure_run_dir()
                if run_dir is None:
                    return
                run_dir.mkdir(parents=True, exist_ok=True)
                write_json_atomic(run_dir / MANIFEST_FILENAME, self._read_manifest(run_dir))
        except Exception:
            logger.exception("Could not write the run manifest; disabling capture for this run")
            with contextlib.suppress(Exception):
                with self._lock:
                    self._disabled = True

    def capture(self, model_format: ModelFormat, destination: str) -> None:
        """Record a completed saver write. Never raises."""
        try:
            with self._lock:
                if self._disabled or self._workspace is None:
                    return
                kind = classify(model_format, destination)
                if kind is None:
                    return
                future = self._executor.submit(
                    self._capture_blocking, kind, model_format, Path(destination)
                )
                self._pending.append(future)
        except Exception:
            logger.exception("Checkpoint capture could not be scheduled; disabling for this run")
            with contextlib.suppress(Exception):
                self._disabled = True

    def end_training(self, timeout: float = 60.0) -> None:
        with self._lock:
            pending, self._pending = self._pending, []
        for future in pending:
            with contextlib.suppress(Exception):
                future.result(timeout=timeout)
        with self._lock:
            self._run_key = None
            self._run_dir = None
            self._config = None

    # -- capture worker ----------------------------------------------------

    def _ensure_run_dir(self) -> Path | None:
        if self._run_dir is not None:
            return self._run_dir
        if self._workspace is None or self._config is None:
            return None

        result = self._resolver.resolve(
            self._workspace / "config", self._config.save_filename_prefix or ""
        )
        if result.key is None:
            logger.warning(
                "Checkpoint capture disabled: could not resolve a run key (%s)", result.reason
            )
            self._disabled = True
            return None

        self._run_key = result.key
        self._config_filename = result.config_filename or ""
        self._run_dir = self._workspace.joinpath(*CHECKPOINTS_SUBDIR, result.key)
        return self._run_dir

    def _unique_name(self, name: str) -> str:
        if name not in self._used_names:
            self._used_names.add(name)
            return name
        stem, dot, suffix = name.partition(".")
        index = 2
        while True:
            candidate = f"{stem}-{index}{dot}{suffix}"
            if candidate not in self._used_names:
                self._used_names.add(candidate)
                return candidate
            index += 1

    def _copy_tree(self, source: Path, destination: Path, allow_link: bool) -> bool:
        destination.mkdir(parents=True, exist_ok=True)
        linked_all = True
        for item in sorted(source.rglob("*")):
            if not item.is_file():
                continue
            target = destination / item.relative_to(source)
            if not link_or_copy(item, target, allow_link=allow_link):
                linked_all = False
        return linked_all

    def _capture_blocking(self, kind: str, model_format: ModelFormat, source: Path) -> None:
        try:
            with self._lock:
                if self._disabled:
                    return
                run_dir = self._ensure_run_dir()
                if run_dir is None:
                    return

                if not source.exists():
                    logger.warning("Checkpoint source vanished before capture: %s", source)
                    return

                name = self._unique_name(source.name)
                target = run_dir / name

                key = volume_key(source)
                allow_link = self._link_support.get(key, True)
                is_directory = source.is_dir()

            available = True
            linked = False
            try:
                if is_directory:
                    linked = self._copy_tree(source, target, allow_link)
                else:
                    linked = link_or_copy(source, target, allow_link=allow_link)
            except OSError:
                # The save itself succeeded; only our copy of it failed.
                # Record it anyway so the user is told the file exists and
                # where, rather than it silently vanishing from Downloads.
                logger.exception("Could not store checkpoint %s", source)
                available = False

            size_bytes = _tree_size(target) if available else 0

            with self._lock:
                if available and allow_link and not linked:
                    # Remember per volume, not per run: a cross-device final
                    # model must not stop same-volume saves from being linked.
                    self._link_support[key] = False

                self._append_manifest_entry(
                    run_dir,
                    {
                        "kind": kind,
                        "filename": name,
                        "format": model_format.value,
                        "is_directory": is_directory,
                        "size_bytes": size_bytes,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "source_path": str(source),
                        "linked": linked,
                        "available": available,
                    },
                )
        except Exception:
            logger.exception("Checkpoint capture failed; disabling for this run")
            with contextlib.suppress(Exception):
                with self._lock:
                    self._disabled = True

    def _read_manifest(self, run_dir: Path) -> dict[str, Any]:
        path = run_dir / MANIFEST_FILENAME
        if path.is_file():
            try:
                doc = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(doc, dict) and doc.get("schema_version") == 1:
                    if isinstance(doc.get("checkpoints"), list):
                        return doc
            except (OSError, ValueError):
                logger.exception("Unreadable checkpoint manifest at %s", path)

        return {
            "schema_version": 1,
            "run": {
                "key": self._run_key,
                "config_filename": self._config_filename,
                "started_at": self._started_at,
                # Optional and additive, so schema_version stays at 1 and a
                # manifest written without it still reads.
                "tensorboard_dirname": self._tensorboard_dirname,
            },
            "checkpoints": [],
        }

    def _append_manifest_entry(self, run_dir: Path, entry: dict[str, Any]) -> None:
        with self._lock:
            doc = self._read_manifest(run_dir)
            # Highest id seen, not the entry count: a delete makes the count
            # smaller than an id already in use, and reissuing one collides with
            # a live entry.
            highest = max((int(c.get("id") or 0) for c in doc["checkpoints"]), default=0)
            entry = {"id": highest + 1, **entry}
            doc["checkpoints"].append(entry)
            write_json_atomic(run_dir / MANIFEST_FILENAME, doc)

    # -- read side ---------------------------------------------------------

    def _checkpoints_root(self) -> Path:
        return self._resolve_workspace().joinpath(*CHECKPOINTS_SUBDIR)

    def _load_manifest(self, run_key: str) -> dict[str, Any]:
        if _is_unsafe_name(run_key):
            raise CheckpointNotFound("Run not found")

        path = self._checkpoints_root() / run_key / MANIFEST_FILENAME
        if not path.is_file():
            raise CheckpointNotFound("Run not found")
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise CheckpointNotFound("Run not found") from error

        if not isinstance(doc, dict) or doc.get("schema_version") != 1:
            raise CheckpointNotFound("Run not found")
        if not isinstance(doc.get("checkpoints"), list):
            raise CheckpointNotFound("Run not found")
        return doc

    def list_runs(self) -> list[dict[str, Any]]:
        root = self._checkpoints_root()
        if not root.is_dir():
            return []

        runs: list[dict[str, Any]] = []
        for item in root.iterdir():
            if not item.is_dir():
                continue
            try:
                doc = self._load_manifest(item.name)
            except CheckpointNotFound:
                continue
            checkpoints = doc["checkpoints"]
            info = doc.get("run") or {}
            runs.append({
                "key": info.get("key") or item.name,
                "config_filename": info.get("config_filename", ""),
                "started_at": info.get("started_at"),
                "checkpoint_count": len(checkpoints),
                "total_size_bytes": sum(int(c.get("size_bytes") or 0) for c in checkpoints),
            })

        runs.sort(key=lambda r: r.get("started_at") or r["key"], reverse=True)
        return runs

    def get_run(self, run_key: str) -> dict[str, Any]:
        doc = self._load_manifest(run_key)
        return {"run": doc.get("run") or {"key": run_key}, "checkpoints": doc["checkpoints"]}

    def get_checkpoint_path(self, run_key: str, filename: str) -> Path:
        """Resolve a checkpoint, confined to its run directory.

        The name must appear in the manifest, so a file dropped into the
        directory out of band is not servable.
        """
        if _is_unsafe_name(filename):
            raise CheckpointNotFound("Checkpoint not found")

        doc = self._load_manifest(run_key)
        entry = next((c for c in doc["checkpoints"] if c.get("filename") == filename), None)
        if entry is None:
            raise CheckpointNotFound("Checkpoint not found")
        if entry.get("available") is False:
            raise CheckpointNotFound("This checkpoint was never stored by the web UI")

        path = self._checkpoints_root() / run_key / filename
        if not path.exists():
            raise CheckpointNotFound("Checkpoint file no longer exists")
        return path

    def delete_checkpoint(self, run_key: str, filename: str) -> None:
        """Remove a checkpoint from Downloads.

        Deliberately not routed through get_checkpoint_path: that refuses
        entries we never managed to store, and entries whose file has since
        vanished. Those are exactly the rows a user most wants to clear, and
        refusing would strand them in the list forever. Membership in the
        manifest is still required, so an unknown name is still a 404.
        """
        with self._lock:
            if _is_unsafe_name(filename):
                raise CheckpointNotFound("Checkpoint not found")

            doc = self._load_manifest(run_key)
            if not any(c.get("filename") == filename for c in doc["checkpoints"]):
                raise CheckpointNotFound("Checkpoint not found")

            path = self._checkpoints_root() / run_key / filename

        # Outside the lock: removing a multi-gigabyte tree must not block a
        # capture running on the worker thread.
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()

        with self._lock:
            run_dir = self._checkpoints_root() / run_key
            doc = self._load_manifest(run_key)
            doc["checkpoints"] = [c for c in doc["checkpoints"] if c.get("filename") != filename]
            write_json_atomic(run_dir / MANIFEST_FILENAME, doc)

