import asyncio
import contextlib
import queue
import uuid
from collections import deque
from typing import Any

from modules.webui.console import ConsoleBuffer, ConsoleLine, ConsoleSpan


def _to_console_line(item: Any) -> ConsoleLine:
    if isinstance(item, ConsoleLine):
        return item
    if isinstance(item, dict):
        line_id = item.get("id", 0)
        overwrite = item.get("overwrite", False)
        raw_spans = item.get("spans", ())
        spans: list[ConsoleSpan] = []
        for s in raw_spans:
            if isinstance(s, ConsoleSpan):
                spans.append(s)
            elif isinstance(s, dict):
                spans.append(ConsoleSpan(text=s.get("text", ""), classes=tuple(s.get("classes", ()))))
        return ConsoleLine(id=line_id, spans=tuple(spans), overwrite=overwrite)
    return ConsoleLine(id=0, spans=(), overwrite=False)


class EventSubscription:
    def __init__(self, hub: "EventHub", maxsize: int) -> None:
        self._hub = hub
        self._maxsize = maxsize
        self._queue: deque[dict[str, Any]] = deque()
        self._has_gap = False
        self._closed = False
        self._event = asyncio.Event()
        self._consecutive_drop_failures = 0

    def offer(self, event: dict[str, Any]) -> None:
        if self._closed:
            return

        if len(self._queue) < self._maxsize:
            self._queue.append(event)
            self._event.set()
            self._consecutive_drop_failures = 0
            return

        dropped = False
        for idx, item in enumerate(self._queue):
            if item.get("type") == "console":
                del self._queue[idx]
                self._has_gap = True
                dropped = True
                break

        if not dropped:
            if event.get("type") == "config_changed":
                for idx, item in enumerate(self._queue):
                    if item.get("type") == "config_changed":
                        del self._queue[idx]
                        self._has_gap = True
                        dropped = True
                        break

        if dropped:
            self._queue.append(event)
            self._event.set()
            self._consecutive_drop_failures = 0
        else:
            self._consecutive_drop_failures += 1
            if self._consecutive_drop_failures >= 3:
                self.close()

    def __aiter__(self) -> "EventSubscription":
        return self

    async def __anext__(self) -> dict[str, Any]:
        while True:
            if self._queue:
                item = self._queue.popleft()
                if self._has_gap:
                    item = dict(item)
                    item["gap"] = True
                    self._has_gap = False
                return item

            if self._closed:
                raise StopAsyncIteration

            self._event.clear()
            if self._closed:
                raise StopAsyncIteration
            await self._event.wait()

    async def aclose(self) -> None:
        if not self._closed:
            self._closed = True
            self._event.set()
            self._hub._unregister_subscriber(self)

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            self._event.set()
            self._hub._unregister_subscriber(self)

    async def __aenter__(self) -> "EventSubscription":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.aclose()


class EventHub:
    def __init__(
        self,
        console: ConsoleBuffer | None = None,
        ingress_size: int = 2048,
        client_size: int = 256,
    ) -> None:
        self._console = console if console is not None else ConsoleBuffer()
        self._ingress_size = ingress_size
        self._client_size = client_size
        self._stream_id = str(uuid.uuid4())
        self._seq = 0
        self._latest_revision: str | None = None
        self._lock = asyncio.Lock()

        self._subscribers: set[EventSubscription] = set()
        self._ingress_queue: queue.Queue[tuple[str, dict[str, Any]]] | None = None
        self._ingress_gap = False
        self._ingress_event = asyncio.Event()
        self._running = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._drain_task: asyncio.Task[None] | None = None

    @property
    def stream_id(self) -> str:
        return self._stream_id

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._ingress_queue = queue.Queue(maxsize=self._ingress_size)
        self._running = True
        self._drain_task = self._loop.create_task(self._drain_loop())

    async def close(self) -> None:
        self._running = False
        self._ingress_event.set()
        if self._drain_task is not None:
            with contextlib.suppress(asyncio.CancelledError):
                await self._drain_task
            self._drain_task = None

        for sub in list(self._subscribers):
            sub.close()
        self._subscribers.clear()

    def publish_from_thread(self, event_type: str, data: dict[str, Any] | None = None) -> None:
        if not self._running or self._ingress_queue is None:
            return

        payload = data if data is not None else {}
        item = (event_type, payload)
        try:
            self._ingress_queue.put_nowait(item)
        except queue.Full:
            try:
                self._ingress_queue.get_nowait()
            except queue.Empty:
                pass
            self._ingress_gap = True
            try:
                self._ingress_queue.put_nowait(item)
            except queue.Full:
                pass

        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._ingress_event.set)

    async def publish(self, event_type: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = data if data is not None else {}
        async with self._lock:
            self._seq += 1
            if "revision" in payload:
                self._latest_revision = str(payload["revision"])

            if event_type == "console" and "lines" in payload:
                raw_lines = payload["lines"]
                lines = [_to_console_line(item) for item in raw_lines]
                self._console.apply(lines)

            event = {
                **payload,
                "stream_id": self._stream_id,
                "seq": self._seq,
                "type": event_type,
            }

            for sub in list(self._subscribers):
                sub.offer(event)

            return event

    async def backlog(self) -> dict[str, Any]:
        async with self._lock:
            snapshot = self._console.snapshot()
            return {
                "stream_id": self._stream_id,
                "cursor": self._seq,
                "revision": self._latest_revision,
                "lines": snapshot["lines"],
                "transient": snapshot["transient"],
            }

    def subscribe(self) -> EventSubscription:
        sub = EventSubscription(self, maxsize=self._client_size)
        self._subscribers.add(sub)
        return sub

    def _unregister_subscriber(self, sub: EventSubscription) -> None:
        self._subscribers.discard(sub)

    async def _drain_ingress(self) -> None:
        if self._ingress_queue is not None:
            while not self._ingress_queue.empty():
                try:
                    event_type, payload = self._ingress_queue.get_nowait()
                except queue.Empty:
                    break

                gap = self._ingress_gap
                self._ingress_gap = False
                if gap:
                    payload = dict(payload)
                    payload["gap"] = True

                await self.publish(event_type, payload)

    async def _drain_loop(self) -> None:
        while self._running:
            self._ingress_event.clear()
            await self._drain_ingress()

            if not self._running:
                break
            try:
                await asyncio.wait_for(self._ingress_event.wait(), timeout=0.05)
            except asyncio.TimeoutError:
                pass

        await self._drain_ingress()
