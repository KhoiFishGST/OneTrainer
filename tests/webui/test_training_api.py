import pytest
from fastapi.testclient import TestClient

from modules.webui.app import create_app
from modules.webui.state import WebUISettings


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


def test_training_api_status_and_start(client):
    res = client.get("/api/training/status")
    assert res.status_code == 200
    assert res.json()["state"] == "IDLE"

    start_res = client.post("/api/training/start")
    assert start_res.status_code == 200
    assert start_res.json()["state"] == "TRAINING"


def test_training_api_lifecycle(client):
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
    # Start training first so control commands can be issued
    client.post("/api/training/start", json={"base_model_name": "mock"})

    res_sample = client.post("/api/training/sample")
    assert res_sample.status_code == 200
    assert res_sample.json()["status"] == "ok"

    res_backup = client.post("/api/training/backup")
    assert res_backup.status_code == 200
    assert res_backup.json()["status"] == "ok"


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
