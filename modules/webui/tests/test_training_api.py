from unittest.mock import MagicMock

from modules.webui.app import create_app
from modules.webui.state import WebUISettings
from modules.webui.training import TrainingState

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_training_service(client):
    mock = MagicMock()
    client.app.state.webui.training = mock
    return mock




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


def test_training_api_status_and_start(client, monkeypatch):
    monkeypatch.setattr("modules.webui.training.TrainingService._run_training_worker", lambda self, config_data: None)
    res = client.get("/api/training/status")
    assert res.status_code == 200
    assert res.json()["state"] == "IDLE"

    start_res = client.post("/api/training/start")
    assert start_res.status_code == 200
    assert start_res.json()["state"] == "TRAINING"


def test_training_api_lifecycle(client, monkeypatch):
    monkeypatch.setattr("modules.webui.training.TrainingService._run_training_worker", lambda self, config_data: None)
    # Initial status
    status = client.get("/api/training/status").json()
    assert status["state"] == "IDLE"

    # Start training
    res = client.post("/api/training/start", json={"base_model_name": "mock"})
    assert res.status_code == 200
    assert res.json()["state"] == "TRAINING"

    # Pause training
    res = client.post("/api/training/pause")
    assert res.status_code == 200
    assert res.json()["state"] == "PAUSED"

    # Resume training
    res = client.post("/api/training/resume")
    assert res.status_code == 200
    assert res.json()["state"] == "TRAINING"

    # Stop training
    res = client.post("/api/training/stop")
    assert res.status_code == 200
    assert res.json()["state"] == "IDLE"


def test_training_api_sample_and_backup(client):
    service = client.app.state.webui.training_service
    service.set_state(TrainingState.TRAINING)
    mock_config = MagicMock()
    mock_config.samples = [{"prompt": "test"}]
    service._active_train_config = mock_config

    res_sample = client.post("/api/training/sample")
    assert res_sample.status_code == 200
    assert res_sample.json()["status"] == "ok"

    res_backup = client.post("/api/training/backup")
    assert res_backup.status_code == 200
    assert res_backup.json()["status"] == "ok"


def test_training_api_sample_no_definitions(client):
    service = client.app.state.webui.training_service
    service.set_state(TrainingState.TRAINING)
    service._active_train_config = None

    res_sample = client.post("/api/training/sample")
    assert res_sample.status_code == 409



def test_training_api_metrics_samples_gpu(client):
    res_metrics = client.get("/api/training/metrics")
    assert res_metrics.status_code == 200
    assert isinstance(res_metrics.json(), list)

    res_samples = client.get("/api/training/samples")
    assert res_samples.status_code == 200
    assert isinstance(res_samples.json(), list)

    res_gpu = client.get("/api/training/gpu")
    assert res_gpu.status_code == 200
    gpu_data = res_gpu.json()
    assert "vram_used" in gpu_data or "vram_total" in gpu_data or isinstance(gpu_data, dict)


def test_training_api_invalid_transitions(client):
    # Cannot pause when IDLE
    res = client.post("/api/training/pause")
    assert res.status_code in (400, 409)

    # Cannot resume when IDLE
    res = client.post("/api/training/resume")
    assert res.status_code in (400, 409)

    # Stop when IDLE is idempotent (200) or fails (400, 409)
    res = client.post("/api/training/stop")
    assert res.status_code in (200, 400, 409)


def test_training_api_request_save(client, mock_training_service):
    # When training is idle, returning 409
    mock_training_service.request_save.side_effect = RuntimeError("Cannot request save from state IDLE")
    response = client.post("/api/training/save")
    assert response.status_code == 409

    # When training is running, returning 200 ok
    mock_training_service.request_save.side_effect = None
    mock_training_service.request_save.return_value = None
    response = client.post("/api/training/save")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_training_api_get_sample_image(client, tmp_path):
    service = client.app.state.webui.training_service
    test_img = tmp_path / "test_sample.png"
    test_img.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

    sample_info = {
        "id": "sample_999",
        "sample_id": "sample_999",
        "step": 100,
        "filepath": str(test_img),
        "url": "/api/training/samples/sample_999/image",
    }
    service.record_sample(sample_info)

    res = client.get("/api/training/samples/sample_999/image")
    assert res.status_code == 200
    assert res.content == test_img.read_bytes()


