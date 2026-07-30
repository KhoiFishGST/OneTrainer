import argparse
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

repo_root = Path(__file__).resolve().parents[3]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.app import create_app
from modules.webui.config_io import save_settings
from modules.webui.console import ConsoleCapture
from modules.webui.state import WebUISettings

import uvicorn
from fastapi import FastAPI


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OneTrainer E2E Server Fixture")
    parser.add_argument("--root", type=str, required=True, help="Temporary root directory")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind to")
    parser.add_argument("--port", type=int, default=7801, help="Port to listen on")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root_dir = Path(args.root).resolve()
    root_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(root_dir)

    settings = WebUISettings(
        root_dir=root_dir,
        config_path=root_dir / "config.json",
        secrets_path=root_dir / "secrets.json",
        presets_dir=root_dir / "presets",
        static_dir=repo_root / "web" / "build",
        dev=False,
    )

    settings.presets_dir.mkdir(parents=True, exist_ok=True)
    (root_dir / "dir_a").mkdir(parents=True, exist_ok=True)
    (root_dir / "dir_b").mkdir(parents=True, exist_ok=True)

    if not settings.config_path.is_file():
        default_config = TrainConfig.default_values()
        save_settings(default_config, settings.config_path)

    capture = ConsoleCapture()
    capture.install()

    app = create_app(settings, capture=capture)
    original_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def e2e_lifespan(fastapi_app: FastAPI):
        async with original_lifespan(fastapi_app):
            os.write(1, b"stdout-line\n")
            os.write(2, b"stderr-line\n")
            os.write(1, b"\r10%")
            os.write(1, b"\r20%\n")
            yield

    app.router.lifespan_context = e2e_lifespan

    try:
        uvicorn.run(app, host=args.host, port=args.port)
    finally:
        capture.close()


if __name__ == "__main__":
    main()
