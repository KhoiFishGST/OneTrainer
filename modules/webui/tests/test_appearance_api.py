from modules.webui.app import create_app
from modules.webui.state import WebUISettings

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    settings = WebUISettings(
        config_path=tmp_path / "last_session.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "static",
        root_dir=tmp_path,
        dev=True,
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


def test_get_returns_defaults(client):
    resp = client.get("/api/appearance")
    assert resp.status_code == 200
    assert resp.json() == {"theme": "system", "animations": True}


def test_put_applies_a_partial_update(client):
    resp = client.put("/api/appearance", json={"theme": "light"})
    assert resp.status_code == 200
    assert resp.json() == {"theme": "light", "animations": True}

    resp = client.put("/api/appearance", json={"animations": False})
    assert resp.status_code == 200
    assert resp.json() == {"theme": "light", "animations": False}


def test_put_persists_across_requests(client):
    client.put("/api/appearance", json={"theme": "dark", "animations": False})
    assert client.get("/api/appearance").json() == {"theme": "dark", "animations": False}


def test_put_rejects_an_unknown_theme(client):
    resp = client.put("/api/appearance", json={"theme": "solarized"})
    assert resp.status_code == 400


def test_put_with_an_empty_body_is_a_no_op(client):
    resp = client.put("/api/appearance", json={})
    assert resp.status_code == 200
    assert resp.json() == {"theme": "system", "animations": True}
