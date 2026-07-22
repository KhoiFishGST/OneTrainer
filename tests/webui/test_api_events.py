from modules.webui.app import create_app
from modules.webui.state import WebUISettings

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


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


def test_backlog_and_socket_share_stream_cursor(tmp_path):
    with make_client(tmp_path) as client:
        state = client.app.state.webui
        state.events.publish_from_thread(
            "console",
            {"lines": [{"id": 1, "spans": [{"text": "hello", "classes": []}], "overwrite": False}]},
        )
        with client.websocket_connect("/api/events", headers={"origin": "http://testserver"}) as socket:
            backlog = client.get("/api/events/backlog").json()
            state.events.publish_from_thread("config_changed", {"revision": "instance:2"})
            live = socket.receive_json()
        assert backlog["stream_id"] == live["stream_id"]
        assert live["seq"] > backlog["cursor"]


def test_wrong_websocket_origin_is_rejected(tmp_path):
    with (
        make_client(tmp_path) as client,
        pytest.raises(WebSocketDisconnect) as disconnect,
        client.websocket_connect("/api/events", headers={"origin": "https://evil.example"}),
    ):
        pass
    assert disconnect.value.code == 1008
