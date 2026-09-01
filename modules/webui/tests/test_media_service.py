import asyncio
import os
from pathlib import Path

from modules.webui.media import MediaService
from modules.webui.state import AppState, WebUISettings

import av
import numpy as np
import pytest
from PIL import Image
from starlette.requests import Request
from starlette.responses import FileResponse


@pytest.fixture
def anyio_backend():
    return "asyncio"

def _make_test_video(path, frames=30, width=64, height=64):
    """Encode a short clip whose colour changes over time."""
    container = av.open(str(path), mode="w")
    stream = container.add_stream("libx264", rate=10)
    stream.width = width
    stream.height = height
    stream.pix_fmt = "yuv420p"
    for i in range(frames):
        arr = np.full((height, width, 3), fill_value=(i * 8) % 256, dtype=np.uint8)
        frame = av.VideoFrame.from_ndarray(arr, format="rgb24")
        for packet in stream.encode(frame):
            container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    return path


def test_get_video_poster_file_returns_jpeg(tmp_path):
    service = MediaService(tmp_path)
    video = _make_test_video(tmp_path / "clip.mp4")

    poster_path, mime, etag = service.get_video_poster_file(video)

    assert poster_path.exists()
    assert mime == "image/jpeg"
    assert etag
    with Image.open(poster_path) as img:
        assert img.size == (150, 150)


def test_get_video_poster_file_is_cached(tmp_path):
    service = MediaService(tmp_path)
    video = _make_test_video(tmp_path / "clip.mp4")

    first_path, _, first_etag = service.get_video_poster_file(video)
    first_mtime = first_path.stat().st_mtime_ns

    second_path, _, second_etag = service.get_video_poster_file(video)

    assert second_path == first_path
    assert second_etag == first_etag
    assert second_path.stat().st_mtime_ns == first_mtime


def test_get_video_poster_file_falls_back_on_undecodable_input(tmp_path):
    service = MediaService(tmp_path)
    broken = tmp_path / "broken.mp4"
    broken.write_bytes(b"not a video")

    poster_path, mime, _ = service.get_video_poster_file(broken)

    assert poster_path.exists()
    assert mime == "image/png"

def test_media_service_init_creates_cache_dir(tmp_path: Path):
    service = MediaService(root_dir=tmp_path)
    expected_cache_dir = tmp_path / "workspace-cache" / "thumbnails"
    assert service.cache_dir == expected_cache_dir
    assert expected_cache_dir.is_dir()


def test_get_thumbnail_file_generates_webp_and_caches(tmp_path: Path):
    service = MediaService(root_dir=tmp_path)

    # Create test source image (300x200)
    source_path = tmp_path / "source.jpg"
    img = Image.new("RGB", (300, 200), color="blue")
    img.save(source_path, format="JPEG")

    thumb_path, mime_type, etag = service.get_thumbnail_file(
        source_path, width=150, height=150, crop_square=True
    )

    assert mime_type == "image/webp"
    assert thumb_path.exists()
    assert thumb_path.parent == service.cache_dir
    assert etag is not None and len(etag) > 0

    with Image.open(thumb_path) as thumb_img:
        assert thumb_img.format == "WEBP"
        assert thumb_img.size == (150, 150)

    # Calling again should return same cached file
    thumb_path_2, mime_type_2, etag_2 = service.get_thumbnail_file(
        source_path, width=150, height=150, crop_square=True
    )
    assert thumb_path_2 == thumb_path
    assert etag_2 == etag


def test_cache_invalidation_on_mtime_change(tmp_path: Path):
    service = MediaService(root_dir=tmp_path)

    source_path = tmp_path / "photo.png"
    img = Image.new("RGB", (100, 100), color="red")
    img.save(source_path, format="PNG")

    thumb_1, _, etag_1 = service.get_thumbnail_file(source_path, width=50, height=50)

    # Update mtime into future
    current_mtime = source_path.stat().st_mtime
    new_mtime = current_mtime + 10.0
    os.utime(source_path, (new_mtime, new_mtime))

    thumb_2, _, etag_2 = service.get_thumbnail_file(source_path, width=50, height=50)

    assert etag_1 != etag_2
    assert thumb_1 != thumb_2


@pytest.mark.asyncio
async def test_serve_image_full_and_thumbnail(tmp_path: Path):
    service = MediaService(root_dir=tmp_path)

    source_path = tmp_path / "photo.png"
    img = Image.new("RGB", (200, 100), color="green")
    img.save(source_path, format="PNG")

    # Serve full image
    req = Request({"type": "http", "headers": []})
    resp = await service.serve_image(req, source_path, thumb=False)
    assert isinstance(resp, FileResponse)
    assert resp.headers.get("Cache-Control") == "public, max-age=86400"
    etag = resp.headers.get("ETag")
    assert etag is not None

    # Serve thumbnail
    resp_thumb = await service.serve_image(req, source_path, thumb=True, target_size=100)
    assert isinstance(resp_thumb, FileResponse)
    assert resp_thumb.headers.get("Cache-Control") == "public, max-age=86400"


@pytest.mark.asyncio
async def test_serve_image_if_none_match_304(tmp_path: Path):
    service = MediaService(root_dir=tmp_path)

    source_path = tmp_path / "photo.png"
    img = Image.new("RGB", (100, 100), color="red")
    img.save(source_path, format="PNG")

    req1 = Request({"type": "http", "headers": []})
    resp1 = await service.serve_image(req1, source_path, thumb=True)
    etag = resp1.headers.get("ETag")

    # Request with matching If-None-Match
    headers = [(b"if-none-match", etag.encode("utf-8"))]
    req2 = Request({"type": "http", "headers": headers})
    resp2 = await service.serve_image(req2, source_path, thumb=True)
    assert resp2.status_code == 304


def test_missing_and_corrupt_files_fallback(tmp_path: Path):
    service = MediaService(root_dir=tmp_path)

    # Non-existent file
    missing_path = tmp_path / "does_not_exist.jpg"
    thumb_path, mime_type, etag = service.get_thumbnail_file(missing_path)
    assert thumb_path.exists()
    assert mime_type == "image/png"
    with Image.open(thumb_path) as fallback_img:
        assert fallback_img.size == (150, 150)

    # Corrupt image file
    corrupt_path = tmp_path / "corrupt.jpg"
    corrupt_path.write_bytes(b"not a real image payload")
    thumb_path_c, mime_type_c, _ = service.get_thumbnail_file(corrupt_path)
    assert thumb_path_c.exists()
    assert mime_type_c == "image/png"


def test_app_state_media_service_registration(tmp_path: Path):
    media_svc = MediaService(root_dir=tmp_path)
    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "static",
    )
    state = AppState(
        settings=settings,
        config=None,  # type: ignore
        schema=None,  # type: ignore
        presets=None,  # type: ignore
        directories=None,  # type: ignore
        media_service=media_svc,
    )
    assert state.media_service == media_svc


@pytest.mark.asyncio
async def test_serve_image_full_image_handles_unreadable_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    service = MediaService(root_dir=tmp_path)
    req = Request({"type": "http", "headers": []})

    # Non-existent path
    missing_path = tmp_path / "does_not_exist.jpg"
    resp = await service.serve_image(req, missing_path, thumb=False)
    assert isinstance(resp, FileResponse)
    assert resp.media_type == "image/png"
    assert Path(resp.path).name.startswith("placeholder_")

    # Path that raises OSError during stat
    unreadable_path = tmp_path / "unreadable.jpg"
    unreadable_path.write_bytes(b"dummy")

    orig_stat = Path.stat

    def mock_stat(self, *args, **kwargs):
        if self == unreadable_path:
            raise OSError("Permission denied")
        return orig_stat(self, *args, **kwargs)

    monkeypatch.setattr(Path, "stat", mock_stat)

    resp_oserror = await service.serve_image(req, unreadable_path, thumb=False)
    assert isinstance(resp_oserror, FileResponse)
    assert resp_oserror.media_type == "image/png"
    assert Path(resp_oserror.path).name.startswith("placeholder_")





@pytest.mark.anyio
async def test_warm_thumbnail_precomputes_the_cache(tmp_path):
    service = MediaService(tmp_path)
    source = tmp_path / "a.png"
    Image.new("RGB", (400, 300), (10, 20, 30)).save(source)

    assert list(service.cache_dir.glob("*.webp")) == []

    await service.warm_thumbnail(source)

    cached = list(service.cache_dir.glob("*.webp"))
    assert len(cached) == 1


@pytest.mark.anyio
async def test_warm_thumbnail_ignores_unsupported_and_missing_files(tmp_path):
    service = MediaService(tmp_path)

    caption = tmp_path / "a.txt"
    caption.write_text("not an image", encoding="utf-8")

    # Neither of these may raise, and neither may write a cache entry.
    await service.warm_thumbnail(caption)
    await service.warm_thumbnail(tmp_path / "missing.png")

    assert list(service.cache_dir.glob("*.webp")) == []


@pytest.mark.anyio
async def test_warm_thumbnail_bounds_its_concurrency(tmp_path):
    service = MediaService(tmp_path)
    sources = []
    for i in range(12):
        p = tmp_path / f"img{i}.png"
        Image.new("RGB", (200, 200), (i, i, i)).save(p)
        sources.append(p)

    peak = 0
    live = 0
    real_get = service.get_thumbnail_file

    def tracking_get(*args, **kwargs):
        nonlocal peak, live
        live += 1
        peak = max(peak, live)
        try:
            return real_get(*args, **kwargs)
        finally:
            live -= 1

    service.get_thumbnail_file = tracking_get

    await asyncio.gather(*(service.warm_thumbnail(p) for p in sources))

    assert len(list(service.cache_dir.glob("*.webp"))) == 12
    assert peak <= MediaService.WARM_CONCURRENCY
