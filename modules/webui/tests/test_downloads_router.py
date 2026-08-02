import zipfile
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
