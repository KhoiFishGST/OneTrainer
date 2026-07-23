import json
import pytest
from fastapi.testclient import TestClient
from pathlib import Path

from modules.webui.app import create_app
from modules.webui.state import WebUISettings


@pytest.fixture
def test_app_fixture(tmp_path):
    secrets_path = tmp_path / "secrets.json"
    settings = WebUISettings(
        config_path=tmp_path / "last_session.json",
        secrets_path=secrets_path,
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "static",
        root_dir=tmp_path,
        dev=True,
    )
    app = create_app(settings)
    return app, secrets_path


def test_secrets_api_get_and_update(test_app_fixture):
    app, secrets_path = test_app_fixture
    with TestClient(app) as client:
        # Test GET initially empty
        resp = client.get("/api/secrets")
        assert resp.status_code == 200
        data = resp.json()
        assert data["huggingface_token_set"] is False
        assert data["webui_password_set"] is False

        # Update HF token and webui password
        update_resp = client.post("/api/secrets", json={
            "huggingface_token": "hf_test_token_123",
            "webui_password": "secret_password"
        })
        assert update_resp.status_code == 200
        update_data = update_resp.json()
        assert update_data["huggingface_token_set"] is True
        assert update_data["webui_password_set"] is True

        # Verify updated GET
        get_resp = client.get("/api/secrets")
        assert get_resp.json()["huggingface_token"] == "hf_test_token_123"

        # Verify secrets.json was saved on disk
        assert secrets_path.exists()
        saved = json.loads(secrets_path.read_text(encoding="utf-8"))
        assert saved["huggingface_token"] == "hf_test_token_123"
        assert saved["webui_password"] == "secret_password"


def test_auth_api_flow(test_app_fixture):
    app, _ = test_app_fixture
    with TestClient(app) as client:
        # Initial status - password not set
        status_resp = client.get("/api/auth/status")
        assert status_resp.status_code == 200
        assert status_resp.json()["password_required"] is False
        assert status_resp.json()["authenticated"] is True

        # Set webui_password
        client.post("/api/secrets", json={"webui_password": "my_secure_password"})

        # Status after setting password
        status_resp = client.get("/api/auth/status")
        assert status_resp.json()["password_required"] is True

        # Attempt login with invalid password
        bad_login = client.post("/api/auth/login", json={"password": "wrong_password"})
        assert bad_login.status_code == 401

        # Login with correct password
        good_login = client.post("/api/auth/login", json={"password": "my_secure_password"})
        assert good_login.status_code == 200
        login_data = good_login.json()
        assert login_data["authenticated"] is True
        assert login_data["token"] is not None

        # Check status with session cookie
        status_resp = client.get("/api/auth/status")
        assert status_resp.json()["authenticated"] is True

        # Logout
        logout_resp = client.post("/api/auth/logout")
        assert logout_resp.status_code == 200

        # Status after logout
        status_after_logout = client.get("/api/auth/status")
        assert status_after_logout.json()["authenticated"] is False
