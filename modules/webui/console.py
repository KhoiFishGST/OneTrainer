import asyncio
import codecs
import contextlib
import os
import re
import sys
import threading
import time
from collections import deque
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

FG_MAP = {
    30: "fg-black",
    31: "fg-red",
    32: "fg-green",
    33: "fg-yellow",
    34: "fg-blue",
    35: "fg-magenta",
    36: "fg-cyan",
    37: "fg-white",
}
BG_MAP = {
    40: "bg-black",
    41: "bg-red",
    42: "bg-green",
    43: "bg-yellow",
    44: "bg-blue",
    45: "bg-magenta",
    46: "bg-cyan",
    47: "bg-white",
}

CSI_RE = re.compile(r"^\x1b\[([\d;]*)([\x40-\x7e])")
INCOMPLETE_CSI_RE = re.compile(r"^\x1b\[[\d;]*$")
OSC_RE = re.compile(r"^\x1b\].*?(\x07|\x1b\\)", re.DOTALL)
INCOMPLETE_OSC_RE = re.compile(r"^\x1b\][^\x07\x1b]*$")


@dataclass(frozen=True)
class ConsoleSpan:
    text: str
    classes: Sequence[str] = ()


@dataclass(frozen=True)
class ConsoleLine:
    id: int
    spans: Sequence[ConsoleSpan] = ()
    overwrite: bool = False

    @property
    def text(self) -> str:
        return "".join(span.text for span in self.spans)


class TerminalParser:
    def __init__(self) -> None:
        self._decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self._text_buffer: str = ""
        self._line_counter: int = 1
        self._current_spans: list[ConsoleSpan] = []
        self._current_text: list[str] = []
        self._active_classes: list[str] = []
        self._overwrite: bool = False
        self._pending_cr: bool = False

    def feed(self, chunk: bytes) -> list[ConsoleLine]:
        decoded = self._decoder.decode(chunk, final=False)
        if not decoded:
            return []

        self._text_buffer += decoded
        committed_lines: list[ConsoleLine] = []

        i = 0
        n = len(self._text_buffer)
        while i < n:
            ch = self._text_buffer[i]

            if ch == "\x1b":
                sub = self._text_buffer[i:]
                if sub.startswith("\x1b["):
                    match = CSI_RE.match(sub)
                    if match:
                        self._flush_text()
                        param_str, final_char = match.groups()
                        if final_char == "m":
                            codes = [int(p) if p else 0 for p in param_str.split(";")] if param_str else [0]
                            for code in codes:
                                self._apply_sgr_code(code)
                        i += match.end()
                        continue
                    if INCOMPLETE_CSI_RE.match(sub):
                        break
                    skip_match = re.search(r"[\x40-\x7e]", sub)
                    if skip_match:
                        i += skip_match.end()
                    else:
                        i += len(sub)
                    continue

                if sub.startswith("\x1b]"):
                    match = OSC_RE.match(sub)
                    if match:
                        self._flush_text()
                        i += match.end()
                        continue
                    if INCOMPLETE_OSC_RE.match(sub):
                        break
                    i += len(sub)
                    continue

                if len(sub) == 1:
                    break
                i += 2
                continue

            if ch == "\r":
                if self._pending_cr:
                    self._flush_text()
                    self._current_spans.clear()
                    self._current_text.clear()
                    self._overwrite = True
                self._pending_cr = True
                i += 1
                continue

            if ch == "\n":
                self._flush_text()
                if self._pending_cr:
                    self._pending_cr = False
                line = ConsoleLine(
                    id=self._line_counter,
                    spans=tuple(self._current_spans),
                    overwrite=False,
                )
                self._line_counter += 1
                committed_lines.append(line)
                self._current_spans.clear()
                self._current_text.clear()
                self._overwrite = False
                i += 1
                continue

            if self._pending_cr:
                self._pending_cr = False
                self._flush_text()
                self._current_spans.clear()
                self._current_text.clear()
                self._overwrite = True

            self._current_text.append(ch)
            i += 1

        self._text_buffer = self._text_buffer[i:]
        return committed_lines

    def snapshot_transient(self) -> ConsoleLine | None:
        spans = list(self._current_spans)
        if self._current_text:
            text = "".join(self._current_text)
            spans.append(ConsoleSpan(text, tuple(self._active_classes)))
        if not spans:
            return None
        return ConsoleLine(
            id=self._line_counter,
            spans=tuple(spans),
            overwrite=self._overwrite or self._pending_cr,
        )

    def _flush_text(self) -> None:
        if self._current_text:
            text = "".join(self._current_text)
            self._current_spans.append(ConsoleSpan(text, tuple(self._active_classes)))
            self._current_text.clear()

    def _apply_sgr_code(self, code: int) -> None:
        if code == 0:
            self._active_classes.clear()
        elif code == 1:
            if "bold" not in self._active_classes:
                self._active_classes.append("bold")
        elif code == 2:
            if "dim" not in self._active_classes:
                self._active_classes.append("dim")
        elif code == 3:
            if "italic" not in self._active_classes:
                self._active_classes.append("italic")
        elif code == 4:
            if "underline" not in self._active_classes:
                self._active_classes.append("underline")
        elif code == 22:
            if "bold" in self._active_classes:
                self._active_classes.remove("bold")
            if "dim" in self._active_classes:
                self._active_classes.remove("dim")
        elif code == 23:
            if "italic" in self._active_classes:
                self._active_classes.remove("italic")
        elif code == 24:
            if "underline" in self._active_classes:
                self._active_classes.remove("underline")
        elif code in FG_MAP:
            for c in list(self._active_classes):
                if c.startswith("fg-"):
                    self._active_classes.remove(c)
            self._active_classes.append(FG_MAP[code])
        elif code == 39:
            for c in list(self._active_classes):
                if c.startswith("fg-"):
                    self._active_classes.remove(c)
        elif code in BG_MAP:
            for c in list(self._active_classes):
                if c.startswith("bg-"):
                    self._active_classes.remove(c)
            self._active_classes.append(BG_MAP[code])
        elif code == 49:
            for c in list(self._active_classes):
                if c.startswith("bg-"):
                    self._active_classes.remove(c)


class ConsoleBuffer:
    def __init__(self, max_lines: int = 10000, max_bytes: int = 4 * 1024 * 1024) -> None:
        self._max_lines = max_lines
        self._max_bytes = max_bytes
        self._committed: deque[ConsoleLine] = deque()
        self._committed_bytes: int = 0
        self._transient: ConsoleLine | None = None
        self._lock = threading.Lock()

    def apply(self, lines: Sequence[ConsoleLine]) -> None:
        with self._lock:
            for line in lines:
                if line.overwrite:
                    self._transient = line
                else:
                    self._transient = None
                    line_bytes = len(line.text.encode("utf-8"))
                    self._committed.append(line)
                    self._committed_bytes += line_bytes

            while self._committed and (
                len(self._committed) > self._max_lines or self._committed_bytes > self._max_bytes
            ):
                popped = self._committed.popleft()
                self._committed_bytes -= len(popped.text.encode("utf-8"))

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "lines": list(self._committed),
                "transient": self._transient,
            }


class RotatingLogSink:
    def __init__(self, log_path: Path | str, max_bytes: int = 10 * 1024 * 1024) -> None:
        self._log_path = Path(log_path)
        self._max_bytes = max_bytes
        self._lock = threading.Lock()
        self._file: Any = None
        self._current_size: int = 0
        self._last_error: str | None = None
        self._open_file()

    def _open_file(self) -> None:
        try:
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            if self._log_path.exists():
                self._current_size = self._log_path.stat().st_size
            else:
                self._current_size = 0
            self._file = open(self._log_path, "ab")  # noqa: SIM115
            self._last_error = None
        except Exception as e:
            self._file = None
            self._last_error = str(e)

    def write(self, data: bytes) -> None:
        with self._lock:
            try:
                if self._file is None:
                    self._open_file()
                    if self._file is None:
                        return

                data_len = len(data)
                if self._current_size + data_len > self._max_bytes and self._current_size > 0:
                    self._rotate()

                if self._file:
                    self._file.write(data)
                    self._file.flush()
                    self._current_size += data_len
            except Exception as e:
                self._last_error = str(e)

    def _rotate(self) -> None:
        if self._file:
            with contextlib.suppress(Exception):
                self._file.close()
            self._file = None

        backup_path = self._log_path.with_name(self._log_path.name + ".1")
        try:
            if backup_path.exists():
                backup_path.unlink()
            if self._log_path.exists():
                self._log_path.replace(backup_path)
            self._file = open(self._log_path, "wb")  # noqa: SIM115
            self._current_size = 0
            self._last_error = None
        except Exception as e:
            self._file = None
            self._last_error = str(e)

    def reopen(self, new_path: Path | str) -> None:
        with self._lock:
            if self._file:
                with contextlib.suppress(Exception):
                    self._file.close()
                self._file = None
            self._log_path = Path(new_path)
            self._open_file()

    def close(self) -> None:
        with self._lock:
            if self._file:
                with contextlib.suppress(Exception):
                    self._file.close()
                self._file = None

    @property
    def last_error(self) -> str | None:
        return self._last_error


class ConsoleCapture:
    def __init__(self, max_lines: int = 10000, max_bytes: int = 4 * 1024 * 1024) -> None:
        self._buffer = ConsoleBuffer(max_lines=max_lines, max_bytes=max_bytes)
        self._parser = TerminalParser()
        self._sink: RotatingLogSink | None = None
        self._hub: Any = None
        self._loop: asyncio.AbstractEventLoop | None = None

        self._saved_stdout: int | None = None
        self._saved_stderr: int | None = None
        self._pipe_read_fd: int | None = None
        self._pipe_write_fd: int | None = None
        self._reader_thread: threading.Thread | None = None

        self._installed = False
        self._closed = False
        self._lock = threading.Lock()
        self._last_workspace_error: str | None = None

    @property
    def buffer(self) -> ConsoleBuffer:
        return self._buffer

    @property
    def sink(self) -> RotatingLogSink | None:
        return self._sink

    def install(self) -> None:
        with self._lock:
            if self._installed or self._closed:
                return

            self._saved_stdout = os.dup(1)
            self._saved_stderr = os.dup(2)

            self._pipe_read_fd, self._pipe_write_fd = os.pipe()

            os.dup2(self._pipe_write_fd, 1)
            os.dup2(self._pipe_write_fd, 2)

            self._installed = True

            self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
            self._reader_thread.start()

    def attach(
        self,
        loop: asyncio.AbstractEventLoop,
        hub: Any,
        workspace_dir: str | Path | None = None,
    ) -> None:
        with self._lock:
            self._loop = loop
            self._hub = hub

            snapshot = self._buffer.snapshot()
            lines: list[ConsoleLine] = list(snapshot["lines"])
            if snapshot["transient"] is not None:
                lines.append(snapshot["transient"])
            if lines:
                hub.publish_from_thread("console", {"lines": lines})

            if workspace_dir is not None:
                self.set_workspace(workspace_dir)

    def set_workspace(self, workspace_dir: str | Path | None) -> None:
        if workspace_dir is None:
            return
        log_path = Path(workspace_dir) / "webui.log"
        try:
            if self._sink is None:
                self._sink = RotatingLogSink(log_path)
            else:
                self._sink.reopen(log_path)
        except Exception as e:
            self._last_workspace_error = str(e)

    def _reader_loop(self) -> None:
        last_publish = time.monotonic()
        accumulated_lines: list[ConsoleLine] = []
        accumulated_bytes = 0

        while True:
            if self._pipe_read_fd is None:
                break
            try:
                data = os.read(self._pipe_read_fd, 4096)
            except OSError:
                break
            if not data:
                break

            if self._saved_stdout is not None:
                try:
                    os.write(self._saved_stdout, data)
                except OSError:
                    pass

            if self._sink is not None:
                self._sink.write(data)

            lines = self._parser.feed(data)
            if lines:
                self._buffer.apply(lines)
                accumulated_lines.extend(lines)
                accumulated_bytes += sum(len(l.text.encode("utf-8")) for l in lines)

            transient = self._parser.snapshot_transient()

            now = time.monotonic()
            hub = self._hub
            if hub is not None:
                if (
                    accumulated_lines
                    or transient is not None
                    or (now - last_publish >= 0.033)
                    or accumulated_bytes >= 64 * 1024
                ):
                    to_send: list[ConsoleLine] = list(accumulated_lines)
                    if transient is not None:
                        to_send.append(transient)
                    if to_send:
                        hub.publish_from_thread("console", {"lines": to_send})
                    accumulated_lines.clear()
                    accumulated_bytes = 0
                    last_publish = now

    def close(self) -> None:
        with self._lock:
            if not self._installed or self._closed:
                return
            self._closed = True

        with contextlib.suppress(Exception):
            sys.stdout.flush()
        with contextlib.suppress(Exception):
            sys.stderr.flush()

        if self._saved_stdout is not None:
            with contextlib.suppress(Exception):
                os.dup2(self._saved_stdout, 1)
        if self._saved_stderr is not None:
            with contextlib.suppress(Exception):
                os.dup2(self._saved_stderr, 2)

        if self._pipe_write_fd is not None:
            with contextlib.suppress(Exception):
                os.close(self._pipe_write_fd)
            self._pipe_write_fd = None

        if self._reader_thread is not None:
            self._reader_thread.join(timeout=5.0)

        if self._pipe_read_fd is not None:
            with contextlib.suppress(Exception):
                os.close(self._pipe_read_fd)
            self._pipe_read_fd = None

        transient = self._parser.snapshot_transient()
        if transient is not None:
            self._buffer.apply([transient])
            if self._hub is not None:
                self._hub.publish_from_thread("console", {"lines": [transient]})

        if self._sink is not None:
            self._sink.close()

        if self._saved_stdout is not None:
            with contextlib.suppress(Exception):
                os.close(self._saved_stdout)
            self._saved_stdout = None
        if self._saved_stderr is not None:
            with contextlib.suppress(Exception):
                os.close(self._saved_stderr)
            self._saved_stderr = None

