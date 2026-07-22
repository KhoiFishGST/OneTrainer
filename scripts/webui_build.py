import argparse
import hashlib
import sys
from pathlib import Path


def build_digest(web_dir: Path) -> str:
    hasher = hashlib.sha256()
    input_paths: list[Path] = []

    src_dir = web_dir / "src"
    if src_dir.is_dir():
        for path in src_dir.rglob("*"):
            if path.is_file():
                input_paths.append(path)

    top_level_files = [
        "package.json",
        "bun.lock",
        "svelte.config.js",
        "vite.config.ts",
        "tsconfig.json",
    ]
    for filename in top_level_files:
        path = web_dir / filename
        if path.is_file():
            input_paths.append(path)

    input_paths.sort(key=lambda p: p.relative_to(web_dir).as_posix())

    for path in input_paths:
        rel_path = path.relative_to(web_dir).as_posix()
        hasher.update(rel_path.encode("utf-8"))
        hasher.update(path.read_bytes())

    return hasher.hexdigest()


def build_is_current(web_dir: Path) -> bool:
    index_file = web_dir / "build" / "index.html"
    stamp_file = web_dir / ".build-source"
    if not index_file.is_file() or not stamp_file.is_file():
        return False

    try:
        current_stamp = stamp_file.read_text(encoding="utf-8").strip()
    except OSError:
        return False

    return current_stamp == build_digest(web_dir)


def mark_build_current(web_dir: Path) -> None:
    stamp = build_digest(web_dir)
    stamp_file = web_dir / ".build-source"
    tmp_file = web_dir / ".build-source.tmp"
    tmp_file.write_text(stamp, encoding="utf-8")
    tmp_file.replace(stamp_file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Web UI build helper")
    parser.add_argument("--web-dir", type=Path, default=None, help="Path to web directory")
    parser.add_argument("--check", action="store_true", help="Check if build is current")
    parser.add_argument("--mark", action="store_true", help="Mark build as current")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    web_dir = args.web_dir or (repo_root / "web")

    if args.check:
        if build_is_current(web_dir):
            sys.exit(0)
        else:
            sys.exit(1)
    elif args.mark:
        mark_build_current(web_dir)
        sys.exit(0)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
