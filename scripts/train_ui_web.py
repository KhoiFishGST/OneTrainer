import argparse
import contextlib
import sys
from pathlib import Path

try:
    from scripts.util.import_util import script_imports
except ImportError:
    from util.import_util import script_imports

script_imports(allow_zluda=False)

from modules.webui.app import create_app
from modules.webui.console import ConsoleCapture
from modules.webui.settings_store import SettingsStore
from modules.webui.state import WebUISettings

import uvicorn


def parse_args(args: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OneTrainer Web UI")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind to")
    parser.add_argument("--port", type=int, default=7801, help="Port to listen on")
    parser.add_argument("--dev", action="store_true", help="Enable dev mode (skips build check, enables CORS)")
    return parser.parse_args(args)


def make_settings(root_dir: Path, dev: bool = False) -> WebUISettings:
    return WebUISettings(
        root_dir=root_dir,
        config_path=root_dir / "training_presets" / "#.json",
        secrets_path=root_dir / "secrets.json",
        presets_dir=root_dir / "training_presets",
        static_dir=root_dir / "web" / "build",
        dev=dev,
    )


def validate_static_build(settings: WebUISettings) -> None:
    if settings.dev:
        return
    index_file = settings.static_dir / "index.html"
    if not index_file.is_file():
        sys.exit("Frontend build is missing")


LOOPBACK_HOSTS = ("127.0.0.1", "localhost", "::1")


def exposure_warning(host: str, *, has_password: bool) -> str | None:
    """The warning to print when the UI is reachable beyond this machine.

    Silent for a loopback bind, and silent once a password is set -- the
    previous version fired on every non-loopback bind regardless, including
    authenticated ones, which is how a warning gets tuned out.
    """
    if host in LOOPBACK_HOSTS or has_password:
        return None

    return (
        "This Web UI is reachable from the network and has no password set.\n"
        "  Anyone who can reach it can browse and upload files, read your\n"
        "  Hugging Face token, and start training on this machine.\n"
        "  Set a password under Settings, or bind to 127.0.0.1 instead."
    )


def startup_banner(host: str, port: int) -> str:
    """What to print once the server is up, so the URL is never a guess."""
    if host in LOOPBACK_HOSTS:
        return (
            f"OneTrainer Web UI  ->  http://{host}:{port}\n"
            "  Only this machine can reach it. To open it on your phone or\n"
            "  another computer, restart with:  --host 0.0.0.0"
        )

    # 0.0.0.0 is a bind address, not somewhere a browser can go, so printing it
    # as a URL would just send people to a dead link. The machine's actual LAN
    # address is what they need, and it is not ours to guess reliably.
    return (
        f"OneTrainer Web UI listening on every network interface, port {port}\n"
        "  Reach it from another device at http://<this machine's IP>:"
        f"{port}"
    )


def main() -> None:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    settings = make_settings(repo_root, dev=args.dev)
    validate_static_build(settings)

    # Read the password state directly rather than through the app: the banner
    # prints before create_app builds its own SettingsStore. has_password()
    # fails closed, so an unreadable settings file suppresses the warning
    # rather than crying wolf.
    settings_store = SettingsStore(settings.root_dir / "webui.json")
    has_password = True
    with contextlib.suppress(Exception):
        has_password = settings_store.has_password()

    print(startup_banner(args.host, args.port))

    warning = exposure_warning(args.host, has_password=has_password)
    if warning:
        print(f"\nWarning: {warning}\n", file=sys.stderr)

    capture = ConsoleCapture()
    capture.install()
    try:
        app = create_app(settings, capture=capture)
        uvicorn.run(app, host=args.host, port=args.port)
    finally:
        capture.close()


if __name__ == "__main__":
    main()
