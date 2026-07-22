from modules.webui.app import create_app
from modules.webui.console import ConsoleCapture
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


def test_health_reports_build_and_startup_warnings(tmp_path):
    with make_client(tmp_path) as client:
        body = client.get("/api/health").json()
        assert body["status"] == "ok"
        assert body["frontend_built"] is False
        assert isinstance(body["warnings"], list)


def test_log_download_is_404_without_active_sink(tmp_path):
    with make_client(tmp_path) as client:
        assert client.get("/api/console/log").status_code == 404


def test_log_download_with_active_sink(tmp_path):
    capture = ConsoleCapture()
    workspace_dir = tmp_path / "workspace"
    workspace_dir.mkdir(parents=True, exist_ok=True)
    capture.set_workspace(workspace_dir)

    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "web" / "build",
        dev=True,
    )
    with TestClient(create_app(settings, capture=capture)) as client:
        assert capture.sink is not None
        capture.sink.write(b"log data\n")
        res = client.get("/api/console/log")
        assert res.status_code == 200
        assert b"log data" in res.content


def test_dev_cors_allows_only_configured_vite_origin(tmp_path):
    with make_client(tmp_path) as client:
        allowed = client.options(
            "/api/config",
            headers={
                "origin": "http://localhost:5173",
                "access-control-request-method": "GET",
            },
        )
        denied = client.options(
            "/api/config",
            headers={
                "origin": "https://evil.example",
                "access-control-request-method": "GET",
            },
        )
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert "access-control-allow-origin" not in denied.headers


def test_production_static_spa_fallback_and_traversal_prevention(tmp_path):
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    index_html = static_dir / "index.html"
    index_html.write_text("<html>index</html>", encoding="utf-8")

    secret_file = tmp_path / "secret.txt"
    secret_file.write_text("secret_content", encoding="utf-8")

    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=static_dir,
        dev=False,
    )
    with TestClient(create_app(settings)) as client:
        res = client.get("/general")
        assert res.status_code == 200
        assert res.text == "<html>index</html>"

        res = client.get("/../secret.txt")
        assert res.status_code in (400, 404)
        assert "secret_content" not in res.text
