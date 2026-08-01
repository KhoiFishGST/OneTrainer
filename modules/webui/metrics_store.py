import json
import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

METRICS_FILENAME = "metrics.jsonl"

# Sized to cover a run that first samples ~50k steps in while logging several
# scalars per step. Independent of TrainingService's 10000-row live deque,
# which would otherwise evict early history before the flush ever happened.
DEFAULT_BUFFER_LIMIT = 200000
DEFAULT_FLUSH_ROWS = 200
DEFAULT_FLUSH_SECONDS = 5.0


def read_rows(path: Path) -> list[dict[str, Any]]:
    """Parse a run's metrics.jsonl.

    Appends are not atomic, so the final line may be torn. Lines that fail to
    parse -- or that parse to something other than an object -- are skipped
    rather than failing the whole file.
    """
    path = Path(path)
    if not path.is_file():
        return []

    rows: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if isinstance(row, dict):
                    rows.append(row)
    except OSError:
        logger.exception("Could not read metrics file %s", path)
        return []

    return rows


class MetricsStore:
    """Buffers training metric rows and appends them to <run_dir>/metrics.jsonl.

    The gallery resolves a run directory lazily, on the first sample batch, but
    metrics start at step 1. So rows accumulate in memory until bind_run_dir()
    arrives, at which point the whole buffer is flushed and later rows stream
    through in batches.

    Persistence is best-effort by design: any write failure disables it for the
    remainder of the run rather than propagating into the training thread.
    """

    def __init__(
        self,
        buffer_limit: int = DEFAULT_BUFFER_LIMIT,
        flush_rows: int = DEFAULT_FLUSH_ROWS,
        flush_seconds: float = DEFAULT_FLUSH_SECONDS,
        time_source: Callable[[], float] = time.monotonic,
    ) -> None:
        self._lock = threading.RLock()
        self._flush_rows = flush_rows
        self._flush_seconds = flush_seconds
        self._time_source = time_source

        self._buffer: deque = deque(maxlen=buffer_limit)
        self._pending: list[dict[str, Any]] = []
        self._path: Path | None = None
        self._disabled = False
        self._last_flush = time_source()

    def begin_training(self) -> None:
        with self._lock:
            self._buffer.clear()
            self._pending.clear()
            self._path = None
            self._disabled = False
            self._last_flush = self._time_source()

    def record(self, row: dict[str, Any]) -> None:
        with self._lock:
            if self._disabled:
                return
            if self._path is None:
                self._buffer.append(row)
                return

            self._pending.append(row)
            elapsed = self._time_source() - self._last_flush
            if len(self._pending) >= self._flush_rows or elapsed >= self._flush_seconds:
                self._flush_locked()

    def bind_run_dir(self, run_dir: Path) -> None:
        with self._lock:
            if self._disabled:
                return
            self._path = Path(run_dir) / METRICS_FILENAME
            # Buffered rows precede anything recorded since binding.
            self._pending = list(self._buffer) + self._pending
            self._buffer.clear()
            self._flush_locked()

    def flush(self) -> None:
        with self._lock:
            self._flush_locked()

    def end_training(self) -> None:
        with self._lock:
            self._flush_locked()
            self._path = None
            self._buffer.clear()
            self._pending.clear()

    def _flush_locked(self) -> None:
        if self._disabled or self._path is None or not self._pending:
            return

        rows, self._pending = self._pending, []
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            with self._path.open("a", encoding="utf-8") as handle:
                for row in rows:
                    handle.write(json.dumps(row, separators=(",", ":"), default=str))
                    handle.write("\n")
            self._last_flush = self._time_source()
        except Exception:
            logger.exception("Metrics persistence disabled after write failure")
            self._disabled = True
            self._buffer.clear()
