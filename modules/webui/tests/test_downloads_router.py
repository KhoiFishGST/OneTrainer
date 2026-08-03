import json
import zipfile
import zipfile as zipfile_module
from io import BytesIO
from unittest.mock import MagicMock

from modules.webui.app import create_app
from modules.webui.checkpoint_store import CheckpointNotFound
from modules.webui.state import WebUISettings

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "training_presets" / "#.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "training_presets",
        static_dir=tmp_path / "web" / "build",
        dev=True,
    )
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def store(client):
    mock = MagicMock()
    client.app.state.webui.checkpoints = mock
    return mock


def test_lists_runs(client, store):
    store.list_runs.return_value = [
        {"key": "run-b", "checkpoint_count": 2, "total_size_bytes": 100},
        {"key": "run-a", "checkpoint_count": 1, "total_size_bytes": 50},
    ]

    response = client.get("/api/downloads/runs")

    assert response.status_code == 200
    assert [r["key"] for r in response.json()["runs"]] == ["run-b", "run-a"]


def test_lists_runs_as_empty_when_nothing_captured(client, store):
    store.list_runs.return_value = []

    assert client.get("/api/downloads/runs").json() == {"runs": []}


def test_run_detail_404s_for_an_unknown_run(client, store):
    store.get_run.side_effect = CheckpointNotFound("Run not found")

    assert client.get("/api/downloads/runs/nope").status_code == 404


def test_downloads_a_single_file_with_range_support(client, store, tmp_path):
    checkpoint = tmp_path / "model.safetensors"
    checkpoint.write_bytes(b"0123456789")
    store.get_checkpoint_path.return_value = checkpoint

    full = client.get("/api/downloads/runs/run-a/files/model.safetensors")
    assert full.status_code == 200
    assert full.content == b"0123456789"
    assert full.headers["accept-ranges"] == "bytes"

    partial = client.get(
        "/api/downloads/runs/run-a/files/model.safetensors",
        headers={"Range": "bytes=2-5"},
    )
    assert partial.status_code == 206
    assert partial.content == b"2345"
    assert partial.headers["content-range"] == "bytes 2-5/10"


def test_file_download_404s_for_an_unknown_checkpoint(client, store):
    store.get_checkpoint_path.side_effect = CheckpointNotFound("Checkpoint not found")

    assert client.get("/api/downloads/runs/run-a/files/nope.safetensors").status_code == 404


def test_file_download_rejects_a_directory_checkpoint(client, store, tmp_path):
    tree = tmp_path / "my-model"
    tree.mkdir()
    store.get_checkpoint_path.return_value = tree

    response = client.get("/api/downloads/runs/run-a/files/my-model")

    assert response.status_code == 400


def test_downloads_a_directory_checkpoint_as_a_zip(client, store, tmp_path):
    tree = tmp_path / "my-model"
    (tree / "unet").mkdir(parents=True)
    (tree / "model_index.json").write_bytes(b"{}")
    (tree / "unet" / "w.safetensors").write_bytes(b"y" * 100)
    store.get_checkpoint_path.return_value = tree

    response = client.get("/api/downloads/runs/run-a/archives/my-model.zip")

    assert response.status_code == 200
    archive = zipfile.ZipFile(BytesIO(response.content))
    assert archive.testzip() is None
    assert sorted(archive.namelist()) == ["model_index.json", "unet/w.safetensors"]


def test_archive_rejects_a_single_file_checkpoint(client, store, tmp_path):
    checkpoint = tmp_path / "model.safetensors"
    checkpoint.write_bytes(b"x")
    store.get_checkpoint_path.return_value = checkpoint

    assert client.get("/api/downloads/runs/run-a/archives/model.safetensors.zip").status_code == 400


def test_archive_404s_for_an_unknown_checkpoint(client, store):
    store.get_checkpoint_path.side_effect = CheckpointNotFound("Checkpoint not found")

    assert client.get("/api/downloads/runs/run-a/archives/nope.zip").status_code == 404


def test_delete_removes_the_checkpoint(client, store):
    response = client.delete("/api/downloads/runs/run-a/files/model.safetensors")

    assert response.status_code == 200
    store.delete_checkpoint.assert_called_once_with("run-a", "model.safetensors")


def test_delete_404s_for_an_unknown_checkpoint(client, store):
    store.delete_checkpoint.side_effect = CheckpointNotFound("Checkpoint not found")

    assert client.delete("/api/downloads/runs/run-a/files/nope").status_code == 404


RUN_KEY = "2026-08-03_10-15-00"


def _prepare_run(store, tmp_path, *, config=True, samples=True, tensorboard=True, metrics=True):
    """Point the mocked store at a real workspace laid out on disk."""
    workspace = tmp_path / "workspace"
    (workspace / "config").mkdir(parents=True)

    run_info = {"key": RUN_KEY, "config_filename": f"{RUN_KEY}.json", "started_at": None}

    if config:
        (workspace / "config" / f"{RUN_KEY}.json").write_text('{"a": 1}', encoding="utf-8")

    if samples:
        run_dir = workspace / "web" / "samples" / RUN_KEY
        run_dir.mkdir(parents=True)
        (run_dir / "000001-base.jpg").write_bytes(b"image" * 10)
        (run_dir / "000001-base-thumb.webp").write_bytes(b"thumb" * 10)
        (run_dir / "manifest.json").write_text(
            json.dumps({"batches": [{"samples": [{"status": "ready", "filename": "000001-base.jpg"}]}]}),
            encoding="utf-8",
        )
        (run_dir / "prompts.json").write_text("{}", encoding="utf-8")

    if metrics:
        run_dir = workspace / "web" / "samples" / RUN_KEY
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / "metrics.jsonl").write_text('{"step":1}\n{"step":2}\n', encoding="utf-8")

    if tensorboard:
        run_info["tensorboard_dirname"] = RUN_KEY
        log_dir = workspace / "tensorboard" / RUN_KEY
        log_dir.mkdir(parents=True)
        (log_dir / "events.out.tfevents.1").write_bytes(b"protobuf" * 200)

    store.workspace_dir = workspace
    store.get_run.return_value = {"run": run_info, "checkpoints": []}
    return workspace


def test_run_detail_includes_every_artifact(client, store, tmp_path):
    _prepare_run(store, tmp_path)

    body = client.get(f"/api/downloads/runs/{RUN_KEY}").json()

    assert [a["kind"] for a in body["artifacts"]] == ["config", "metrics", "samples", "tensorboard"]
    assert all(a["available"] for a in body["artifacts"])
    assert body["checkpoints"] == []


def test_run_detail_marks_missing_artifacts_unavailable(client, store, tmp_path):
    _prepare_run(store, tmp_path, samples=False, tensorboard=False)

    artifacts = {a["kind"]: a for a in client.get(f"/api/downloads/runs/{RUN_KEY}").json()["artifacts"]}

    assert artifacts["config"]["available"] is True
    assert artifacts["samples"]["available"] is False
    assert artifacts["tensorboard"]["available"] is False


def test_downloads_the_config_as_a_single_file(client, store, tmp_path):
    _prepare_run(store, tmp_path)

    response = client.get(f"/api/downloads/runs/{RUN_KEY}/artifacts/config")

    assert response.status_code == 200
    assert response.json() == {"a": 1}
    assert f'filename="{RUN_KEY}.json"' in response.headers["content-disposition"]
    assert response.headers["accept-ranges"] == "bytes"


def test_downloads_samples_as_a_stored_zip_without_thumbnails(client, store, tmp_path):
    _prepare_run(store, tmp_path)

    response = client.get(f"/api/downloads/runs/{RUN_KEY}/artifacts/samples")

    assert response.status_code == 200
    assert f'filename="{RUN_KEY}-samples.zip"' in response.headers["content-disposition"]
    archive = zipfile_module.ZipFile(BytesIO(response.content))
    assert archive.testzip() is None
    assert sorted(archive.namelist()) == ["000001-base.jpg", "manifest.json", "prompts.json"]
    assert archive.infolist()[0].compress_type == zipfile_module.ZIP_STORED


def test_downloads_tensorboard_as_a_deflated_zip(client, store, tmp_path):
    _prepare_run(store, tmp_path)

    response = client.get(f"/api/downloads/runs/{RUN_KEY}/artifacts/tensorboard")

    assert response.status_code == 200
    assert f'filename="{RUN_KEY}-tensorboard.zip"' in response.headers["content-disposition"]
    archive = zipfile_module.ZipFile(BytesIO(response.content))
    assert archive.testzip() is None
    assert archive.namelist() == ["events.out.tfevents.1"]
    assert archive.infolist()[0].compress_type == zipfile_module.ZIP_DEFLATED


def test_artifact_download_404s_when_the_source_is_gone(client, store, tmp_path):
    _prepare_run(store, tmp_path, tensorboard=False)

    assert client.get(f"/api/downloads/runs/{RUN_KEY}/artifacts/tensorboard").status_code == 404


def test_an_unknown_artifact_kind_is_rejected(client, store, tmp_path):
    _prepare_run(store, tmp_path)

    assert client.get(f"/api/downloads/runs/{RUN_KEY}/artifacts/backups").status_code == 422


def test_artifact_download_404s_for_an_unknown_run(client, store):
    store.get_run.side_effect = CheckpointNotFound("Run not found")

    assert client.get("/api/downloads/runs/nope/artifacts/config").status_code == 404


def test_downloads_metrics_as_a_single_file(client, store, tmp_path):
    _prepare_run(store, tmp_path)

    response = client.get(f"/api/downloads/runs/{RUN_KEY}/artifacts/metrics")

    assert response.status_code == 200
    assert response.text.splitlines() == ['{"step":1}', '{"step":2}']
    assert f'filename="{RUN_KEY}-metrics.jsonl"' in response.headers["content-disposition"]
    assert response.headers["accept-ranges"] == "bytes"

