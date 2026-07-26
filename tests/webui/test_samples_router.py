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
        yield c, tmp_path


def test_get_samples_empty(client):
    c, tmp_path = client
    resp = c.get("/api/samples")
    assert resp.status_code == 200
    assert resp.json() == {"samples": []}


def test_put_and_get_samples(client):
    c, tmp_path = client
    sample_data = [
        {
            "prompt": "a photo of a cat",
            "seed": 42,
        }
    ]
    resp = c.put("/api/samples", json={"samples": sample_data})
    assert resp.status_code == 200
    assert resp.json() == {"samples": sample_data}

    resp_get = c.get("/api/samples")
    assert resp_get.status_code == 200
    assert resp_get.json() == {"samples": sample_data}
