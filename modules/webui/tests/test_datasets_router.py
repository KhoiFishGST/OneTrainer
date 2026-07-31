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
    assert item1["media_name"] == "image1.png"
    assert item1["caption_name"] == "image1.txt"  # Auto-created blank caption
    assert item1["caption_content"] == ""

    item2 = next(it for it in items if it["id"] == "image2")
    assert item2["media_name"] == "image2.jpg"
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


def test_decode_config_ignores_legacy_datasets_dir_key():
    from modules.util.config.SecretsConfig import SecretsConfig
    from modules.util.config.TrainConfig import TrainConfig
    from modules.webui.config_codec import decode_settings_document

    cfg = TrainConfig.default_values()
    doc = cfg.to_settings_dict(secrets=False)
    # Configs saved by earlier web UI builds carry a datasets_dir key that
    # TrainConfig no longer declares. Loading them must not fail.
    doc["datasets_dir"] = "training_datasets"

    decoded = decode_settings_document(doc, SecretsConfig.default_values())
    assert decoded is not None
    # The key must be dropped, not absorbed onto the config object.
    assert not hasattr(decoded, "datasets_dir")
    # ...and stripping it must not disturb neighbouring fields.
    assert decoded.epochs == cfg.epochs == 100
    assert decoded.learning_rate == cfg.learning_rate == 3e-06



def test_base_dir_comes_from_settings_store(tmp_path):
    from modules.webui.app import create_app
    from modules.webui.state import WebUISettings

    from fastapi.testclient import TestClient

    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "static",
        dev=True,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        assert client.get("/api/datasets").json()["base_dir"] == "training_datasets"

        resp = client.put("/api/datasets/base-dir", json={"path": "my_sets"})
        assert resp.status_code == 200
        assert resp.json()["base_dir"] == "my_sets"

        assert client.get("/api/datasets").json()["base_dir"] == "my_sets"
        assert (tmp_path / "my_sets").is_dir()


def _write_fake_video(path):
    # Not a decodable video; sufficient for extension-based classification.
    path.write_bytes(b"\x00\x00\x00\x18ftypmp42fake")


def test_list_datasets_counts_videos(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "vids"})
    ds_dir = tmp_path / "training_datasets" / "vids"
    _write_fake_video(ds_dir / "clip.mp4")
    _write_fake_video(ds_dir / "clip2.mkv")
    Image.new("RGB", (8, 8)).save(ds_dir / "pic.png")

    entry = next(d for d in c.get("/api/datasets").json()["datasets"] if d["name"] == "vids")
    assert entry["video_count"] == 2
    assert entry["image_count"] == 1


def test_dataset_files_reports_kind_and_media_name(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "mixed"})
    ds_dir = tmp_path / "training_datasets" / "mixed"
    Image.new("RGB", (8, 8)).save(ds_dir / "a.png")
    _write_fake_video(ds_dir / "b.mp4")
    (ds_dir / "c.txt").write_text("caption only", encoding="utf-8")

    items = {i["id"]: i for i in c.get("/api/datasets/mixed/files").json()["items"]}
    assert items["a"]["kind"] == "image"
    assert items["a"]["media_name"] == "a.png"
    assert items["b"]["kind"] == "video"
    assert items["b"]["media_name"] == "b.mp4"
    assert items["c"]["kind"] == "text"
    assert items["c"]["media_name"] is None
    assert items["c"]["caption_content"] == "caption only"


def test_upload_rejects_unsupported_extension(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "guard"})
    resp = c.post(
        "/api/datasets/guard/upload",
        files=[("files", ("evil.exe", b"MZ", "application/octet-stream"))],
    )
    assert resp.status_code == 415
    assert "evil.exe" in str(resp.json()["detail"])


def test_upload_leaves_no_part_files(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "parts"})
    buf = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buf, format="PNG")
    resp = c.post(
        "/api/datasets/parts/upload",
        files=[("files", ("a.png", buf.getvalue(), "image/png"))],
    )
    assert resp.status_code == 200
    ds_dir = tmp_path / "training_datasets" / "parts"
    assert list(ds_dir.glob("*.part")) == []
    assert (ds_dir / "a.png").exists()


def test_upload_streams_large_file_without_full_read(client, monkeypatch):
    """A 12 MB upload must be copied in chunks, never read whole into memory."""
    import shutil as _shutil

    c, tmp_path = client
    c.post("/api/datasets", json={"name": "big"})

    calls = {"copyfileobj": 0}
    real_copyfileobj = _shutil.copyfileobj

    def counting_copyfileobj(src, dst, length=0):
        calls["copyfileobj"] += 1
        return real_copyfileobj(src, dst, length or 1024 * 1024)

    monkeypatch.setattr(
        "modules.webui.routers.datasets.shutil.copyfileobj", counting_copyfileobj
    )

    payload = b"\x00" * (12 * 1024 * 1024)
    resp = c.post(
        "/api/datasets/big/upload",
        files=[("files", ("big.mp4", payload, "video/mp4"))],
    )
    assert resp.status_code == 200
    assert calls["copyfileobj"] == 1
    assert (tmp_path / "training_datasets" / "big" / "big.mp4").stat().st_size == len(payload)


def test_dataset_files_ignores_part_files(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "leftover"})
    ds_dir = tmp_path / "training_datasets" / "leftover"
    (ds_dir / "half.png.part").write_bytes(b"partial")

    assert c.get("/api/datasets/leftover/files").json()["items"] == []


def test_upload_publishes_file_added_event(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "evented"})

    published = []
    app_state = c.app.state.webui
    original_publish = app_state.events.publish

    async def spy_publish(event_type, data=None):
        published.append((event_type, data or {}))
        return await original_publish(event_type, data)

    app_state.events.publish = spy_publish
    try:
        buf = io.BytesIO()
        Image.new("RGB", (8, 8)).save(buf, format="PNG")
        resp = c.post(
            "/api/datasets/evented/upload",
            files=[("files", ("a.png", buf.getvalue(), "image/png"))],
        )
    finally:
        app_state.events.publish = original_publish

    assert resp.status_code == 200
    added = [payload for etype, payload in published if etype == "dataset.file.added"]
    assert added == [
        {"dataset": "evented", "filename": "a.png", "item_id": "a", "kind": "image"}
    ]


def test_video_endpoint_serves_full_and_partial(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "stream"})
    ds_dir = tmp_path / "training_datasets" / "stream"
    payload = bytes(range(256)) * 40  # 10240 bytes
    (ds_dir / "clip.mp4").write_bytes(payload)

    full = c.get("/api/datasets/video?dataset=stream&filename=clip.mp4")
    assert full.status_code == 200
    assert full.content == payload

    partial = c.get(
        "/api/datasets/video?dataset=stream&filename=clip.mp4",
        headers={"Range": "bytes=0-99"},
    )
    assert partial.status_code == 206
    assert partial.headers["content-range"] == f"bytes 0-99/{len(payload)}"
    assert partial.content == payload[:100]


def test_video_endpoint_rejects_traversal_and_non_video(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "stream2"})
    ds_dir = tmp_path / "training_datasets" / "stream2"
    Image.new("RGB", (8, 8)).save(ds_dir / "a.png")

    assert c.get("/api/datasets/video?dataset=stream2&filename=../x.mp4").status_code == 400
    assert c.get("/api/datasets/video?dataset=stream2&filename=a.png").status_code == 400
    assert c.get("/api/datasets/video?dataset=stream2&filename=gone.mp4").status_code == 404



def test_serving_endpoints_reject_absolute_dataset(client, tmp_path):
    """An absolute `dataset` value must not escape the datasets base dir.

    Path('/base') / '/etc' resolves to '/etc', so a `..` check alone is not
    enough — containment has to be verified after resolution.
    """
    c, root = client
    outside = tmp_path.parent / "outside_of_base"
    outside.mkdir(exist_ok=True)
    (outside / "secret.mp4").write_bytes(b"SENSITIVE")
    Image.new("RGB", (8, 8)).save(outside / "secret.png")

    assert (
        c.get(f"/api/datasets/video?dataset={outside}&filename=secret.mp4").status_code
        == 400
    )

    img = c.get(f"/api/datasets/image?dataset={outside}&filename=secret.png&thumb=false")
    assert img.status_code == 400


def test_caption_update_rejects_paths_outside_the_dataset(client, tmp_path):
    c, root = client
    c.post("/api/datasets", json={"name": "capguard"})
    outside = tmp_path.parent / "outside_caption"
    outside.mkdir(exist_ok=True)
    target = outside / "pwned.txt"

    resp = c.put(
        "/api/datasets/capguard/caption",
        json={"filename": str(target), "content": "written"},
    )
    assert resp.status_code == 400
    assert not target.exists()


def test_caption_update_still_works_for_normal_filenames(client, tmp_path):
    c, root = client
    c.post("/api/datasets", json={"name": "capok"})
    resp = c.put(
        "/api/datasets/capok/caption",
        json={"filename": "a.txt", "content": "hello"},
    )
    assert resp.status_code == 200
    assert (tmp_path / "training_datasets" / "capok" / "a.txt").read_text() == "hello"


def test_same_stem_image_and_video_both_appear(client, tmp_path):
    """An image and a video sharing a stem must not hide each other."""
    c, root = client
    c.post("/api/datasets", json={"name": "collide"})
    ds_dir = tmp_path / "training_datasets" / "collide"
    Image.new("RGB", (8, 8)).save(ds_dir / "a.png")
    _write_fake_video(ds_dir / "a.mp4")
    (ds_dir / "a.txt").write_text("shared caption", encoding="utf-8")

    items = c.get("/api/datasets/collide/files").json()["items"]
    media = sorted(i["media_name"] for i in items)
    assert media == ["a.mp4", "a.png"]

    # Both pair with the same caption file, which is what the trainer does.
    assert {i["caption_name"] for i in items} == {"a.txt"}
    assert {i["caption_content"] for i in items} == {"shared caption"}

    # The listing counts and the item list must agree.
    entry = next(d for d in c.get("/api/datasets").json()["datasets"] if d["name"] == "collide")
    assert entry["image_count"] + entry["video_count"] == len(items)


def test_part_paths_are_unique_per_upload(tmp_path):
    """Concurrent uploads of one filename must not share a scratch file."""
    from modules.webui.routers.datasets import part_path_for

    first = part_path_for(tmp_path, "clip.mp4")
    second = part_path_for(tmp_path, "clip.mp4")

    assert first != second
    assert first.suffix == ".part"
    assert second.suffix == ".part"


def test_upload_validates_whole_batch_before_writing(client, tmp_path):
    """A rejected file must not leave earlier files in the batch written."""
    c, root = client
    c.post("/api/datasets", json={"name": "batch"})
    buf = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buf, format="PNG")

    resp = c.post(
        "/api/datasets/batch/upload",
        files=[
            ("files", ("good.png", buf.getvalue(), "image/png")),
            ("files", ("evil.exe", b"MZ", "application/octet-stream")),
        ],
    )

    assert resp.status_code == 415
    ds_dir = tmp_path / "training_datasets" / "batch"
    assert not (ds_dir / "good.png").exists()
    assert list(ds_dir.glob("*.part")) == []


def test_upload_prewarms_image_thumbnails(client, tmp_path):
    """Uploaded images get their webp thumbnail built without a client request."""
    c, root = client
    c.post("/api/datasets", json={"name": "warm"})

    buf = io.BytesIO()
    Image.new("RGB", (300, 200), (5, 6, 7)).save(buf, format="PNG")
    resp = c.post(
        "/api/datasets/warm/upload",
        files=[("files", ("a.png", buf.getvalue(), "image/png"))],
    )
    assert resp.status_code == 200

    cache_dir = root / "workspace-cache" / "thumbnails"
    assert len(list(cache_dir.glob("*.webp"))) == 1


def test_upload_prewarm_failure_does_not_fail_the_upload(client, tmp_path):
    """A broken image still uploads; only its thumbnail is missing."""
    c, root = client
    c.post("/api/datasets", json={"name": "warmfail"})

    resp = c.post(
        "/api/datasets/warmfail/upload",
        files=[("files", ("broken.png", b"not really a png", "image/png"))],
    )

    assert resp.status_code == 200
    assert (tmp_path / "training_datasets" / "warmfail" / "broken.png").exists()
