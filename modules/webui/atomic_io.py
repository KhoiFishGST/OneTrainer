import hashlib
import json
import logging
import os
import shutil
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)


def _temporary_path(destination: Path) -> tuple[int, Path]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, path_str = tempfile.mkstemp(prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent)
    return fd, Path(path_str)


def write_json_atomic(path: Path, value: object) -> None:
    fd, temporary = _temporary_path(path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump(value, file, indent=2, ensure_ascii=True)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def copy_file_atomic(source: Path, destination: Path) -> str:
    fd, temporary = _temporary_path(destination)
    digest = hashlib.sha256()
    try:
        with source.open("rb") as source_file, os.fdopen(fd, "wb") as destination_file:
            while chunk := source_file.read(1024 * 1024):
                destination_file.write(chunk)
                digest.update(chunk)
            destination_file.flush()
            os.fsync(destination_file.fileno())
        shutil.copymode(source, temporary)
        os.replace(temporary, destination)
        return digest.hexdigest()
    finally:
        temporary.unlink(missing_ok=True)


def save_pil_atomic(
    image: Image.Image,
    destination: Path,
    *,
    image_format: str,
    save_kwargs: Mapping[str, Any] | None = None,
) -> str:
    fd, temporary = _temporary_path(destination)
    os.close(fd)
    try:
        image.save(temporary, format=image_format, **dict(save_kwargs or {}))
        with temporary.open("rb+") as file:
            file.flush()
            os.fsync(file.fileno())
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        os.replace(temporary, destination)
        return digest
    finally:
        temporary.unlink(missing_ok=True)


def volume_key(path: Path) -> object:
    """Identify the filesystem a path lives on, for caching link support.

    st_dev is the correct key on POSIX (a path's anchor is "/" even across
    mounts) and is the volume serial number on Windows. The path may not exist
    yet -- it is usually a destination -- so walk up to the nearest parent that
    does.
    """
    probe = Path(path)
    while True:
        try:
            return os.stat(probe).st_dev
        except OSError:
            if probe.parent == probe:
                return None
            probe = probe.parent


def link_or_copy(source: Path, destination: Path, *, allow_link: bool = True) -> bool:
    """Hardlink source to destination, falling back to a byte copy.

    Returns True when hardlinked. Hardlinks need the same volume and a
    filesystem that supports them (NTFS yes, FAT32/exFAT/network shares no) but,
    unlike Windows symlinks, need no elevation.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)

    if allow_link:
        try:
            os.link(source, destination)
            return True
        except OSError:
            logger.debug("Hardlink failed for %s, copying instead", source, exc_info=True)

    # Atomic rather than a plain copyfile: a crash partway through a
    # multi-gigabyte copy would otherwise leave a truncated file with no
    # manifest entry -- invisible in the UI and not removable through it.
    copy_file_atomic(source, destination)
    return False


def link_or_copy_with_digest(
    source: Path,
    destination: Path,
    *,
    allow_link: bool = True,
) -> tuple[bool, str]:
    """link_or_copy, plus the sha256 of the content.

    The gallery serves this digest as a sample's ETag, so it must be identical
    whichever path was taken. Linking hashes the (now shared) inode in one extra
    read; copying gets the digest for free from copy_file_atomic.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)

    if allow_link:
        try:
            os.link(source, destination)
        except OSError:
            logger.debug("Hardlink failed for %s, copying instead", source, exc_info=True)
        else:
            digest = hashlib.sha256()
            with destination.open("rb") as handle:
                while chunk := handle.read(1024 * 1024):
                    digest.update(chunk)
            return True, digest.hexdigest()

    return False, copy_file_atomic(source, destination)

