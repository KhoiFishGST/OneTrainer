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
