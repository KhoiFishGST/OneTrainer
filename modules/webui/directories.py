import sys
from pathlib import Path


class DirectoryMissing(Exception):
    pass


class DirectoryDenied(Exception):
    pass


def _get_platform_roots() -> list[str]:
    if sys.platform == "win32":
        import string
        from ctypes import windll

        drives = []
        try:
            bitmask = windll.kernel32.GetLogicalDrives()
            for letter in string.ascii_uppercase:
                if bitmask & 1:
                    drives.append(f"{letter}:\\")
                bitmask >>= 1
        except Exception:
            pass
        return drives or ["C:\\"]
    return ["/"]


class DirectoryService:
    def __init__(self, max_entries: int = 5000):
        self.max_entries = max_entries

    def list(self, raw_path: str | Path = "") -> dict:
        target_path = Path(raw_path) if raw_path else Path.cwd()
        try:
            resolved = target_path.expanduser().resolve(strict=True)
        except FileNotFoundError as error:
            raise DirectoryMissing(f"Directory missing: {raw_path}") from error
        except PermissionError as error:
            raise DirectoryDenied(f"Permission denied: {raw_path}") from error

        if not resolved.is_dir():
            raise DirectoryMissing(f"Not a directory: {raw_path}")

        try:
            children = list(resolved.iterdir())
        except PermissionError as error:
            raise DirectoryDenied(f"Permission denied reading directory: {resolved}") from error

        directories = []
        for child in children:
            try:
                if child.is_dir():
                    directories.append(child)
            except PermissionError:
                continue

        directories.sort(key=lambda item: item.name.lower())

        truncated = len(directories) > self.max_entries
        if truncated:
            directories = directories[: self.max_entries]

        parent = resolved.parent
        has_parent = parent != resolved
        parent_path = str(parent) if has_parent else None

        return {
            "path": str(resolved),
            "parent": parent_path,
            "has_parent": has_parent,
            "roots": _get_platform_roots(),
            "directories": [
                {
                    "name": item.name,
                    "path": str(item.resolve()),
                }
                for item in directories
            ],
            "truncated": truncated,
        }
