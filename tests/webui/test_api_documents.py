import json

from modules.webui.app import create_app
from modules.webui.state import WebUISettings

from fastapi.testclient import TestClient


def make_client(tmp_path):
    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "training_presets" / "#.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "training_presets",
        static_dir=tmp_path / "web" / "build",
        dev=True,
    )
    return TestClient(create_app(settings))


def test_config_put_returns_normalized_revision_and_broadcast_ready_state(tmp_path):
    with make_client(tmp_path) as client:
        before = client.get("/api/config").json()
        before["config"]["tensorboard_port"] = 7000
        response = client.put(
            "/api/config",
            json={"config": before["config"], "base_revision": before["revision"], "overwrite": False},
        )
        assert response.status_code == 200
        assert response.json()["config"]["tensorboard_port"] == 7000
        assert response.json()["revision"] != before["revision"]


def test_stale_put_returns_current_revision(tmp_path):
    with make_client(tmp_path) as client:
        baseline = client.get("/api/config").json()
        first = dict(baseline["config"])
        first["workspace_dir"] = "workspace/one"
        assert (
            client.put(
                "/api/config", json={"config": first, "base_revision": baseline["revision"]}
            ).status_code
            == 200
        )
        stale = client.put("/api/config", json={"config": baseline["config"], "base_revision": baseline["revision"]})
        assert stale.status_code == 409
        assert stale.json()["detail"]["current_revision"] != baseline["revision"]


def test_invalid_config_returns_structured_422_without_secrets(tmp_path):
    with make_client(tmp_path) as client:
        baseline = client.get("/api/config").json()
        baseline["config"]["tensorboard_port"] = True
        response = client.put(
            "/api/config", json={"config": baseline["config"], "base_revision": baseline["revision"]}
        )
        assert response.status_code == 422
        assert response.json()["detail"] == [{"path": "tensorboard_port", "message": "Expected integer"}]
        assert "secrets" not in str(response.json())


def test_client_secret_field_is_rejected(tmp_path):
    with make_client(tmp_path) as client:
        baseline = client.get("/api/config").json()
        baseline["config"]["secrets"] = {"huggingface_token": "client-value"}
        response = client.put(
            "/api/config",
            json={
                "config": baseline["config"],
                "base_revision": baseline["revision"],
            },
        )
        assert response.status_code == 422
        assert response.json()["detail"] == [{"path": "secrets", "message": "Unknown field"}]


def test_schema_requires_supported_pair(tmp_path):
    with make_client(tmp_path) as client:
        response = client.get(
            "/api/config/schema", params={"model_type": "STABLE_DIFFUSION_15", "training_method": "FINE_TUNE"}
        )
        assert response.status_code == 200
        assert set(["general", "data", "backup"]).issubset({tab["id"] for tab in response.json()["tabs"]})


def test_directory_errors_are_mapped(tmp_path):
    with make_client(tmp_path) as client:
        response = client.get("/api/fs/directories", params={"path": str(tmp_path / "missing")})
        assert response.status_code == 404
        assert response.json()["detail"] == "Directory does not exist"


def test_preset_round_trip_uses_opaque_ids_and_current_revision(tmp_path):
    client = make_client(tmp_path)
    with client:
        baseline = client.get("/api/config").json()
        built_in = dict(baseline["config"])
        built_in["workspace_dir"] = "workspace/preset"
        presets_dir = tmp_path / "training_presets"
        presets_dir.mkdir(parents=True, exist_ok=True)
        (presets_dir / "#base.json").write_text(json.dumps(built_in), encoding="utf-8")
        tree = client.get("/api/presets").json()
        preset_id = tree[0]["id"]
        loaded = client.post(
            "/api/presets/load",
            json={
                "preset_id": preset_id,
                "base_revision": baseline["revision"],
                "overwrite": False,
            },
        )
        assert loaded.status_code == 200
        assert loaded.json()["config"]["workspace_dir"] == "workspace/preset"
        saved = client.post("/api/presets/save", json={"name": "my preset"})
        assert saved.status_code == 200
        assert saved.json() == {"filename": "my preset.json"}
        assert (
            client.post(
                "/api/presets/load",
                json={
                    "preset_id": "Li4vc2VjcmV0cy5qc29u",
                    "base_revision": loaded.json()["revision"],
                    "overwrite": False,
                },
            ).status_code
            == 404
        )


def test_meta_endpoint(tmp_path):
    with make_client(tmp_path) as client:
        response = client.get("/api/meta")
        assert response.status_code == 200
        data = response.json()
        assert "model_types" in data
        assert "enums" in data


def test_json_body_size_limit_content_length(tmp_path):
    with make_client(tmp_path) as client:
        headers = {"Content-Length": str(1048577), "Content-Type": "application/json"}
        response = client.put("/api/config", content=b"{}", headers=headers)
        assert response.status_code == 413


def test_json_body_size_limit_streamed(tmp_path):
    with make_client(tmp_path) as client:
        large_payload = b"x" * (1048576 + 1)
        response = client.put("/api/config", content=large_payload, headers={"Content-Type": "application/json"})
        assert response.status_code == 413
