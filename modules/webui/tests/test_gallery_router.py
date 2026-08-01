from unittest.mock import MagicMock

from modules.webui.app import create_app
from modules.webui.gallery import GalleryImage, GalleryNotFound
from modules.webui.state import WebUISettings

import pytest
from fastapi.testclient import TestClient


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


@pytest.fixture
def gallery_service(client):
    mock = MagicMock()
    client.app.state.webui.gallery = mock
    return mock


def test_gallery_image_has_strong_cache_headers(client, gallery_service):
    image_path = client.app.state.webui.settings.root_dir / "sample.png"
    image_path.write_bytes(b"image")
    gallery_service.get_image.return_value = GalleryImage(
        path=image_path, media_type="image/png", etag='"abc123"'
    )
    response = client.get("/api/gallery/runs/run/images/sample.png")
    assert response.status_code == 200
    assert "ETag" in response.headers
    assert "Cache-Control" in response.headers


def test_gallery_image_honors_if_none_match(client, gallery_service):
    image_path = client.app.state.webui.settings.root_dir / "sample.png"
    image_path.write_bytes(b"image")
    gallery_service.get_image.return_value = GalleryImage(
        path=image_path, media_type="image/png", etag='"abc123"'
    )
    res1 = client.get("/api/gallery/runs/run/images/sample.png")
    assert res1.status_code == 200
    etag = res1.headers["ETag"]
    response = client.get("/api/gallery/runs/run/images/sample.png", headers={"If-None-Match": etag})
    assert response.status_code == 304


def test_lists_valid_runs_newest_first_and_returns_empty_current(client, gallery_service):
    gallery_service.list_runs.return_value = [{"key": "newer"}, {"key": "older"}]
    gallery_service.get_current_model.return_value = {"active": False, "run": None, "batches": [], "revisions": {}}
    assert client.get("/api/gallery/runs").json() == {"runs": [{"key": "newer"}, {"key": "older"}]}
    assert client.get("/api/gallery/current").json()["run"] is None


def test_get_gallery_run_success(client, gallery_service):
    gallery_service.get_run_model.return_value = {
        "active": True,
        "run": {"key": "run1"},
        "batches": [],
        "revisions": {},
    }
    response = client.get("/api/gallery/runs/run1")
    assert response.status_code == 200
    assert response.json()["run"]["key"] == "run1"


@pytest.mark.parametrize(
    "url",
    [
        "/api/gallery/runs/unknown",
        "/api/gallery/runs/..%2Foutside",
        "/api/gallery/runs/run/images/..%2Fmanifest.json",
        "/api/gallery/runs/run/images/unreferenced.png",
        "/api/gallery/runs/run/images/missing.png",
        "/api/gallery/runs/run/images/not-image.txt",
    ],
)
def test_gallery_rejects_unknown_or_unsafe_resources(client, gallery_service, url):
    gallery_service.get_run_model.side_effect = GalleryNotFound("gallery run not found")
    gallery_service.get_image.side_effect = GalleryNotFound("gallery image not found")
    assert client.get(url).status_code == 404


def test_load_run_config_replaces_live_config(client, gallery_service, tmp_path):
    config_path = tmp_path / "config" / "run1.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    # __version pins this to the current TrainConfig format so from_dict() skips the
    # legacy migration chain, which assumes every pre-migration document carries a
    # "model_type" key (a pre-existing, unrelated bug: TrainConfig.py:801 KeyErrors
    # on a truly bare "{}" with no __version, e.g. via TrainConfig.default_values().from_dict({})).
    config_path.write_text('{"__version": 11}', encoding="utf-8")
    gallery_service.get_run_config_path.return_value = config_path

    base_revision = client.get("/api/config").json()["revision"]
    response = client.post(
        "/api/gallery/runs/run1/load", json={"base_revision": base_revision}
    )

    assert response.status_code == 200
    body = response.json()
    assert "config" in body
    assert body["revision"] != base_revision
    gallery_service.get_run_config_path.assert_called_once_with("run1")


def test_load_run_config_404s_for_unknown_run(client, gallery_service):
    gallery_service.get_run_config_path.side_effect = GalleryNotFound("Run not found")

    response = client.post("/api/gallery/runs/nope/load", json={"base_revision": "x"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Run not found"


def test_load_run_config_404s_when_run_has_no_recorded_config(client, gallery_service):
    gallery_service.get_run_config_path.side_effect = GalleryNotFound(
        "Run has no recorded config file"
    )

    response = client.post("/api/gallery/runs/run1/load", json={"base_revision": "x"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Run has no recorded config file"


def test_load_run_config_404s_when_config_file_is_gone(client, gallery_service, tmp_path):
    gallery_service.get_run_config_path.return_value = tmp_path / "config" / "deleted.json"

    base_revision = client.get("/api/config").json()["revision"]
    response = client.post(
        "/api/gallery/runs/run1/load", json={"base_revision": base_revision}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Config file for this run no longer exists"


def test_load_run_config_409s_on_stale_revision(client, gallery_service, tmp_path):
    config_path = tmp_path / "config" / "run1.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text('{"__version": 11}', encoding="utf-8")
    gallery_service.get_run_config_path.return_value = config_path

    response = client.post(
        "/api/gallery/runs/run1/load", json={"base_revision": "definitely-stale"}
    )

    assert response.status_code == 409
    assert "current_revision" in response.json()["detail"]
