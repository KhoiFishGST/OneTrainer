import io

from modules.webui.app import create_app
from modules.webui.state import WebUISettings

import pytest
from fastapi.testclient import TestClient
from PIL import Image


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
        yield c, tmp_path


def test_list_datasets(client):
    c, tmp_path = client
    resp = c.get("/api/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert "datasets" in data
    assert "base_dir" in data
    assert data["datasets"] == []


def test_create_and_delete_dataset(client):
    c, tmp_path = client
    # Auto-generate name when body is empty or name empty
    res_auto = c.post("/api/datasets", json={})
    assert res_auto.status_code == 200
    assert res_auto.json()["name"] == "Dataset 1"

    # Auto-generate second name
    res_auto2 = c.post("/api/datasets", json={"name": ""})
    assert res_auto2.status_code == 200
    assert res_auto2.json()["name"] == "Dataset 2"

    # Custom name
    res_custom = c.post("/api/datasets", json={"name": "my_dataset_01"})
    assert res_custom.status_code == 200
    assert res_custom.json()["name"] == "my_dataset_01"

    # List check
    res_list = c.get("/api/datasets")
    names = [d["name"] for d in res_list.json()["datasets"]]
    assert "Dataset 1" in names
    assert "Dataset 2" in names
    assert "my_dataset_01" in names

    # Invalid name check
    res_invalid = c.post("/api/datasets", json={"name": "invalid/name"})
    assert res_invalid.status_code == 400

    # Delete dataset
    res_del = c.delete("/api/datasets/my_dataset_01")
    assert res_del.status_code == 200
    assert res_del.json() == {"status": "ok"}

    # Delete non-existent
    res_del_404 = c.delete("/api/datasets/my_dataset_01")
    assert res_del_404.status_code == 404


def test_upload_and_get_dataset_files(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "test_ds"})

    # Create dummy image bytes
    img = Image.new("RGB", (100, 100), color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_bytes = img_byte_arr.getvalue()

    # Upload multi-file (image and matching caption)
    files = [
        ("files", ("image1.png", img_bytes, "image/png")),
        ("files", ("image2.jpg", img_bytes, "image/jpeg")),
        ("files", ("image2.txt", b"custom caption", "text/plain")),
    ]
    res_upload = c.post("/api/datasets/test_ds/upload", files=files)
    assert res_upload.status_code == 200
    assert "saved" in res_upload.json()
    assert len(res_upload.json()["saved"]) == 3

    # Get dataset files
    res_files = c.get("/api/datasets/test_ds/files")
    assert res_files.status_code == 200
    items = res_files.json()["items"]
    assert len(items) == 2  # image1 and image2

    item1 = next(it for it in items if it["id"] == "image1")
    assert item1["image_name"] == "image1.png"
    assert item1["caption_name"] == "image1.txt"  # Auto-created blank caption
    assert item1["caption_content"] == ""

    item2 = next(it for it in items if it["id"] == "image2")
    assert item2["image_name"] == "image2.jpg"
    assert item2["caption_name"] == "image2.txt"
    assert item2["caption_content"] == "custom caption"


def test_update_dataset_caption(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "test_ds"})

    # Upload an image (creates image1.txt automatically)
    img = Image.new("RGB", (10, 10), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    c.post("/api/datasets/test_ds/upload", files=[("files", ("image1.png", buf.getvalue(), "image/png"))])

    # Update caption
    res_put = c.put("/api/datasets/test_ds/caption", json={"filename": "image1.txt", "content": "a photo of a cat"})
    assert res_put.status_code == 200
    assert res_put.json() == {"status": "ok"}

    # Verify content changed
    res_files = c.get("/api/datasets/test_ds/files")
    item1 = next(it for it in res_files.json()["items"] if it["id"] == "image1")
    assert item1["caption_content"] == "a photo of a cat"


def test_get_dataset_image_and_thumbnail(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "test_ds"})

    # Test blank thumbnail when dataset empty
    res_blank = c.get("/api/datasets/image?dataset=test_ds&thumb=true")
    assert res_blank.status_code == 200
    assert res_blank.headers["content-type"] == "image/png"

    # Upload an image
    img = Image.new("RGB", (200, 100), color="green")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    c.post("/api/datasets/test_ds/upload", files=[("files", ("sample.png", buf.getvalue(), "image/png"))])

    # Upload a JPEG image
    img_jpg = Image.new("RGB", (200, 100), color="blue")
    buf_jpg = io.BytesIO()
    img_jpg.save(buf_jpg, format="JPEG")
    c.post("/api/datasets/test_ds/upload", files=[("files", ("photo.jpg", buf_jpg.getvalue(), "image/jpeg"))])

    # Get thumbnail (cropped square) - returns WebP from MediaService
    res_thumb = c.get("/api/datasets/image?dataset=test_ds&thumb=true")
    assert res_thumb.status_code == 200
    assert res_thumb.headers["content-type"] == "image/webp"
    assert "ETag" in res_thumb.headers
    assert "Cache-Control" in res_thumb.headers

    # Get specific full PNG image
    res_full = c.get("/api/datasets/image?dataset=test_ds&filename=sample.png")
    assert res_full.status_code == 200
    assert res_full.headers["content-type"] == "image/png"
    assert "ETag" in res_full.headers
    assert "Cache-Control" in res_full.headers

    # Get specific full JPEG image - must return image/jpeg Content-Type header and Cache-Control + ETag
    res_full_jpg = c.get("/api/datasets/image?dataset=test_ds&filename=photo.jpg")
    assert res_full_jpg.status_code == 200
    assert res_full_jpg.headers["content-type"] == "image/jpeg"
    assert "Cache-Control" in res_full_jpg.headers
    assert "ETag" in res_full_jpg.headers
    etag = res_full_jpg.headers["ETag"]

    # Test conditional 304 Not Modified request using If-None-Match
    res_304 = c.get("/api/datasets/image?dataset=test_ds&filename=photo.jpg", headers={"If-None-Match": etag})
    assert res_304.status_code == 304
    assert len(res_304.content) == 0


def test_decode_config_with_missing_datasets_dir():
    from modules.util.config.SecretsConfig import SecretsConfig
    from modules.util.config.TrainConfig import TrainConfig
    from modules.webui.config_codec import decode_settings_document

    cfg = TrainConfig.default_values()
    doc = cfg.to_settings_dict(secrets=False)
    # Simulate legacy config dict missing datasets_dir
    doc_missing = {k: v for k, v in doc.items() if k != "datasets_dir"}
    assert "datasets_dir" not in doc_missing

    decoded = decode_settings_document(doc_missing, SecretsConfig.default_values())
    assert getattr(decoded, "datasets_dir", None) == "training_datasets"

