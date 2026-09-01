from modules.webui.app import create_app
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


def test_get_and_put_concepts(client):
    resp = client.get("/api/concepts")
    assert resp.status_code == 200
    concepts = resp.json()
    assert isinstance(concepts, list)

    new_concepts = [
        {
            "instance_prompt": "skw cat",
            "class_prompt": "cat",
            "dataset_directory": "/tmp/cats",
        }
    ]
    put_resp = client.put("/api/concepts", json=new_concepts)
    assert put_resp.status_code == 200
    assert put_resp.json()["concepts"] == new_concepts or put_resp.json() == new_concepts


def test_concepts_persistence_and_retrieval(client):
    get_before = client.get("/api/concepts")
    assert get_before.status_code == 200
    assert get_before.json() == []

    new_concepts = [
        {
            "instance_prompt": "a dog",
            "class_prompt": "dog",
            "dataset_directory": "/data/dogs",
        },
        {
            "instance_prompt": "a landscape",
            "class_prompt": "scenery",
            "dataset_directory": "/data/scenery",
        },
    ]

    # Test dictionary wrapper format {"concepts": [...]}
    put_resp = client.put("/api/concepts", json={"concepts": new_concepts})
    assert put_resp.status_code == 200
    assert put_resp.json() == {"concepts": new_concepts}

    get_after = client.get("/api/concepts")
    assert get_after.status_code == 200
    assert get_after.json() == new_concepts


def test_concepts_put_updates_config_revision(client):
    rev_before = client.get("/api/config").json()["revision"]

    client.put("/api/concepts", json=[{"instance_prompt": "test"}])

    rev_after = client.get("/api/config").json()["revision"]
    assert rev_after != rev_before


def test_get_concept_preview_image(client, tmp_path):
    from PIL import Image

    concept_dir = tmp_path / "concept_a"
    concept_dir.mkdir()
    img_file = concept_dir / "sample.png"

    img = Image.new("RGB", (200, 200), color="blue")
    img.save(img_file, format="PNG")

    # 1. Preview for directory path returns WebP thumbnail
    res_dir = client.get(f"/api/concepts/preview-image?path={concept_dir}")
    assert res_dir.status_code == 200
    assert res_dir.headers["content-type"] == "image/webp"
    assert "ETag" in res_dir.headers
    assert "Cache-Control" in res_dir.headers

    # 2. Preview for file path returns WebP thumbnail
    res_file = client.get(f"/api/concepts/preview-image?path={img_file}")
    assert res_file.status_code == 200
    assert res_file.headers["content-type"] == "image/webp"

    # 3. Preview for non-existent path returns fallback placeholder PNG
    res_none = client.get("/api/concepts/preview-image?path=/non/existent")
    assert res_none.status_code == 200
    assert res_none.headers["content-type"] == "image/png"

    # 4. If-None-Match header returns HTTP 304
    etag = res_dir.headers["ETag"]
    res_304 = client.get(
        f"/api/concepts/preview-image?path={concept_dir}",
        headers={"If-None-Match": etag},
    )
    assert res_304.status_code == 304
    assert len(res_304.content) == 0

