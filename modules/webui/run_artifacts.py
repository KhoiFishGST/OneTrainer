import json
import logging
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

KIND_CONFIG = "config"
KIND_METRICS = "metrics"
KIND_SAMPLES = "samples"
KIND_TENSORBOARD = "tensorboard"

# Config and metrics are the small single files you would grab for
# reproducibility; the two archives follow.
ARTIFACT_KINDS = (KIND_CONFIG, KIND_METRICS, KIND_SAMPLES, KIND_TENSORBOARD)

LABELS = {
    KIND_CONFIG: "Config",
    KIND_METRICS: "Metrics",
    KIND_SAMPLES: "Samples",
    KIND_TENSORBOARD: "Tensorboard",
}

METRICS_FILENAME = "metrics.jsonl"

# The two JSON files record which prompt produced which image, so the archive is
# self-describing. Thumbnails are derived and are the larger half of a gallery
# run; metrics.jsonl is unrelated to samples.
GALLERY_SIDECARS = ("manifest.json", "prompts.json")


@dataclass(frozen=True)
class RunArtifact:
    kind: str
    label: str
    path: Path | None
    available: bool
    is_archive: bool
    size_bytes: int
    download_name: str
    compression: int = zipfile.ZIP_STORED
    media_type: str = "application/octet-stream"


def _is_unsafe_name(name: str) -> bool:
    """Reject anything that could escape its parent directory."""
    return not name or Path(name).name != name or ".." in name or "/" in name or "\\" in name


def _unavailable(kind: str, download_name: str, *, is_archive: bool) -> RunArtifact:
    return RunArtifact(
        kind=kind,
        label=LABELS[kind],
        path=None,
        available=False,
        is_archive=is_archive,
        size_bytes=0,
        download_name=download_name,
    )


def _gallery_entries(run_dir: Path) -> list[tuple[Path, str]]:
    """Full-size images named in the gallery manifest, plus the two sidecars.

    Slots that are pending, unavailable or errored carry a null filename and are
    skipped; a file deleted since the manifest was written is skipped too rather
    than aborting the archive.
    """
    manifest_path = run_dir / "manifest.json"
    try:
        doc = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        logger.exception("Unreadable gallery manifest at %s", manifest_path)
        return []

    if not isinstance(doc, dict):
        return []

    entries: list[tuple[Path, str]] = []
    seen: set[str] = set()

    for batch in doc.get("batches") or []:
        if not isinstance(batch, dict):
            continue
        for slot in batch.get("samples") or []:
            if not isinstance(slot, dict):
                continue
            name = slot.get("filename")
            if not isinstance(name, str) or _is_unsafe_name(name) or name in seen:
                continue
            path = run_dir / name
            if not path.is_file():
                continue
            seen.add(name)
            entries.append((path, name))

    for sidecar in GALLERY_SIDECARS:
        path = run_dir / sidecar
        if path.is_file():
            entries.append((path, sidecar))

    return entries


def _tree_size(root: Path) -> int:
    return sum(p.stat().st_size for p in root.rglob("*") if p.is_file())


def resolve_artifact(workspace: Path, run_key: str, run_info: dict[str, Any], kind: str) -> RunArtifact:
    """Locate one artifact for a run. Never raises for missing sources."""
    if kind not in ARTIFACT_KINDS:
        raise ValueError(f"Unknown artifact kind: {kind}")

    workspace = Path(workspace)

    if kind == KIND_CONFIG:
        download_name = f"{run_key}.json"
        filename = run_info.get("config_filename")
        if not isinstance(filename, str) or _is_unsafe_name(filename):
            return _unavailable(kind, download_name, is_archive=False)
        path = workspace / "config" / filename
        if not path.is_file():
            return _unavailable(kind, download_name, is_archive=False)
        return RunArtifact(
            kind=kind,
            label=LABELS[kind],
            path=path,
            available=True,
            is_archive=False,
            size_bytes=path.stat().st_size,
            download_name=download_name,
            media_type="application/json",
        )

    if kind == KIND_METRICS:
        download_name = f"{run_key}-metrics.jsonl"
        path = workspace / "web" / "samples" / run_key / METRICS_FILENAME
        if not path.is_file():
            return _unavailable(kind, download_name, is_archive=False)
        return RunArtifact(
            kind=kind,
            label=LABELS[kind],
            path=path,
            available=True,
            is_archive=False,
            size_bytes=path.stat().st_size,
            download_name=download_name,
            media_type="application/x-ndjson",
        )

    if kind == KIND_SAMPLES:
        download_name = f"{run_key}-samples.zip"
        run_dir = workspace / "web" / "samples" / run_key
        if not run_dir.is_dir():
            return _unavailable(kind, download_name, is_archive=True)
        entries = _gallery_entries(run_dir)
        # Sidecars alone are not a samples archive: a run whose batches are all
        # still pending has nothing worth downloading here.
        if not any(name not in GALLERY_SIDECARS for _, name in entries):
            return _unavailable(kind, download_name, is_archive=True)
        return RunArtifact(
            kind=kind,
            label=LABELS[kind],
            path=run_dir,
            available=True,
            is_archive=True,
            size_bytes=sum(path.stat().st_size for path, _ in entries),
            download_name=download_name,
        )

    download_name = f"{run_key}-tensorboard.zip"
    dirname = run_info.get("tensorboard_dirname")
    if not isinstance(dirname, str) or _is_unsafe_name(dirname):
        return _unavailable(kind, download_name, is_archive=True)
    log_dir = workspace / "tensorboard" / dirname
    if not log_dir.is_dir():
        return _unavailable(kind, download_name, is_archive=True)
    return RunArtifact(
        kind=kind,
        label=LABELS[kind],
        path=log_dir,
        available=True,
        is_archive=True,
        size_bytes=_tree_size(log_dir),
        download_name=download_name,
        # Event files are protobuf and compress roughly 5x -- the one place
        # deflate earns its CPU.
        compression=zipfile.ZIP_DEFLATED,
    )


def resolve_artifacts(workspace: Path, run_key: str, run_info: dict[str, Any]) -> list[RunArtifact]:
    return [resolve_artifact(workspace, run_key, run_info, kind) for kind in ARTIFACT_KINDS]


def archive_entries(artifact: RunArtifact) -> list[tuple[Path, str]]:
    """The (path, arcname) pairs for an archive artifact."""
    if artifact.path is None or not artifact.is_archive:
        return []

    if artifact.kind == KIND_SAMPLES:
        return _gallery_entries(artifact.path)

    root = artifact.path
    return [
        (path, str(path.relative_to(root)).replace("\\", "/"))
        for path in sorted(p for p in root.rglob("*") if p.is_file())
    ]


def to_payload(artifact: RunArtifact) -> dict[str, Any]:
    return {
        "kind": artifact.kind,
        "label": artifact.label,
        "available": artifact.available,
        "is_archive": artifact.is_archive,
        "size_bytes": artifact.size_bytes,
        "download_name": artifact.download_name,
    }
