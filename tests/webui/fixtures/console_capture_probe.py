import asyncio
import dataclasses
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from modules.webui.console import ConsoleCapture
from modules.webui.events import EventHub


def _json_default(obj):
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


async def main():
    result_path = Path(sys.argv[1])
    hub = EventHub()
    await hub.start()
    capture = ConsoleCapture()
    capture.install()
    capture.attach(asyncio.get_running_loop(), hub, tempfile.mkdtemp())
    print("stdout-line", flush=True)
    os.write(2, b"stderr-line\n")
    os.write(1, b"\r10%")
    os.write(1, b"\r20%\n")
    await asyncio.sleep(0.1)
    capture.close()
    await asyncio.sleep(0)
    result_path.write_text(json.dumps(await hub.backlog(), default=_json_default), encoding="utf-8")
    await hub.close()


asyncio.run(main())
