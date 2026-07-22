import argparse
import sys
from pathlib import Path

try:
    from scripts.util.import_util import script_imports
except ImportError:
    from util.import_util import script_imports

script_imports(allow_zluda=False)

import uvicorn
from modules.webui.app import create_app
from modules.webui.console import ConsoleCapture
from modules.webui.state import WebUISettings


def parse_args(args: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OneTrainer Web UI")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind to")
    parser.add_argument("--port", type=int, default=7801, help="Port to listen on")
    parser.add_argument("--dev", action="store_true", help="Enable dev mode (skips build check, enables CORS)")
    return parser.parse_args(args)


def make_settings(root_dir: Path, dev: bool = False) -> WebUISettings:
    return WebUISettings(
        root_dir=root_dir,
        config_path=root_dir / "config.json",
        secrets_path=root_dir / "secrets.json",
        presets_dir=root_dir / "presets",
        static_dir=root_dir / "web" / "build",
        dev=dev,
    )


def validate_static_build(settings: WebUISettings) -> None:
    if settings.dev:
        return
    index_file = settings.static_dir / "index.html"
    if not index_file.is_file():
        sys.exit("Frontend build is missing")


def exposure_warning(host: str) -> str | None:
    if host in ("127.0.0.1", "localhost", "::1"):
        return None
    return "Web UI has no authentication and is exposed to the network"


def main() -> None:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    settings = make_settings(repo_root, dev=args.dev)
    validate_static_build(settings)

    warning = exposure_warning(args.host)
    if warning:
        print(f"Warning: {warning}", file=sys.stderr)

    capture = ConsoleCapture()
    capture.install()
    try:
        app = create_app(settings, capture=capture)
        uvicorn.run(app, host=args.host, port=args.port)
    finally:
        capture.close()


if __name__ == "__main__":
    main()
