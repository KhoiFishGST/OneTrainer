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


def _has_changed(path: Path, known: FileSignature) -> bool:
    """Whether a config differs from its snapshot, hashing only when it might.

    candidates() sits on the metrics hot path until a run resolves, and a run
    that never resolves keeps calling it for its whole life. Hashing every saved
    config on every call cost megabytes of sha256 per second there, so matching
    mtime and size settle it without reading the file. Only when the cheap
    metadata disagrees does the content hash decide -- which also means a bare
    `touch` no longer registers as a new candidate.
    """
    stat = path.stat()
    if stat.st_mtime_ns == known.mtime_ns and stat.st_size == known.size:
        return False
    return file_signature(path).sha256 != known.sha256


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

    def candidates(self, config_dir: Path, prefix: str) -> list[Path]:
        """Configs that are new or changed since the snapshot, prefix-filtered."""
        if not config_dir.is_dir():
            return []

        found: list[Path] = []
        for item in config_dir.iterdir():
            if not (item.is_file() and item.suffix.lower() == ".json"):
                continue
            if prefix and not item.name.startswith(prefix):
                continue

            known = self._signatures.get(item.name)
            if known is None:
                found.append(item)
            else:
                with contextlib.suppress(OSError):
                    if _has_changed(item, known):
                        found.append(item)

        return found

    def resolve(self, config_dir: Path, prefix: str) -> RunKeyResult:
        if not config_dir.is_dir():
            return RunKeyResult(None, None, "no_config_dir")

        found = self.candidates(config_dir, prefix)

        if len(found) == 0:
            return RunKeyResult(None, None, "missing")
        if len(found) > 1:
            return RunKeyResult(None, None, "ambiguous")

        candidate = found[0]
        return RunKeyResult(candidate.stem, candidate.name, None)
