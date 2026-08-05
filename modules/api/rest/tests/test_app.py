from modules.api.rest.app import create_app
from modules.api.rest.errors import InvalidConfigError
from modules.api.rest.service import TrainingService

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    return TestClient(create_app(training_service=TrainingService(), version="testver"))


def test_health_reports_ok_the_version_and_the_training_state(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "testver", "state": "idle"}


def test_config_defaults_returns_the_train_config_defaults(client):
    response = client.get("/config/defaults")
    assert response.status_code == 200
    body = response.json()
    assert body["workspace_dir"] == "workspace/run"


def test_config_defaults_never_leaks_secrets(client):
    # to_settings_dict(secrets=False) is what enforces this -- core code, not ours.
    assert "secrets" not in client.get("/config/defaults").json()


def test_api_errors_render_through_the_shared_envelope():
    app = create_app(training_service=TrainingService(), version="testver")

    @app.get("/boom")
    def boom():
        raise InvalidConfigError("bad config", {"path": "train.epochs"})

    response = TestClient(app, raise_server_exceptions=False).get("/boom")
    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "type": "invalid_config",
            "message": "bad config",
            "details": {"path": "train.epochs"},
        }
    }


def test_request_validation_failures_use_the_same_envelope_shape():
    # FastAPI's own 422 has a different shape by default; we override it so a
    # client only ever has to parse one error format.
    from pydantic import BaseModel

    app = create_app(training_service=TrainingService(), version="testver")

    class Body(BaseModel):
        count: int

    @app.post("/echo")
    def echo(body: Body):
        return {"count": body.count}

    response = TestClient(app).post("/echo", json={"count": "not-a-number"})
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_config"
    assert "details" in response.json()["error"]
