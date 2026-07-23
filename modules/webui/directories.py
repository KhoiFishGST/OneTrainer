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


def _normalize_extensions(extensions: str | list[str] | set[str] | None) -> set[str] | None:
    if not extensions:
        return None
    if isinstance(extensions, str):
        raw_list = [e.strip() for e in extensions.split(",") if e.strip()]
    else:
        raw_list = [str(e).strip() for e in extensions if str(e).strip()]

    normalized = set()
    for ext in raw_list:
        ext_lower = ext.lower()
        if not ext_lower.startswith("."):
            ext_lower = "." + ext_lower
        normalized.add(ext_lower)
    return normalized if normalized else None


class DirectoryService:
    def __init__(self, max_entries: int = 5000):
        self.max_entries = max_entries

    def list(
        self,
        raw_path: str | Path = "",
        mode: str = "both",
        extensions: str | list[str] | set[str] | None = None,
        show_hidden: bool = False,
    ) -> dict:
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

        normalized_mode = mode.lower() if mode else "both"
        ext_set = _normalize_extensions(extensions)

        entries = []
        for child in children:
            if not show_hidden and child.name.startswith("."):
                continue

            try:
                is_dir = child.is_dir()
            except (PermissionError, OSError):
                continue

            if normalized_mode in ("dir", "directories", "directory") and not is_dir:
                continue
            if normalized_mode in ("file", "files") and is_dir:
                continue

            if not is_dir and ext_set is not None:
                name_lower = child.name.lower()
                suffix_lower = child.suffix.lower()
                matches = suffix_lower in ext_set or any(name_lower.endswith(ext) for ext in ext_set)
                if not matches:
                    continue

            try:
                st = child.stat()
                size_bytes = st.st_size if not is_dir else 0
                modified = float(st.st_mtime)
            except Exception:
                size_bytes = 0
                modified = 0.0

            try:
                child_path = str(child.resolve())
            except Exception:
                child_path = str(child)

            entries.append({
                "name": child.name,
                "path": child_path,
                "is_dir": is_dir,
                "size_bytes": size_bytes,
                "modified": modified,
            })

        entries.sort(key=lambda item: (not item["is_dir"], item["name"].lower()))

        truncated = len(entries) > self.max_entries
        if truncated:
            entries = entries[: self.max_entries]

        parent = resolved.parent
        has_parent = parent != resolved
        parent_path = str(parent) if has_parent else None

        directories_legacy = [
            {
                "name": item["name"],
                "path": item["path"],
            }
            for item in entries
            if item["is_dir"]
        ]

        return {
            "path": str(resolved),
            "current_path": str(resolved),
            "parent": parent_path,
            "parent_path": parent_path,
            "has_parent": has_parent,
            "roots": _get_platform_roots(),
            "directories": directories_legacy,
            "entries": entries,
            "truncated": truncated,
        }

