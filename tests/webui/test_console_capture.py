import asyncio
import json
import subprocess
import sys
from pathlib import Path

from modules.webui.console import ConsoleCapture
from modules.webui.events import EventHub


def test_capture_tees_stdout_stderr_and_restores_descriptors(tmp_path):
    result = tmp_path / "result.json"
    process = subprocess.run(
        [sys.executable, "tests/webui/fixtures/console_capture_probe.py", str(result)],
        capture_output=True,
        text=True,
        check=True,
    )
    backlog = json.loads(result.read_text(encoding="utf-8"))
    browser_text = "\n".join("".join(span["text"] for span in line["spans"]) for line in backlog["lines"])
    assert "stdout-line" in process.stdout
    assert "stderr-line" in process.stdout
    assert "stdout-line" in browser_text
    assert "stderr-line" in browser_text
    assert "20%" in browser_text


def test_capture_workspace_and_sink_creation(tmp_path):
    capture = ConsoleCapture()
    capture.set_workspace(tmp_path)
    assert capture.sink is not None
    assert (tmp_path / "webui.log").exists()
    capture.close()
    capture.close()  # Idempotent close


def test_capture_attach_transfers_buffer(tmp_path):
    async def run_test():
        hub = EventHub()
        await hub.start()
        capture = ConsoleCapture()
        capture.buffer.apply([
            __import__("modules.webui.console", fromlist=["ConsoleLine"]).ConsoleLine(
                id=1,
                spans=(__import__("modules.webui.console", fromlist=["ConsoleSpan"]).ConsoleSpan("preset-line"),),
            )
        ])
        capture.attach(asyncio.get_running_loop(), hub, tmp_path)
        await asyncio.sleep(0.05)
        backlog = await hub.backlog()
        assert len(backlog["lines"]) == 1
        assert backlog["lines"][0].text == "preset-line"
        capture.close()
        await hub.close()

    asyncio.run(run_test())

