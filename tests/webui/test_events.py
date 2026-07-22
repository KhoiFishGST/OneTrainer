import asyncio
import threading

import pytest

from modules.webui.console import ConsoleBuffer
from modules.webui.events import EventHub


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_events_have_one_stream_and_monotonic_sequences():
    hub = EventHub(ConsoleBuffer(), ingress_size=8, client_size=8)
    await hub.start()
    first = await hub.publish("config_changed", {"revision": "i:1"})
    second = await hub.publish("config_changed", {"revision": "i:2"})
    assert first["stream_id"] == second["stream_id"]
    assert second["seq"] == first["seq"] + 1
    await hub.close()


@pytest.mark.anyio
async def test_slow_client_drops_console_but_keeps_latest_revision():
    hub = EventHub(ConsoleBuffer(), ingress_size=8, client_size=2)
    await hub.start()
    subscription = hub.subscribe()
    iterator = subscription.__aiter__()
    await hub.publish("console", {"lines": [{"id": 1, "spans": [], "overwrite": False}]})
    await hub.publish("console", {"lines": [{"id": 2, "spans": [], "overwrite": False}]})
    await hub.publish("config_changed", {"revision": "i:3"})
    received = [await asyncio.wait_for(iterator.__anext__(), 1) for _ in range(2)]
    assert received[-1]["type"] == "config_changed"
    assert received[-1]["revision"] == "i:3"
    assert any(event.get("gap") for event in received)
    await subscription.aclose()
    await hub.close()


@pytest.mark.anyio
async def test_backlog_returns_snapshot_cursor_and_revision():
    buffer = ConsoleBuffer()
    hub = EventHub(buffer)
    await hub.start()
    event = await hub.publish("config_changed", {"revision": "i:1"})
    backlog = await hub.backlog()
    assert backlog["stream_id"] == event["stream_id"]
    assert backlog["cursor"] == event["seq"]
    assert backlog["revision"] == "i:1"
    await hub.close()


@pytest.mark.anyio
async def test_publish_from_thread_delivers_events():
    hub = EventHub(ConsoleBuffer(), ingress_size=16, client_size=16)
    await hub.start()
    subscription = hub.subscribe()
    iterator = subscription.__aiter__()

    def produce():
        for i in range(10):
            hub.publish_from_thread("console", {"lines": [{"id": i, "spans": [], "overwrite": False}]})

    thread = threading.Thread(target=produce)
    thread.start()
    thread.join()

    received = []
    for _ in range(10):
        event = await asyncio.wait_for(iterator.__anext__(), timeout=2.0)
        received.append(event)

    assert len(received) == 10
    assert [e["lines"][0]["id"] for e in received] == list(range(10))

    await subscription.aclose()
    await hub.close()


@pytest.mark.anyio
async def test_publish_from_thread_when_ingress_full_records_gap():
    hub = EventHub(ConsoleBuffer(), ingress_size=2, client_size=8)
    await hub.start()
    subscription = hub.subscribe()
    iterator = subscription.__aiter__()

    # Publish 4 items into ingress queue of size 2
    hub.publish_from_thread("console", {"msg": "1"})
    hub.publish_from_thread("console", {"msg": "2"})
    hub.publish_from_thread("console", {"msg": "3"})
    hub.publish_from_thread("console", {"msg": "4"})

    # Wait for drain task to process events
    await asyncio.sleep(0.1)

    received = []
    while True:
        try:
            event = await asyncio.wait_for(iterator.__anext__(), timeout=0.1)
            received.append(event)
        except asyncio.TimeoutError:
            break

    assert len(received) > 0
    assert any(event.get("gap") for event in received)

    await subscription.aclose()
    await hub.close()
