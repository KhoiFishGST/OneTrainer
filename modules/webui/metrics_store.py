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

# Sentinel for "no previous step seen yet", so that a genuine None step still
# compares as a change on the first row.
_UNSET = object()

# Default ceiling for a historical read, matching the live buffer's cap.
DEFAULT_READ_LIMIT = 10000

# Sized to cover a run that first samples ~50k steps in while logging several
# scalars per step. Independent of TrainingService's 10000-row live deque,
# which would otherwise evict early history before the flush ever happened.
DEFAULT_BUFFER_LIMIT = 200000
DEFAULT_FLUSH_ROWS = 200
DEFAULT_FLUSH_SECONDS = 5.0


def _iter_parsed(path: Path):
    """Yield the well-formed JSON objects in a metrics file, one per line.

    Appends are not atomic, so the final line may be torn. Lines that fail to
    parse -- or that parse to something other than an object -- are skipped
    rather than failing the whole file.
    """
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
                yield row


def read_rows(path: Path, limit: int | None = None) -> list[dict[str, Any]]:
    """Parse a run's metrics.jsonl, optionally downsampled to about `limit` rows.

    A run can log hundreds of thousands of rows -- far more than a chart can
    draw or a browser should hold. When `limit` is set and the file is longer,
    the whole curve is returned at lower resolution rather than truncated to a
    prefix.

    Sampling is by *step*, not by row. Each scalar is recorded as its own row,
    so a row stride that happened to match the number of scalars per step would
    keep one series and drop every other one -- blanking a whole chart. Keeping
    or dropping every row of a step together preserves all series evenly.

    Two passes: the first counts distinct steps and retains nothing, the second
    keeps only the sampled ones, so peak memory scales with `limit` rather than
    with file size.
    """
    path = Path(path)
    if not path.is_file():
        return []

    try:
        stride = 1
        if limit is not None and limit > 0:
            total_steps = 0
            previous: Any = _UNSET
            for row in _iter_parsed(path):
                step = row.get("step")
                if step != previous:
                    total_steps += 1
                    previous = step
            # Rows per step is unknown, so compare step count against the row
            # budget; a run with several scalars per step downsamples further,
            # which is the intent.
            if total_steps > limit:
                stride = -(-total_steps // limit)  # ceil, so we never exceed `limit` steps

        rows: list[dict[str, Any]] = []
        if stride == 1:
            rows = list(_iter_parsed(path))
        else:
            step_index = -1
            previous = _UNSET
            for row in _iter_parsed(path):
                step = row.get("step")
                if step != previous:
                    step_index += 1
                    previous = step
                if step_index % stride == 0:
                    rows.append(row)
    except OSError:
        logger.exception("Could not read metrics file %s", path)
        return []

    return rows


class MetricsStore:
    """Buffers training metric rows and appends them to <run_dir>/metrics.jsonl.

    Rows arrive before the run can be identified -- GenericTrainer writes its
    config partway through start() -- so they accumulate in memory until the
    session can name the run, at which point the whole buffer is flushed and
    later rows stream through in batches.

    Persistence is best-effort by design: any write failure disables it for the
    remainder of the run rather than propagating into the training thread.
    """

    def __init__(
        self,
        run_session: Any | None = None,
        buffer_limit: int = DEFAULT_BUFFER_LIMIT,
        flush_rows: int = DEFAULT_FLUSH_ROWS,
        flush_seconds: float = DEFAULT_FLUSH_SECONDS,
        time_source: Callable[[], float] = time.monotonic,
    ) -> None:
        self._run_session = run_session
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
                self._try_bind_locked()
                if self._path is None:
                    return
            else:
                self._pending.append(row)

            elapsed = self._time_source() - self._last_flush
            if len(self._pending) >= self._flush_rows or elapsed >= self._flush_seconds:
                self._flush_locked()

    def _try_bind_locked(self) -> None:
        """Bind metrics persistence directory if run_key is available.

        run_key() resolves once when identified or ambiguous. If no candidate
        config file has appeared yet, it returns None until identified or session.end().
        """
        if self._path is not None or self._run_session is None:
            return
        try:
            run_key = self._run_session.run_key()
            if run_key is None:
                return
            run_dir = self._run_session.workspace_dir / "web" / "samples" / run_key
        except Exception:
            logger.exception("Could not determine the metrics path for this run")
            return

        self._path = run_dir / METRICS_FILENAME
        # Buffered rows precede anything recorded since.
        self._pending = list(self._buffer) + self._pending
        self._buffer.clear()

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
