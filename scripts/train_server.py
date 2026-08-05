from util.import_util import script_imports

script_imports(allow_zluda=False)

import argparse
from pathlib import Path

from modules.api.rest.app import create_app

import uvicorn

# Not a flag. The upstream server is loopback-only by design: it can start
# training and read config files, and an exposed HTTP port has no transport
# security under it. Anything that needs remote access must put its own
# authenticated server in front.
HOST = "127.0.0.1"

DEFAULT_PORT = 7800


def parse_args(args: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OneTrainer REST API server")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        dest="port",
        help=f"Port to listen on (default: {DEFAULT_PORT})",
    )
    return parser.parse_args(args)


def main() -> None:
    args = parse_args()
    root_dir = Path(__file__).resolve().parent.parent

    print(f"OneTrainer REST API  ->  http://{HOST}:{args.port}")
    print("  Only this machine can reach it.")

    uvicorn.run(create_app(root_dir=root_dir), host=HOST, port=args.port)


if __name__ == "__main__":
    main()
