from unittest.mock import MagicMock

from modules.webui.app import create_app
from modules.webui.sampling_coordinator import (
    PromptDefinitionsError,
    PromptDefinitionsState,
    PromptPersistenceError,
)
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
def sampling_coordinator(client):
    mock = MagicMock()
    client.app.state.webui.sampling = mock
    return mock


def test_get_samples_empty(client):
    resp = client.get("/api/samples")
    assert resp.status_code == 200
    assert resp.json() == {"samples": [], "queued": False}


def test_put_and_get_samples(client):
    sample_data = [
        {
            "prompt": "a photo of a cat",
            "seed": 42,
        }
    ]
    resp = client.put("/api/samples", json={"samples": sample_data})
    assert resp.status_code == 200
    data = resp.json()
    assert "samples" in data
    assert data["queued"] is False
    assert len(data["samples"]) == 1
    assert data["samples"][0]["prompt"] == "a photo of a cat"
    assert "webui_id" in data["samples"][0]

    resp_get = client.get("/api/samples")
    assert resp_get.status_code == 200
    assert resp_get.json()["queued"] is False
    assert len(resp_get.json()["samples"]) == 1


def test_samples_put_returns_queued_state(client, sampling_coordinator):
    sampling_coordinator.put_definitions.return_value = PromptDefinitionsState(
        samples=[{"webui_id": "prompt_a", "prompt": "new"}], queued=True
    )
    response = client.put("/api/samples", json={"samples": [{"prompt": "new"}]})
    assert response.status_code == 200
    assert response.json()["queued"] is True


def test_samples_rejects_malformed_body(client):
    assert client.put("/api/samples", json={"samples": "not-a-list"}).status_code == 422


def test_samples_handles_prompt_definitions_error(client, sampling_coordinator):
    sampling_coordinator.put_definitions.side_effect = PromptDefinitionsError("invalid sample")
    response = client.put("/api/samples", json={"samples": [{"prompt": "bad"}]})
    assert response.status_code == 422
    assert response.json()["detail"] == "invalid sample"


def test_samples_handles_prompt_persistence_error(client, sampling_coordinator):
    sampling_coordinator.put_definitions.side_effect = PromptPersistenceError("disk full")
    response = client.put("/api/samples", json={"samples": [{"prompt": "good"}]})
    assert response.status_code == 500
    assert response.json()["detail"] == "disk full"


def test_list_and_create_sample_files(client):
    resp = client.get("/api/samples/files")
    assert resp.status_code == 200
    files = resp.json().get("files", [])
    assert isinstance(files, list)
    assert "samples.json" in files

    create_resp = client.post("/api/samples/files", json={"name": "custom_samples"})
    assert create_resp.status_code == 200
    assert create_resp.json()["filename"] == "custom_samples.json"

    resp2 = client.get("/api/samples/files")
    assert "custom_samples.json" in resp2.json().get("files", [])


def test_create_sample_file_rejects_empty_name(client):
    resp = client.post("/api/samples/files", json={"name": "   "})
    assert resp.status_code == 422
    assert resp.json()["detail"] == "Sample file name cannot be empty"


def test_create_sample_file_rejects_path_traversal(client):
    resp = client.post("/api/samples/files", json={"name": "../evil"})
    assert resp.status_code == 422
    assert resp.json()["detail"] == "Invalid sample file name"

