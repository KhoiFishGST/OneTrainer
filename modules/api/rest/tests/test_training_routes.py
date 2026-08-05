import json
import threading

from modules.api.rest.app import create_app
from modules.api.rest.service import TrainingService
from modules.util.config.TrainConfig import TrainConfig

import pytest
from fastapi.testclient import TestClient


class FakeTrainer:
    def __init__(self, config, callbacks, commands):
        self.config = config
        self.callbacks = callbacks
        self.commands = commands
        self.release = threading.Event()

    def start(self):
        pass

    def train(self):
        self.release.wait(timeout=5)

    def end(self):
        pass


class FakeFactory:
    def __init__(self):
        self.trainer: FakeTrainer | None = None

    def __call__(self, config, callbacks, commands):
        self.trainer = FakeTrainer(config, callbacks, commands)
        return self.trainer


@pytest.fixture
def factory():
    return FakeFactory()


@pytest.fixture
def service(factory):
    return TrainingService(trainer_factory=factory)


@pytest.fixture
def client(service):
    return TestClient(create_app(training_service=service, version="testver"))


def _document() -> dict:
    return TrainConfig.default_values().to_settings_dict(secrets=False)


def _wait_for_state(client, state, timeout=5.0):
    waiter = threading.Event()
    for _ in range(int(timeout / 0.01)):
        if client.get("/training/status").json()["state"] == state:
            return
        waiter.wait(0.01)
    raise AssertionError(f"never reached {state!r}")


def test_status_before_any_run_is_idle(client):
    body = client.get("/training/status").json()
    assert body["state"] == "idle"
    assert body["run_id"] is None


def test_start_with_an_inline_config_accepts_and_returns_a_run_id(client, factory):
    response = client.post("/training/start", json={"config": _document()})
    assert response.status_code == 202
    body = response.json()
    assert body["state"] == "starting"
    assert len(body["run_id"]) == 16
    factory.trainer.release.set()


def test_start_with_a_config_path_accepts(client, factory, tmp_path):
    path = tmp_path / "run.json"
    path.write_text(json.dumps(_document()), encoding="utf-8")
    response = client.post("/training/start", json={"config_path": str(path)})
    assert response.status_code == 202
    factory.trainer.release.set()


def test_start_with_neither_config_nor_path_is_a_422_envelope(client):
    response = client.post("/training/start", json={})
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_config"


def test_start_with_inline_secrets_is_rejected(client):
    document = _document()
    document["secrets"] = {"huggingface_token": "hf_leak"}
    response = client.post("/training/start", json={"config": document})
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_config"


def test_start_rejects_a_top_level_secrets_block_rather_than_ignoring_it(client):
    # Not a leak either way -- pydantic would drop it -- but silently accepting
    # a body that looks like it set credentials is the wrong answer to give.
    response = client.post(
        "/training/start",
        json={"config": _document(), "secrets": {"huggingface_token": "hf_leak"}},
    )
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_config"


def test_start_rejects_a_misspelled_field(client):
    response = client.post("/training/start", json={"configPath": "configs/run.json"})
    assert response.status_code == 422
    assert response.json()["error"]["type"] == "invalid_config"


def test_start_while_a_run_is_active_is_a_409_carrying_the_run_id(client, factory):
    first = client.post("/training/start", json={"config": _document()}).json()["run_id"]
    response = client.post("/training/start", json={"config": _document()})
    assert response.status_code == 409
    assert response.json()["error"]["type"] == "conflict"
    assert response.json()["error"]["details"] == {"run_id": first}
    factory.trainer.release.set()


@pytest.mark.parametrize("endpoint", ["stop", "sample", "backup", "save"])
def test_commands_without_an_active_run_are_409(client, endpoint):
    response = client.post(f"/training/{endpoint}")
    assert response.status_code == 409
    assert response.json()["error"]["type"] == "no_active_run"


def test_stop_accepts_and_raises_the_stop_flag(client, factory):
    client.post("/training/start", json={"config": _document()})
    _wait_for_state(client, "running")
    assert client.post("/training/stop").status_code == 202
    assert factory.trainer.commands.get_stop_command() is True
    factory.trainer.release.set()


def test_sample_without_a_body_requests_the_default_sample(client, factory):
    client.post("/training/start", json={"config": _document()})
    _wait_for_state(client, "running")
    assert client.post("/training/sample").status_code == 202
    assert factory.trainer.commands.get_and_reset_sample_default_command() is True
    factory.trainer.release.set()


def test_sample_with_a_body_requests_a_custom_sample(client, factory):
    from modules.util.config.SampleConfig import SampleConfig

    client.post("/training/start", json={"config": _document()})
    _wait_for_state(client, "running")
    sample_document = SampleConfig.default_values().to_dict()
    response = client.post("/training/sample", json={"sample": sample_document})
    assert response.status_code == 202
    assert len(factory.trainer.commands.get_and_reset_sample_custom_commands()) == 1
    factory.trainer.release.set()


def test_backup_and_save_accept(client, factory):
    client.post("/training/start", json={"config": _document()})
    _wait_for_state(client, "running")
    assert client.post("/training/backup").status_code == 202
    assert client.post("/training/save").status_code == 202
    assert factory.trainer.commands.get_and_reset_backup_command() is True
    assert factory.trainer.commands.get_and_reset_save_command() is True
    factory.trainer.release.set()


def test_status_never_contains_a_secrets_key(client, factory):
    client.post("/training/start", json={"config": _document()})
    _wait_for_state(client, "running")
    assert "secrets" not in client.get("/training/status").json()
    factory.trainer.release.set()


def test_health_reflects_the_active_run_state(client, factory):
    client.post("/training/start", json={"config": _document()})
    _wait_for_state(client, "running")
    assert client.get("/health").json()["state"] == "running"
    factory.trainer.release.set()
