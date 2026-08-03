import contextlib
import logging
import threading
import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.run_key import RunKeyResolver

logger = logging.getLogger(__name__)

AMBIGUOUS_MESSAGE = (
    "Could not identify this training run — {count} candidate configs appeared. "
    "The sample gallery, metrics and downloads are disabled for this run. "
    "This usually means another OneTrainer instance is writing to the same workspace."
)

MISSING_MESSAGE = (
    "Could not identify this training run — no new config file appeared in the workspace. "
    "The sample gallery, metrics and downloads are disabled for this run."
)


class RunSession:
    """Knows which training run is happening, so the gallery, metrics store and
    downloads all agree.

    Resolution runs at most once per run and caches the outcome including
    failure: RunKeyResolver hashes every JSON in the config directory, and every
    caller sits on a hot path, so a retried failure would hash once per row.
    """

    def __init__(
        self,
        root_dir: Path,
        workspace_provider: Callable[[], str | Path],
        warning_sink: Callable[[str, dict[str, Any]], None] | None = None,
        time_source: Callable[[], float] = time.time,
    ) -> None:
        self._root_dir = Path(root_dir).resolve()
        self._workspace_provider = workspace_provider
        self._warning_sink = warning_sink
        self._time_source = time_source
        self._lock = threading.RLock()

        self._resolver = RunKeyResolver()
        self._config: TrainConfig | None = None
        self._workspace: Path | None = None
        self._started_at: str | None = None
        self._hint_name: str | None = None
        self._hint_seen_at: float | None = None
        self._resolved = False
        self._run_key: str | None = None
        self._config_filename: str = ""

    # -- lifecycle ---------------------------------------------------------

    def _resolve_workspace(self) -> Path:
        raw = Path(self._workspace_provider())
        return raw.resolve() if raw.is_absolute() else (self._root_dir / raw).resolve()

    @property
    def workspace_dir(self) -> Path:
        return self._resolve_workspace()

    @property
    def hint_seen_at(self) -> float | None:
        """Wall-clock at writer construction; exposed for tests and diagnostics."""
        return self._hint_seen_at

    def begin(self, config: TrainConfig) -> None:
        with self._lock:
            self._config = config
            self._workspace = self._resolve_workspace()
            self._started_at = datetime.now(timezone.utc).isoformat()
            self._hint_name = None
            self._hint_seen_at = None
            self._resolved = False
            self._run_key = None
            self._config_filename = ""
            self._resolver.snapshot(self._workspace / "config")

    def note_writer(self, log_dir: str | None) -> None:
        """Record the tensorboard hint. Deliberately does not resolve.

        This fires when the SummaryWriter is constructed, which is before
        GenericTrainer writes the run's config, so resolving here would cache a
        permanent failure. It only records the bare directory name -- like
        run.config_filename, so it is reconstructed under the workspace and
        containment is structural -- and the moment we saw it.
        """
        with self._lock:
            if self._hint_name is not None:
                return
            with contextlib.suppress(Exception):
                self._hint_name = Path(log_dir).name if log_dir else None
                self._hint_seen_at = self._time_source()

    def end(self) -> None:
        with self._lock:
            self._config = None

    # -- resolution --------------------------------------------------------

    def run_key(self) -> str | None:
        with self._lock:
            if not self._resolved:
                self._resolved = True
                self._resolve_locked()
            return self._run_key

    def run_info(self) -> dict[str, Any] | None:
        with self._lock:
            if self.run_key() is None:
                return None
            return {
                "key": self._run_key,
                "config_filename": self._config_filename,
                "started_at": self._started_at,
                "tensorboard_dirname": self._hint_name,
            }

    def _warn(self, message: str, reason: str) -> None:
        logger.warning("%s (reason=%s)", message, reason)
        if self._warning_sink is not None:
            with contextlib.suppress(Exception):
                self._warning_sink(message, {"reason": reason})

    def _resolve_locked(self) -> None:
        if self._workspace is None or self._config is None:
            self._warn(MISSING_MESSAGE, "missing")
            return

        try:
            found = self._resolver.candidates(
                self._workspace / "config", self._config.save_filename_prefix or ""
            )
        except Exception:
            logger.exception("Could not list run config candidates")
            self._warn(MISSING_MESSAGE, "missing")
            return

        if not found:
            self._warn(MISSING_MESSAGE, "missing")
            return

        chosen = self._choose(found)
        if chosen is None:
            self._warn(AMBIGUOUS_MESSAGE.format(count=len(found)), "ambiguous")
            return

        self._run_key = chosen.stem
        self._config_filename = chosen.name

    def _choose(self, found: list[Path]) -> Path | None:
        """Pick this run's config from the candidates.

        Exact stem match first. The tensorboard directory name and the run key
        come from separate get_string_timestamp() calls, though, so they differ
        by a second whenever the interval crosses a boundary -- which is exactly
        the case an exact match cannot handle. Fall back to the candidate whose
        config was written closest to the moment we saw the writer.
        """
        if len(found) == 1:
            return found[0]
        if self._hint_name is None:
            return None

        exact = [c for c in found if c.stem == self._hint_name]
        if len(exact) == 1:
            return exact[0]

        if self._hint_seen_at is None:
            return None

        def distance(path: Path) -> float:
            try:
                return abs(path.stat().st_mtime - self._hint_seen_at)
            except OSError:
                return float("inf")

        best = min(found, key=distance)
        return best if distance(best) != float("inf") else None
