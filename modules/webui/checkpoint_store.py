import logging
import os
import shutil
from pathlib import Path

from modules.util.enum.ModelFormat import ModelFormat

logger = logging.getLogger(__name__)

# Deliberately distinct from the gallery's <workspace>/web/samples.
CHECKPOINTS_SUBDIR = ("webui", "checkpoints")
MANIFEST_FILENAME = "manifest.json"

KIND_SAVE = "save"
KIND_FINAL = "final"

# GenericTrainer.py:484-488 writes every scheduled and on-demand save into
# <workspace>/save/. Backups go to <workspace>/backup/ in INTERNAL format, and
# the final model goes wherever output_model_destination points.
SAVE_DIRNAME = "save"


def classify(model_format: ModelFormat, destination: str) -> str | None:
    """Decide what a completed saver write was, or None to skip it.

    INTERNAL is resume state, not a deliverable, so it is never captured.
    """
    if model_format is ModelFormat.INTERNAL:
        return None

    parent = Path(destination).parent.name
    if parent.lower() == SAVE_DIRNAME:
        return KIND_SAVE

    return KIND_FINAL


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

    shutil.copyfile(source, destination)
    return False
