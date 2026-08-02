import contextlib
import hashlib
from dataclasses import dataclass
from pathlib import Path

# The run key is the stem of the timestamped config file GenericTrainer writes
# at run start (GenericTrainer.py:164-169). It cannot simply be "the newest
# json" -- the workspace config directory also holds files the user saved by
# hand -- so we snapshot signatures before the run and look for the single
# entry that is new or has changed since.


@dataclass(frozen=True)
class FileSignature:
    mtime_ns: int
    size: int
    sha256: str


@dataclass(frozen=True)
class RunKeyResult:
    key: str | None
    config_filename: str | None
    reason: str | None


def file_signature(path: Path) -> FileSignature:
    stat = path.stat()
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1024 * 1024):
            digest.update(chunk)
    return FileSignature(
        mtime_ns=stat.st_mtime_ns,
        size=stat.st_size,
        sha256=digest.hexdigest(),
    )


class RunKeyResolver:
    def __init__(self) -> None:
        self._signatures: dict[str, FileSignature] = {}

    def snapshot(self, config_dir: Path) -> None:
        self._signatures.clear()
        if not config_dir.is_dir():
            return
        for item in config_dir.iterdir():
            if item.is_file() and item.suffix.lower() == ".json":
                with contextlib.suppress(OSError):
                    self._signatures[item.name] = file_signature(item)

    def resolve(self, config_dir: Path, prefix: str) -> RunKeyResult:
        if not config_dir.is_dir():
            return RunKeyResult(None, None, "no_config_dir")

        candidates: list[Path] = []
        for item in config_dir.iterdir():
            if not (item.is_file() and item.suffix.lower() == ".json"):
                continue
            if prefix and not item.name.startswith(prefix):
                continue

            if item.name not in self._signatures:
                candidates.append(item)
            else:
                with contextlib.suppress(OSError):
                    if file_signature(item) != self._signatures[item.name]:
                        candidates.append(item)

        if len(candidates) == 0:
            return RunKeyResult(None, None, "missing")
        if len(candidates) > 1:
            return RunKeyResult(None, None, "ambiguous")

        candidate = candidates[0]
        return RunKeyResult(candidate.stem, candidate.name, None)
