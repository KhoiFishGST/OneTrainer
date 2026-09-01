import json
import zipfile
from pathlib import Path

from modules.webui.run_artifacts import (
    ARTIFACT_KINDS,
    archive_entries,
    resolve_artifact,
    resolve_artifacts,
    to_payload,
)

import pytest

RUN_KEY = "2026-08-03_10-15-00"


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    (ws / "config").mkdir(parents=True)
    return ws


@pytest.fixture
def run_info() -> dict:
    return {
        "key": RUN_KEY,
        "config_filename": f"{RUN_KEY}.json",
        "started_at": "2026-08-03T10:15:00+00:00",
        "tensorboard_dirname": RUN_KEY,
    }


def _write_config(workspace: Path) -> Path:
    path = workspace / "config" / f"{RUN_KEY}.json"
    path.write_text(json.dumps({"workspace_dir": "workspace/run"}), encoding="utf-8")
    return path


def _write_gallery(workspace: Path, *, ready: int = 2, pending: int = 1) -> Path:
    run_dir = workspace / "web" / "samples" / RUN_KEY
    run_dir.mkdir(parents=True, exist_ok=True)

    samples = []
    for index in range(ready):
        name = f"00000{index}-base.jpg"
        (run_dir / name).write_bytes(b"image" * 10)
        (run_dir / f"00000{index}-base-thumb.webp").write_bytes(b"thumb" * 10)
        samples.append({"status": "ready", "filename": name, "thumbnail_filename": f"00000{index}-base-thumb.webp"})
    samples.extend({"status": "pending", "filename": None, "thumbnail_filename": None} for _ in range(pending))

    (run_dir / "manifest.json").write_text(
        json.dumps({"schema_version": 1, "run": {"key": RUN_KEY}, "batches": [{"batch_id": 1, "samples": samples}]}),
        encoding="utf-8",
    )
    (run_dir / "prompts.json").write_text(json.dumps({"revisions": {}}), encoding="utf-8")
    return run_dir


def _write_tensorboard(workspace: Path) -> Path:
    log_dir = workspace / "tensorboard" / RUN_KEY
    log_dir.mkdir(parents=True)
    (log_dir / "events.out.tfevents.1").write_bytes(b"protobuf" * 100)
    return log_dir


def test_resolves_all_four_kinds_when_everything_exists(workspace, run_info):
    _write_config(workspace)
    _write_metrics(workspace)
    _write_gallery(workspace)
    _write_tensorboard(workspace)

    artifacts = resolve_artifacts(workspace, RUN_KEY, run_info)

    assert [a.kind for a in artifacts] == list(ARTIFACT_KINDS)
    assert all(a.available for a in artifacts)


def test_config_is_a_single_file_not_an_archive(workspace, run_info):
    path = _write_config(workspace)

    artifact = resolve_artifact(workspace, RUN_KEY, run_info, "config")

    assert artifact.available is True
    assert artifact.is_archive is False
    assert artifact.path == path
    assert artifact.size_bytes == path.stat().st_size
    assert artifact.download_name == f"{RUN_KEY}.json"


def test_samples_archive_excludes_thumbnails_and_metrics(workspace, run_info):
    # Thumbnails are the larger half of a gallery run and are derived;
    # metrics.jsonl is unrelated to samples.
    _write_gallery(workspace)

    artifact = resolve_artifact(workspace, RUN_KEY, run_info, "samples")
    arcnames = sorted(name for _, name in archive_entries(artifact))

    assert arcnames == ["000000-base.jpg", "000001-base.jpg", "manifest.json", "prompts.json"]
    assert artifact.is_archive is True
    assert artifact.download_name == f"{RUN_KEY}-samples.zip"


def test_samples_archive_skips_slots_with_no_file(workspace, run_info):
    # pending / unavailable / error slots carry a null filename.
    _write_gallery(workspace, ready=1, pending=3)

    entries = archive_entries(resolve_artifact(workspace, RUN_KEY, run_info, "samples"))

    assert sorted(name for _, name in entries) == ["000000-base.jpg", "manifest.json", "prompts.json"]


def test_samples_size_counts_only_the_selected_files(workspace, run_info):
    _write_gallery(workspace, ready=2, pending=0)

    artifact = resolve_artifact(workspace, RUN_KEY, run_info, "samples")
    expected = sum(path.stat().st_size for path, _ in archive_entries(artifact))

    assert artifact.size_bytes == expected


def test_tensorboard_uses_deflate_and_the_whole_directory(workspace, run_info):
    log_dir = _write_tensorboard(workspace)

    artifact = resolve_artifact(workspace, RUN_KEY, run_info, "tensorboard")

    assert artifact.available is True
    assert artifact.is_archive is True
    assert artifact.compression == zipfile.ZIP_DEFLATED
    assert artifact.download_name == f"{RUN_KEY}-tensorboard.zip"
    assert [name for _, name in archive_entries(artifact)] == ["events.out.tfevents.1"]
    assert artifact.size_bytes == (log_dir / "events.out.tfevents.1").stat().st_size


def test_missing_sources_report_unavailable_rather_than_raising(workspace, run_info):
    artifacts = {a.kind: a for a in resolve_artifacts(workspace, RUN_KEY, run_info)}

    assert [a.available for a in artifacts.values()] == [False, False, False, False]
    assert all(a.size_bytes == 0 for a in artifacts.values())


def test_a_run_that_never_sampled_still_reports_config_and_tensorboard(workspace, run_info):
    _write_config(workspace)
    _write_tensorboard(workspace)

    artifacts = {a.kind: a for a in resolve_artifacts(workspace, RUN_KEY, run_info)}

    assert artifacts["config"].available is True
    assert artifacts["tensorboard"].available is True
    assert artifacts["samples"].available is False


def test_an_unreadable_gallery_manifest_makes_samples_unavailable(workspace, run_info):
    run_dir = workspace / "web" / "samples" / RUN_KEY
    run_dir.mkdir(parents=True)
    (run_dir / "manifest.json").write_text("not json", encoding="utf-8")

    assert resolve_artifact(workspace, RUN_KEY, run_info, "samples").available is False


def test_a_gallery_with_no_ready_images_is_unavailable(workspace, run_info):
    # A run whose batches are all still pending would otherwise offer an archive
    # containing nothing but the two sidecar JSON files.
    _write_gallery(workspace, ready=0, pending=2)

    assert resolve_artifact(workspace, RUN_KEY, run_info, "samples").available is False


@pytest.mark.parametrize(
    "dirname", ["../../etc", "/etc", "a/b", "..", "..\\windows"]
)
def test_a_hand_edited_tensorboard_name_cannot_escape_the_workspace(workspace, run_info, dirname):
    _write_tensorboard(workspace)
    run_info["tensorboard_dirname"] = dirname

    assert resolve_artifact(workspace, RUN_KEY, run_info, "tensorboard").available is False


@pytest.mark.parametrize("filename", ["../../secrets.json", "a/b.json", ".."])
def test_a_hand_edited_config_filename_cannot_escape_the_config_dir(workspace, run_info, filename):
    _write_config(workspace)
    run_info["config_filename"] = filename

    assert resolve_artifact(workspace, RUN_KEY, run_info, "config").available is False


def test_a_missing_tensorboard_dirname_makes_the_artifact_unavailable(workspace, run_info):
    _write_tensorboard(workspace)
    run_info.pop("tensorboard_dirname")

    assert resolve_artifact(workspace, RUN_KEY, run_info, "tensorboard").available is False


def test_an_unknown_kind_is_rejected(workspace, run_info):
    with pytest.raises(ValueError):
        resolve_artifact(workspace, RUN_KEY, run_info, "backups")


def test_payload_drops_internal_fields(workspace, run_info):
    _write_config(workspace)

    payload = to_payload(resolve_artifact(workspace, RUN_KEY, run_info, "config"))

    assert payload == {
        "kind": "config",
        "label": "Config",
        "available": True,
        "is_archive": False,
        "size_bytes": payload["size_bytes"],
        "download_name": f"{RUN_KEY}.json",
    }


def _write_metrics(workspace: Path) -> Path:
    run_dir = workspace / "web" / "samples" / RUN_KEY
    run_dir.mkdir(parents=True, exist_ok=True)
    path = run_dir / "metrics.jsonl"
    path.write_text('{"step":1}\n{"step":2}\n', encoding="utf-8")
    return path


def test_metrics_is_a_single_file_artifact(workspace, run_info):
    path = _write_metrics(workspace)

    artifact = resolve_artifact(workspace, RUN_KEY, run_info, "metrics")

    assert artifact.available is True
    assert artifact.is_archive is False
    assert artifact.path == path
    assert artifact.size_bytes == path.stat().st_size
    assert artifact.download_name == f"{RUN_KEY}-metrics.jsonl"
    assert artifact.media_type == "application/x-ndjson"


def test_metrics_is_unavailable_when_the_file_is_absent(workspace, run_info):
    _write_gallery(workspace)

    assert resolve_artifact(workspace, RUN_KEY, run_info, "metrics").available is False


def test_metrics_is_ordered_before_the_archives(workspace, run_info):
    _write_config(workspace)
    _write_metrics(workspace)
    _write_gallery(workspace)
    _write_tensorboard(workspace)

    assert [a.kind for a in resolve_artifacts(workspace, RUN_KEY, run_info)] == [
        "config",
        "metrics",
        "samples",
        "tensorboard",
    ]


def test_metrics_is_not_included_in_the_samples_archive(workspace, run_info):
    _write_gallery(workspace)
    _write_metrics(workspace)

    arcnames = [name for _, name in archive_entries(resolve_artifact(workspace, RUN_KEY, run_info, "samples"))]

    assert "metrics.jsonl" not in arcnames
