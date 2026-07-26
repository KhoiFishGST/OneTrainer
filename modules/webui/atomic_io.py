import hashlib
import json
import os
import shutil
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from PIL import Image


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
