# Dataset Upload UX and Video Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the opaque single-request dataset upload with per-file progress, cancel, and retry, and add video files to datasets with server-extracted poster frames.

**Architecture:** Uploads become one `XMLHttpRequest` per file (the only browser API exposing upload progress), driven by a module-level queue store capped at 3 concurrent transfers. The server streams each file to a `.part` file and renames it atomically, then publishes a `dataset.file.added` event on the existing WebSocket EventHub so the UI can flip a skeleton card into a real one. Video reuses the existing thumbnail cache for PyAV-extracted poster frames and gets a Range-capable streaming endpoint.

**Tech Stack:** FastAPI, Starlette, PyAV (`av==16.1.0`, already in `requirements-global.txt`), Pillow, pytest; SvelteKit with Svelte 5 runes, TanStack Query, Vitest with `@testing-library/svelte`, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-31-dataset-upload-ux-design.md`

## Global Constraints

- Supported video extensions come from `modules/util/path_util.py::SUPPORTED_VIDEO_EXTENSIONS` — `.webm .mkv .flv .avi .mov .wmv .mp4 .mpeg .m4v`. Never hardcode this list; call `path_util.is_supported_video_extension`.
- Supported image extensions come from `path_util.is_supported_image_extension`. Caption extensions in the datasets router are `.txt` and `.caption` (broader than `path_util.SUPPORTED_CAPTION_EXTENSIONS`, which is `.txt` only — keep the router's broader pair).
- Browser-playable video containers are exactly `.mp4`, `.webm`, `.m4v`, `.mov`. All other supported video formats get a poster but no player.
- Upload concurrency cap is **3** simultaneous files.
- No new Python or npm dependencies. PyAV and Pillow are already available.
- No chunked or resumable uploads. No transcoding. No inline `<video>` in grid cards.
- Backend tests: `pytest modules/webui/tests/<file> -v`. Frontend tests: `cd web && npm test`. Never `cd` in a compound shell command — run npm from `web/` with `npm --prefix web test`.
- Every task ends with a commit. Run the full test file (not just the new test) before committing.

---

## File Structure

**Backend**

| File | Responsibility |
|---|---|
| `modules/webui/routers/datasets.py` (modify) | Media-kind classification, streaming upload, event publication, video streaming endpoint |
| `modules/webui/media.py` (modify) | Add `get_video_poster_file()` and `serve_video()` alongside the existing thumbnail logic |
| `modules/webui/tests/test_datasets_router.py` (modify) | Router tests |
| `modules/webui/tests/test_media_service.py` (modify) | Poster extraction and cache tests |

**Frontend**

| File | Responsibility |
|---|---|
| `web/src/lib/api/client.ts` (modify) | Add `xhrUpload()`; remove `uploadDatasetFiles()` |
| `web/src/lib/upload/upload-queue.svelte.ts` (create) | Module-level queue: concurrency, progress accounting, cancel, retry |
| `web/src/lib/upload/upload-queue.test.ts` (create) | Queue unit tests against a fake uploader |
| `web/src/lib/upload/media-kind.ts` (create) | Shared extension → kind and playability helpers |
| `web/src/lib/components/datasets/UploadSummaryBar.svelte` (create) | Aggregate progress header |
| `web/src/lib/components/datasets/UploadSkeletonCard.svelte` (create) | In-grid per-file progress card with cancel/retry |
| `web/src/lib/components/datasets/DatasetFileCard.svelte` (modify) | Branch on `kind`; poster + play badge for video |
| `web/src/routes/(app)/datasets/[id]/+page.svelte` (modify) | Wire queue, skeleton cards, summary bar, video lightbox |
| `web/src/lib/events/client.ts` (modify) | Route `dataset.file.added` to a new callback |
| `web/src/lib/components/LayoutContent.svelte` (modify) | Handle the event: invalidate queries and mark the queue entry done |
| `web/src/lib/api/queries.ts` (modify) | Delete `createUploadDatasetFilesMutation` |
| `web/e2e/dataset-upload.spec.ts` (create) | End-to-end progress UI test |

---

## Task 1: Backend — classify images, video, and captions in dataset listings

**Files:**
- Modify: `modules/webui/routers/datasets.py:43-71` (`list_datasets`), `:114-141` (`get_dataset_files`), `:164-169` (caption auto-create)
- Test: `modules/webui/tests/test_datasets_router.py`

**Interfaces:**
- Consumes: `modules.util.path_util.is_supported_image_extension`, `is_supported_video_extension`
- Produces:
  - `classify_media(ext: str) -> str | None` returning `"image"`, `"video"`, `"text"`, or `None` for unsupported
  - `CAPTION_EXTENSIONS: set[str]` = `{".txt", ".caption"}`
  - `ALLOWED_UPLOAD_EXTENSIONS: set[str]` = images ∪ videos ∪ captions
  - `GET /api/datasets` items gain `video_count: int`
  - `GET /api/datasets/{name}/files` items gain `kind: "image" | "video" | "text"` and `media_name: str | None`. The existing `image_name` field is retained as a deprecated alias in this task and removed in Task 11.

- [ ] **Step 1: Write the failing tests**

Append to `modules/webui/tests/test_datasets_router.py`:

```python
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


def test_dataset_files_keeps_image_name_alias(client):
    c, tmp_path = client
    c.post("/api/datasets", json={"name": "alias"})
    Image.new("RGB", (8, 8)).save(tmp_path / "training_datasets" / "alias" / "a.png")

    item = c.get("/api/datasets/alias/files").json()["items"][0]
    assert item["image_name"] == "a.png"
```

Note: the datasets base directory defaults to `training_datasets` under `root_dir`. If the tests fail on a path mismatch, read the resolved directory from `c.get("/api/datasets").json()["resolved_base_dir"]` instead of hardcoding it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest modules/webui/tests/test_datasets_router.py -v -k "video_count or kind_and_media_name or image_name_alias"`
Expected: FAIL with `KeyError: 'video_count'` and `KeyError: 'kind'`.

- [ ] **Step 3: Add the classifier**

In `modules/webui/routers/datasets.py`, below `SAFE_NAME_REGEX`:

```python
CAPTION_EXTENSIONS = {".txt", ".caption"}

ALLOWED_UPLOAD_EXTENSIONS = (
    path_util.supported_image_extensions()
    | path_util.supported_video_extensions()
    | CAPTION_EXTENSIONS
)


def classify_media(ext: str) -> str | None:
    """Return 'image', 'video', 'text', or None for an unsupported extension."""
    ext = ext.lower()
    if path_util.is_supported_image_extension(ext):
        return "image"
    if path_util.is_supported_video_extension(ext):
        return "video"
    if ext in CAPTION_EXTENSIONS:
        return "text"
    return None
```

- [ ] **Step 4: Use it in `list_datasets`**

Replace the counting loop in `list_datasets`:

```python
                img_count = 0
                vid_count = 0
                cap_count = 0
                for f in entry.glob("*.*"):
                    kind = classify_media(f.suffix)
                    if kind == "image":
                        img_count += 1
                    elif kind == "video":
                        vid_count += 1
                    elif kind == "text":
                        cap_count += 1
```

and add `"video_count": vid_count,` to the appended dict, beside `"image_count"`.

- [ ] **Step 5: Use it in `get_dataset_files`**

Replace the body of the loop in `get_dataset_files`:

```python
    items_map = {}
    for p in sorted(ds_dir.glob("*.*")):
        if p.name.startswith("."):
            continue
        kind = classify_media(p.suffix)
        if kind is None:
            continue
        stem = p.stem
        if stem not in items_map:
            items_map[stem] = {
                "id": stem,
                "kind": "text",
                "media_name": None,
                # Deprecated alias, removed in Task 11.
                "image_name": None,
                "caption_name": None,
                "caption_content": "",
            }
        item = items_map[stem]

        if kind in ("image", "video"):
            item["kind"] = kind
            item["media_name"] = p.name
            if kind == "image":
                item["image_name"] = p.name
        else:
            item["caption_name"] = p.name
            try:
                item["caption_content"] = p.read_text(encoding="utf-8")
            except OSError:
                item["caption_content"] = ""
```

- [ ] **Step 6: Auto-create captions for video too**

In `upload_dataset_files`, replace the image-only caption block:

```python
        if classify_media(dest.suffix) in ("image", "video"):
            txt_dest = ds_dir / f"{dest.stem}.txt"
            if not txt_dest.exists():
                txt_dest.write_text("", encoding="utf-8")
```

- [ ] **Step 7: Run the full test file**

Run: `pytest modules/webui/tests/test_datasets_router.py -v`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 8: Commit**

```bash
git add modules/webui/routers/datasets.py modules/webui/tests/test_datasets_router.py
git commit -m "feat(webui): classify video files in dataset listings"
```

---

## Task 2: Backend — stream uploads to disk with atomic rename and validation

**Files:**
- Modify: `modules/webui/routers/datasets.py:144-171` (`upload_dataset_files`), `:114-141` (`get_dataset_files`, to skip `.part`)
- Test: `modules/webui/tests/test_datasets_router.py`

**Interfaces:**
- Consumes: `classify_media`, `ALLOWED_UPLOAD_EXTENSIONS` from Task 1
- Produces: `POST /api/datasets/{name}/upload` returns 415 with `detail` naming the rejected file when any file has an unsupported extension. Successful responses keep the `{"saved": [...]}` shape. No `.part` file survives a completed or failed request.

**Why streaming:** FastAPI's `UploadFile` spools to a temporary file past 1 MB, so `f.file` is a real file object. `shutil.copyfileobj` moves it to the destination in fixed-size chunks, keeping memory bounded regardless of file size. The current `await f.read()` allocates the entire file.

- [ ] **Step 1: Write the failing tests**

Append to `modules/webui/tests/test_datasets_router.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest modules/webui/tests/test_datasets_router.py -v -k "unsupported_extension or part_files or streams_large or ignores_part"`
Expected: FAIL — the unsupported file is silently skipped (200 instead of 415), `copyfileobj` is never called, and the `.part` file surfaces as an item.

- [ ] **Step 3: Rewrite the upload handler**

Replace the body of `upload_dataset_files` in `modules/webui/routers/datasets.py`:

```python
UPLOAD_CHUNK_BYTES = 1024 * 1024


@router.post("/datasets/{name}/upload")
async def upload_dataset_files(
    name: str, request: Request, files: list[UploadFile] = File(...)  # noqa: B008
):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    ds_dir = base_dir / name
    if not ds_dir.exists() or not ds_dir.is_dir():
        raise HTTPException(status_code=404, detail="Dataset not found")

    saved = []
    for f in files:
        filename = os.path.basename(f.filename or "")
        if not filename or ".." in filename:
            raise HTTPException(status_code=400, detail=f"Invalid filename: {f.filename!r}")

        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type: {filename}",
            )

        dest = ds_dir / filename
        part = ds_dir / f"{filename}.part"
        try:
            with part.open("wb") as out:
                await run_in_threadpool(
                    shutil.copyfileobj, f.file, out, UPLOAD_CHUNK_BYTES
                )
            os.replace(part, dest)
        except Exception:
            part.unlink(missing_ok=True)
            raise
        finally:
            await f.close()

        saved.append(filename)

        if classify_media(dest.suffix) in ("image", "video"):
            txt_dest = ds_dir / f"{dest.stem}.txt"
            if not txt_dest.exists():
                txt_dest.write_text("", encoding="utf-8")

    return {"saved": saved}
```

Add the import at the top of the file:

```python
from starlette.concurrency import run_in_threadpool
```

`shutil` and `os` are already imported.

- [ ] **Step 4: Skip `.part` files in the listing**

In `get_dataset_files`, extend the skip condition at the top of the loop:

```python
        if p.name.startswith(".") or p.suffix.lower() == ".part":
            continue
```

- [ ] **Step 5: Run the full test file**

Run: `pytest modules/webui/tests/test_datasets_router.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modules/webui/routers/datasets.py modules/webui/tests/test_datasets_router.py
git commit -m "feat(webui): stream dataset uploads to disk with atomic rename"
```

---

## Task 3: Backend — publish `dataset.file.added` on successful upload

**Files:**
- Modify: `modules/webui/routers/datasets.py` (`upload_dataset_files`)
- Test: `modules/webui/tests/test_datasets_router.py`

**Interfaces:**
- Consumes: `app_state.events.publish(event_type: str, data: dict) -> Awaitable[dict]` from `modules/webui/events.py:220`
- Produces: an event with `type == "dataset.file.added"` and payload keys `dataset`, `filename`, `item_id`, `kind`. One event per saved media file. Caption-only uploads (`.txt`/`.caption`) also publish, with `kind == "text"`.

- [ ] **Step 1: Write the failing test**

Append to `modules/webui/tests/test_datasets_router.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest modules/webui/tests/test_datasets_router.py::test_upload_publishes_file_added_event -v`
Expected: FAIL — `added` is empty.

- [ ] **Step 3: Publish the event**

In `upload_dataset_files`, after the caption auto-create block and before the loop ends:

```python
        await app_state.events.publish(
            "dataset.file.added",
            {
                "dataset": name,
                "filename": filename,
                "item_id": dest.stem,
                "kind": classify_media(dest.suffix) or "text",
            },
        )
```

- [ ] **Step 4: Run the full test file**

Run: `pytest modules/webui/tests/test_datasets_router.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/webui/routers/datasets.py modules/webui/tests/test_datasets_router.py
git commit -m "feat(webui): publish dataset.file.added event on upload"
```

---

## Task 4: Backend — extract video poster frames with PyAV

**Files:**
- Modify: `modules/webui/media.py`
- Modify: `modules/webui/routers/datasets.py:191-215` (`get_dataset_image`)
- Test: `modules/webui/tests/test_media_service.py`

**Interfaces:**
- Consumes: the existing `MediaService.cache_dir`, `_compute_cache_key`, `_get_fallback_placeholder_file`, and `save_pil_atomic`
- Produces:
  - `MediaService.get_video_poster_file(source_path: Path, width: int = 150, height: int = 150) -> tuple[Path, str, str]` returning `(file_path, mime_type, etag)`, matching the shape `get_thumbnail_file` returns
  - `MediaService.serve_media(request, source_path, thumb=False, target_size=150) -> Response` which dispatches to poster extraction for video paths and to `serve_image` otherwise
  - `GET /api/datasets/image?dataset=&filename=` now serves poster frames for video filenames

**Why 10% of duration:** frame zero is frequently black, a fade-in, or a title card. Seeking to a tenth of the way in reliably lands on content.

- [ ] **Step 1: Write the failing tests**

Append to `modules/webui/tests/test_media_service.py`:

```python
import av
import numpy as np


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
```

If `test_media_service.py` does not already import `MediaService`, `Image`, or `Path`, add those imports at the top of the file to match the existing test style.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest modules/webui/tests/test_media_service.py -v -k poster`
Expected: FAIL with `AttributeError: 'MediaService' object has no attribute 'get_video_poster_file'`.

- [ ] **Step 3: Implement poster extraction**

Add to `modules/webui/media.py`, inside `MediaService`:

```python
    POSTER_SEEK_FRACTION = 0.1

    def get_video_poster_file(
        self, source_path: Path, width: int = 150, height: int = 150
    ) -> tuple[Path, str, str]:
        """Extract a representative frame, cached alongside image thumbnails."""
        try:
            stat = source_path.stat()
        except OSError:
            return self._get_fallback_placeholder_file(width, height)

        cache_key = self._compute_cache_key(
            source_path, stat.st_mtime, stat.st_size, width, height, True
        )
        cache_path = self.cache_dir / f"poster_{cache_key}.jpg"
        if cache_path.exists():
            return cache_path, "image/jpeg", cache_key

        frame_image = self._decode_poster_frame(source_path)
        if frame_image is None:
            return self._get_fallback_placeholder_file(width, height)

        self._ensure_cache_dir()
        poster = ImageOps.fit(
            frame_image.convert("RGB"), (width, height), Image.Resampling.LANCZOS
        )
        try:
            save_pil_atomic(poster, cache_path, image_format="JPEG")
        except OSError:
            return self._get_fallback_placeholder_file(width, height)

        return cache_path, "image/jpeg", cache_key

    @staticmethod
    def _decode_poster_frame(source_path: Path) -> "Image.Image | None":
        try:
            with av.open(str(source_path)) as container:
                stream = next(
                    (s for s in container.streams if s.type == "video"), None
                )
                if stream is None:
                    return None
                stream.thread_type = "AUTO"

                if container.duration:
                    offset = int(
                        container.duration * MediaService.POSTER_SEEK_FRACTION
                    )
                    # Seeking can fail on containers without an index; a
                    # failed seek just means we decode from the start.
                    with contextlib.suppress(Exception):
                        container.seek(offset)

                for frame in container.decode(stream):
                    return frame.to_image()
        except Exception:
            return None
        return None
```

Add these imports at the top of `modules/webui/media.py`:

```python
import contextlib

import av
```

`Image`, `ImageOps`, and `save_pil_atomic` are already imported.

- [ ] **Step 4: Add the dispatching `serve_media`**

Add to `MediaService`, below `serve_image`:

```python
    async def serve_media(
        self,
        request: Request,
        source_path: Path,
        thumb: bool = False,
        target_size: int = 150,
    ) -> Response:
        """Serve an image, or a poster frame when the source is a video."""
        if not path_util.is_supported_video_extension(source_path.suffix):
            return await self.serve_image(
                request, source_path, thumb=thumb, target_size=target_size
            )

        file_path, mime_type, etag = await run_in_threadpool(
            self.get_video_poster_file, source_path, target_size, target_size
        )

        if_none_match = request.headers.get("if-none-match")
        if if_none_match and if_none_match.strip('"') == etag.strip('"'):
            return Response(status_code=304)

        return FileResponse(
            file_path,
            media_type=mime_type,
            headers={"ETag": f'"{etag}"', "Cache-Control": "public, max-age=86400"},
        )
```

Add `from modules.util import path_util` to the imports in `modules/webui/media.py`.

- [ ] **Step 5: Route the datasets image endpoint through `serve_media`**

In `modules/webui/routers/datasets.py`, in `get_dataset_image`, change the fallback scan to accept video and change the final return:

```python
    else:
        if ds_dir.exists() and ds_dir.is_dir():
            for f in sorted(ds_dir.glob("*.*")):
                if classify_media(f.suffix) in ("image", "video"):
                    img_path = f
                    break

    return await app_state.media_service.serve_media(
        request, img_path or Path(""), thumb=thumb
    )
```

This makes a video-only dataset show a poster as its card thumbnail in the datasets list.

- [ ] **Step 6: Run both test files**

Run: `pytest modules/webui/tests/test_media_service.py modules/webui/tests/test_datasets_router.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add modules/webui/media.py modules/webui/routers/datasets.py modules/webui/tests/test_media_service.py
git commit -m "feat(webui): extract cached poster frames for dataset videos"
```

---

## Task 5: Backend — Range-capable video streaming endpoint

**Files:**
- Modify: `modules/webui/routers/datasets.py`
- Test: `modules/webui/tests/test_datasets_router.py`

**Interfaces:**
- Produces: `GET /api/datasets/video?dataset=<name>&filename=<file>` returning a `FileResponse`. Starlette's `FileResponse` handles `Range` natively, returning 206 with `Content-Range` for partial requests. Returns 400 on `..` in either parameter or on a non-video extension, 404 when the file is missing.

- [ ] **Step 1: Write the failing tests**

Append to `modules/webui/tests/test_datasets_router.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest modules/webui/tests/test_datasets_router.py -v -k video_endpoint`
Expected: FAIL with 404 from the router — the route does not exist.

- [ ] **Step 3: Add the endpoint**

Add to `modules/webui/routers/datasets.py`, after `get_dataset_image`:

```python
@router.get("/datasets/video")
async def get_dataset_video(dataset: str, filename: str, request: Request):
    app_state: AppState = request.app.state.webui
    if ".." in dataset or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not path_util.is_supported_video_extension(Path(filename).suffix):
        raise HTTPException(status_code=400, detail="Not a supported video file")

    base_dir = get_base_datasets_dir(app_state)
    video_path = base_dir / dataset / os.path.basename(filename)
    if not video_path.exists() or not video_path.is_file():
        raise HTTPException(status_code=404, detail="Video not found")

    mime_type, _ = mimetypes.guess_type(video_path)
    return FileResponse(
        video_path,
        media_type=mime_type or "application/octet-stream",
        headers={"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"},
    )
```

Add these imports to `modules/webui/routers/datasets.py`:

```python
import mimetypes

from starlette.responses import FileResponse
```

Register this route **before** `/datasets/{name}/files`-style routes if FastAPI reports a conflict; the literal path `/datasets/video` must not be captured by `/datasets/{name}`. Placing it beside the existing `/datasets/image` route (which already coexists with `/datasets/{name}`) avoids this.

- [ ] **Step 4: Run the full test file**

Run: `pytest modules/webui/tests/test_datasets_router.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/webui/routers/datasets.py modules/webui/tests/test_datasets_router.py
git commit -m "feat(webui): add range-capable dataset video streaming endpoint"
```

---

## Task 6: Frontend — `xhrUpload` helper with progress and abort

**Files:**
- Modify: `web/src/lib/api/client.ts`
- Test: `web/src/lib/api/client.test.ts`

**Interfaces:**
- Produces, exported from `web/src/lib/api/client.ts`:

```ts
export interface UploadHandle {
  promise: Promise<{ saved: string[] }>;
  abort: () => void;
}

export function xhrUpload(
  name: string,
  file: File,
  onProgress: (sent: number, total: number) => void
): UploadHandle;
```

Rejects with `ApiError` on non-2xx, and with an `Error` whose `name` is `'AbortError'` when aborted. The FormData field name is `files`, matching the `list[UploadFile]` parameter the backend still declares.

**Why XHR and not fetch:** `fetch` exposes no upload progress in any shipping browser. Streaming request bodies are Chrome-only and require HTTP/2. `xhr.upload.onprogress` is the only portable source of sent-byte counts.

- [ ] **Step 1: Write the failing test**

Append to `web/src/lib/api/client.test.ts`:

```ts
import { xhrUpload, ApiError } from './client';

class FakeXhr {
  static last: FakeXhr;
  upload = { onprogress: null as ((e: any) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = '';
  aborted = false;
  openArgs: [string, string] | null = null;
  withCredentials = false;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.openArgs = [method, url];
  }
  send(_body: any) {}
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

function withFakeXhr(fn: () => void | Promise<void>) {
  const original = globalThis.XMLHttpRequest;
  (globalThis as any).XMLHttpRequest = FakeXhr;
  return Promise.resolve(fn()).finally(() => {
    (globalThis as any).XMLHttpRequest = original;
  });
}

test('xhrUpload reports progress and resolves with the parsed body', async () =>
  withFakeXhr(async () => {
    const seen: Array<[number, number]> = [];
    const file = new File(['abc'], 'a.png', { type: 'image/png' });
    const handle = xhrUpload('My Set', file, (sent, total) => seen.push([sent, total]));

    const xhr = FakeXhr.last;
    expect(xhr.openArgs).toEqual(['POST', '/api/datasets/My%20Set/upload']);

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 3 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 3 });
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ saved: ['a.png'] });
    xhr.onload?.();

    await expect(handle.promise).resolves.toEqual({ saved: ['a.png'] });
    expect(seen).toEqual([
      [1, 3],
      [3, 3],
    ]);
  }));

test('xhrUpload rejects with ApiError on a failure status', async () =>
  withFakeXhr(async () => {
    const file = new File(['abc'], 'evil.exe');
    const handle = xhrUpload('set', file, () => {});

    const xhr = FakeXhr.last;
    xhr.status = 415;
    xhr.responseText = JSON.stringify({ detail: 'Unsupported file type: evil.exe' });
    xhr.onload?.();

    await expect(handle.promise).rejects.toBeInstanceOf(ApiError);
  }));

test('xhrUpload abort rejects with an AbortError', async () =>
  withFakeXhr(async () => {
    const file = new File(['abc'], 'a.png');
    const handle = xhrUpload('set', file, () => {});

    handle.abort();

    await expect(handle.promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXhr.last.aborted).toBe(true);
  }));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web test -- client.test.ts`
Expected: FAIL — `xhrUpload` is not exported.

- [ ] **Step 3: Implement `xhrUpload`**

Add to `web/src/lib/api/client.ts`, near the other exports:

```ts
export interface UploadHandle {
  promise: Promise<{ saved: string[] }>;
  abort: () => void;
}

/**
 * Upload one file with progress reporting.
 *
 * Uses XMLHttpRequest rather than fetch because fetch exposes no upload
 * progress in any shipping browser.
 */
export function xhrUpload(
  name: string,
  file: File,
  onProgress: (sent: number, total: number) => void
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('files', file);

  const promise = new Promise<{ saved: string[] }>((resolve, reject) => {
    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      let body: any;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = xhr.responseText;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
        return;
      }
      const detail = body?.detail !== undefined ? body.detail : body;
      reject(new ApiError(xhr.status, detail));
    };

    xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'));

    xhr.onabort = () => {
      const err = new Error('Upload canceled');
      err.name = 'AbortError';
      reject(err);
    };

    xhr.open('POST', `/api/datasets/${encodeURIComponent(name)}/upload`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}
```

- [ ] **Step 4: Run the full test file**

Run: `npm --prefix web test -- client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api/client.ts web/src/lib/api/client.test.ts
git commit -m "feat(web): add xhrUpload helper with progress and abort"
```

---

## Task 7: Frontend — upload queue store

**Files:**
- Create: `web/src/lib/upload/upload-queue.svelte.ts`
- Test: `web/src/lib/upload/upload-queue.test.ts`

**Interfaces:**
- Consumes: `UploadHandle` from Task 6
- Produces:

```ts
export type UploadStatus =
  | 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled';

export interface UploadEntry {
  id: string;
  datasetName: string;
  filename: string;
  sent: number;
  total: number;
  status: UploadStatus;
  error?: string;
}

export type Uploader = (
  name: string,
  file: File,
  onProgress: (sent: number, total: number) => void
) => UploadHandle;

export class UploadQueue {
  constructor(uploader?: Uploader, concurrency?: number);
  readonly entries: UploadEntry[];
  readonly active: boolean;
  readonly totals: { files: number; done: number; failed: number; sent: number; total: number };
  enqueue(datasetName: string, files: File[] | FileList): void;
  entriesFor(datasetName: string): UploadEntry[];
  cancel(id: string): void;
  cancelAll(): void;
  retry(id: string): void;
  markProcessed(datasetName: string, filename: string): void;
  clearFinished(): void;
}

export const uploadQueue: UploadQueue;
```

Semantics the tests pin down:
- At most `concurrency` (default 3) entries are `uploading` at once.
- A successful HTTP response moves the entry to `processing`, not `done`. `markProcessed` (driven by the `dataset.file.added` event, Task 9) moves it to `done`.
- `cancel` aborts only the targeted entry and immediately starts the next queued one.
- `retry` resets an `error` entry to `queued` with `sent = 0`.
- `totals.sent` counts `done` and `processing` entries at their full size, so the aggregate bar reaches 100%.

The exported `uploadQueue` singleton is module-level so uploads survive navigation away from the dataset page.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/upload/upload-queue.test.ts`:

```ts
import { expect, test, vi } from 'vitest';
import { UploadQueue, type Uploader } from './upload-queue.svelte';

type Pending = {
  name: string;
  file: File;
  onProgress: (sent: number, total: number) => void;
  resolve: (v: any) => void;
  reject: (e: any) => void;
  aborted: boolean;
};

function fakeUploader() {
  const pending: Pending[] = [];
  const uploader: Uploader = (name, file, onProgress) => {
    let entry!: Pending;
    const promise = new Promise((resolve, reject) => {
      entry = { name, file, onProgress, resolve, reject, aborted: false };
    });
    pending.push(entry);
    return {
      promise: promise as Promise<{ saved: string[] }>,
      abort: () => {
        entry.aborted = true;
        const err = new Error('Upload canceled');
        err.name = 'AbortError';
        entry.reject(err);
      },
    };
  };
  return { uploader, pending };
}

function makeFiles(n: number, size = 100) {
  return Array.from(
    { length: n },
    (_, i) => new File([new Uint8Array(size)], `f${i}.png`, { type: 'image/png' })
  );
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test('runs at most three uploads concurrently', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(5));
  await flush();

  expect(pending).toHaveLength(3);
  expect(queue.entries.filter((e) => e.status === 'uploading')).toHaveLength(3);
  expect(queue.entries.filter((e) => e.status === 'queued')).toHaveLength(2);

  pending[0].resolve({ saved: ['f0.png'] });
  await flush();

  expect(pending).toHaveLength(4);
});

test('a completed upload waits in processing until the event arrives', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(1));
  await flush();
  pending[0].resolve({ saved: ['f0.png'] });
  await flush();

  expect(queue.entries[0].status).toBe('processing');

  queue.markProcessed('ds', 'f0.png');
  expect(queue.entries[0].status).toBe('done');
});

test('progress updates the entry byte count', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(1, 400));
  await flush();
  pending[0].onProgress(160, 400);

  expect(queue.entries[0].sent).toBe(160);
  expect(queue.entries[0].total).toBe(400);
});

test('cancel aborts only its own entry and starts the next queued one', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(4));
  await flush();

  queue.cancel(queue.entries[0].id);
  await flush();

  expect(pending[0].aborted).toBe(true);
  expect(pending[1].aborted).toBe(false);
  expect(queue.entries[0].status).toBe('canceled');
  expect(pending).toHaveLength(4);
});

test('a failed upload records its error and can be retried', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(1));
  await flush();
  pending[0].reject(new Error('Unsupported file type: f0.png'));
  await flush();

  expect(queue.entries[0].status).toBe('error');
  expect(queue.entries[0].error).toContain('Unsupported file type');

  queue.retry(queue.entries[0].id);
  await flush();

  expect(queue.entries[0].status).toBe('uploading');
  expect(queue.entries[0].sent).toBe(0);
  expect(pending).toHaveLength(2);
});

test('totals aggregate across mixed statuses', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(3, 100));
  await flush();

  pending[0].resolve({ saved: ['f0.png'] });
  await flush();
  queue.markProcessed('ds', 'f0.png');
  pending[1].onProgress(50, 100);
  pending[2].reject(new Error('boom'));
  await flush();

  expect(queue.totals).toMatchObject({
    files: 3,
    done: 1,
    failed: 1,
    sent: 150,
    total: 300,
  });
});

test('entriesFor filters by dataset', async () => {
  const { uploader } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('alpha', makeFiles(1));
  queue.enqueue('beta', makeFiles(2));
  await flush();

  expect(queue.entriesFor('alpha')).toHaveLength(1);
  expect(queue.entriesFor('beta')).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web test -- upload-queue.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the queue**

Create `web/src/lib/upload/upload-queue.svelte.ts`:

```ts
import { xhrUpload, type UploadHandle } from '$lib/api/client';

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'done'
  | 'error'
  | 'canceled';

export interface UploadEntry {
  id: string;
  datasetName: string;
  filename: string;
  sent: number;
  total: number;
  status: UploadStatus;
  error?: string;
}

export type Uploader = (
  name: string,
  file: File,
  onProgress: (sent: number, total: number) => void
) => UploadHandle;

const DEFAULT_CONCURRENCY = 3;

const TERMINAL: UploadStatus[] = ['done', 'error', 'canceled'];

export class UploadQueue {
  entries = $state<UploadEntry[]>([]);

  #uploader: Uploader;
  #concurrency: number;
  #files = new Map<string, File>();
  #handles = new Map<string, UploadHandle>();
  #nextId = 0;

  constructor(uploader: Uploader = xhrUpload, concurrency = DEFAULT_CONCURRENCY) {
    this.#uploader = uploader;
    this.#concurrency = concurrency;
  }

  get active(): boolean {
    return this.entries.some((e) => e.status === 'queued' || e.status === 'uploading');
  }

  get totals() {
    let done = 0;
    let failed = 0;
    let sent = 0;
    let total = 0;
    for (const e of this.entries) {
      total += e.total;
      if (e.status === 'done' || e.status === 'processing') {
        done += e.status === 'done' ? 1 : 0;
        sent += e.total;
      } else if (e.status === 'error') {
        failed += 1;
      } else {
        sent += e.sent;
      }
    }
    return { files: this.entries.length, done, failed, sent, total };
  }

  entriesFor(datasetName: string): UploadEntry[] {
    return this.entries.filter((e) => e.datasetName === datasetName);
  }

  enqueue(datasetName: string, files: File[] | FileList): void {
    for (const file of Array.from(files)) {
      const id = `upload-${this.#nextId++}`;
      this.#files.set(id, file);
      this.entries.push({
        id,
        datasetName,
        filename: file.name,
        sent: 0,
        total: file.size,
        status: 'queued',
      });
    }
    this.#pump();
  }

  cancel(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return;

    if (entry.status === 'queued') {
      entry.status = 'canceled';
    } else if (entry.status === 'uploading') {
      this.#handles.get(id)?.abort();
    }
    this.#pump();
  }

  cancelAll(): void {
    for (const entry of [...this.entries]) {
      if (entry.status === 'queued' || entry.status === 'uploading') {
        this.cancel(entry.id);
      }
    }
  }

  retry(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry || entry.status !== 'error') return;
    entry.status = 'queued';
    entry.sent = 0;
    entry.error = undefined;
    this.#pump();
  }

  /** Called when a dataset.file.added event confirms server-side processing. */
  markProcessed(datasetName: string, filename: string): void {
    const entry = this.entries.find(
      (e) =>
        e.datasetName === datasetName &&
        e.filename === filename &&
        e.status === 'processing'
    );
    if (entry) entry.status = 'done';
  }

  clearFinished(): void {
    const removed = this.entries.filter((e) => TERMINAL.includes(e.status));
    for (const e of removed) {
      this.#files.delete(e.id);
      this.#handles.delete(e.id);
    }
    this.entries = this.entries.filter((e) => !TERMINAL.includes(e.status));
  }

  #pump(): void {
    let running = this.entries.filter((e) => e.status === 'uploading').length;
    for (const entry of this.entries) {
      if (running >= this.#concurrency) break;
      if (entry.status !== 'queued') continue;
      this.#start(entry);
      running += 1;
    }
  }

  #start(entry: UploadEntry): void {
    const file = this.#files.get(entry.id);
    if (!file) {
      entry.status = 'error';
      entry.error = 'File is no longer available';
      return;
    }

    entry.status = 'uploading';

    const handle = this.#uploader(entry.datasetName, file, (sent, total) => {
      entry.sent = sent;
      entry.total = total;
    });
    this.#handles.set(entry.id, handle);

    handle.promise
      .then(() => {
        entry.sent = entry.total;
        entry.status = 'processing';
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          entry.status = 'canceled';
        } else {
          entry.status = 'error';
          entry.error = err instanceof Error ? err.message : String(err);
        }
      })
      .finally(() => {
        this.#handles.delete(entry.id);
        this.#pump();
      });
  }
}

/** Module-level so uploads survive navigation away from the dataset page. */
export const uploadQueue = new UploadQueue();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix web test -- upload-queue.test.ts`
Expected: PASS.

If the runes (`$state`) do not work in a `.svelte.ts` file under the current Vitest config, check `web/vite.config.ts` for the Svelte plugin's file inclusion pattern — `.svelte.ts` files must be processed by the Svelte compiler. `web/src/lib/stores/theme.svelte.ts` is an existing working example to compare against.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/upload/
git commit -m "feat(web): add upload queue store with concurrency, cancel, and retry"
```

---

## Task 8: Frontend — media kind helpers

**Files:**
- Create: `web/src/lib/upload/media-kind.ts`
- Test: `web/src/lib/upload/media-kind.test.ts`

**Interfaces:**
- Produces:

```ts
export type MediaKind = 'image' | 'video' | 'text';

export const VIDEO_EXTENSIONS: string[];
export const IMAGE_EXTENSIONS: string[];
export const UPLOAD_ACCEPT: string;

export function isPlayableInBrowser(filename: string): boolean;
```

`UPLOAD_ACCEPT` is the `accept` attribute string for the file input, covering images, all supported videos, and caption files.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/upload/media-kind.test.ts`:

```ts
import { expect, test } from 'vitest';
import { isPlayableInBrowser, UPLOAD_ACCEPT } from './media-kind';

test('only browser-playable containers report as playable', () => {
  for (const name of ['clip.mp4', 'clip.webm', 'clip.m4v', 'clip.MOV']) {
    expect(isPlayableInBrowser(name)).toBe(true);
  }
  for (const name of ['clip.mkv', 'clip.avi', 'clip.wmv', 'clip.flv', 'clip.mpeg']) {
    expect(isPlayableInBrowser(name)).toBe(false);
  }
});

test('accept string covers images, videos, and captions', () => {
  expect(UPLOAD_ACCEPT).toContain('.mp4');
  expect(UPLOAD_ACCEPT).toContain('.mkv');
  expect(UPLOAD_ACCEPT).toContain('.png');
  expect(UPLOAD_ACCEPT).toContain('.txt');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web test -- media-kind.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `web/src/lib/upload/media-kind.ts`:

```ts
export type MediaKind = 'image' | 'video' | 'text';

/** Mirrors path_util.SUPPORTED_VIDEO_EXTENSIONS. */
export const VIDEO_EXTENSIONS = [
  '.webm', '.mkv', '.flv', '.avi', '.mov', '.wmv', '.mp4', '.mpeg', '.m4v',
];

/** Mirrors path_util.SUPPORTED_IMAGE_EXTENSIONS. */
export const IMAGE_EXTENSIONS = [
  '.bmp', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.avif',
];

const CAPTION_EXTENSIONS = ['.txt', '.caption'];

/**
 * Containers browsers can actually play. The others are valid for training
 * but have no native decoder, so we show a poster and a explanatory notice.
 */
const PLAYABLE_EXTENSIONS = ['.mp4', '.webm', '.m4v', '.mov'];

export const UPLOAD_ACCEPT = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...CAPTION_EXTENSIONS,
].join(',');

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

export function isPlayableInBrowser(filename: string): boolean {
  return PLAYABLE_EXTENSIONS.includes(extensionOf(filename));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix web test -- media-kind.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/upload/media-kind.ts web/src/lib/upload/media-kind.test.ts
git commit -m "feat(web): add media kind and browser playability helpers"
```

---

## Task 9: Frontend — wire `dataset.file.added` through the event client

**Files:**
- Modify: `web/src/lib/events/client.ts:13-44` (types and options), `:185-215` (event dispatch)
- Modify: `web/src/lib/components/LayoutContent.svelte:156-175`
- Test: `web/src/lib/events/client.test.ts`

**Interfaces:**
- Consumes: `uploadQueue.markProcessed` from Task 7, `queryKeys.datasets()` and `queryKeys.datasetFiles(name)` from `web/src/lib/api/queries.ts:32`
- Produces:

```ts
export interface DatasetFileAddedEvent {
  dataset: string;
  filename: string;
  item_id: string;
  kind: 'image' | 'video' | 'text';
}
```

and a new `onDatasetFileAdded?: (event: DatasetFileAddedEvent) => void` option on `EventClientOptions`.

- [ ] **Step 1: Write the failing test**

Append to `web/src/lib/events/client.test.ts`, following the existing fake-socket pattern in that file:

```ts
test('dataset.file.added is routed to onDatasetFileAdded', async () => {
  const received: any[] = [];
  const { client, socket } = makeClient({
    onDatasetFileAdded: (event) => received.push(event),
  });

  client.start();
  socket.onopen?.();
  await flushBacklog();

  socket.onmessage?.({
    data: JSON.stringify({
      type: 'dataset.file.added',
      dataset: 'ds',
      filename: 'a.png',
      item_id: 'a',
      kind: 'image',
      seq: 1,
    }),
  });

  expect(received).toEqual([
    { dataset: 'ds', filename: 'a.png', item_id: 'a', kind: 'image' },
  ]);
  client.stop();
});
```

Reuse whatever helper the existing tests in this file use to construct an `EventClient` with a fake socket and to settle the backlog fetch. If no such helper exists, build the client directly with `createSocket` and `getBacklog` stubs matching the other tests in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web test -- events/client.test.ts`
Expected: FAIL — `received` is empty; the event type is not handled.

- [ ] **Step 3: Add the type and option**

In `web/src/lib/events/client.ts`, beside `GalleryWarningEvent`:

```ts
export interface DatasetFileAddedEvent {
  dataset: string;
  filename: string;
  item_id: string;
  kind: 'image' | 'video' | 'text';
}
```

Add to `EventClientOptions`:

```ts
  onDatasetFileAdded?: (event: DatasetFileAddedEvent) => void;
```

Add the private field and constructor assignment alongside `onGalleryWarning`:

```ts
  private onDatasetFileAdded?: (event: DatasetFileAddedEvent) => void;
```
```ts
    this.onDatasetFileAdded = options.onDatasetFileAdded;
```

- [ ] **Step 4: Dispatch the event**

In the event-handling method (beside the existing `if (event.type === 'gallery_warning')` branch around `client.ts:202`):

```ts
    if (event.type === 'dataset.file.added') {
      this.onDatasetFileAdded?.({
        dataset: event.dataset,
        filename: event.filename,
        item_id: event.item_id,
        kind: event.kind,
      });
      return;
    }
```

- [ ] **Step 5: Wire the handler in `LayoutContent.svelte`**

Add the import:

```ts
  import { uploadQueue } from '$lib/upload/upload-queue.svelte';
```

Add to the `new EventClient({ ... })` options object, after `onGalleryWarning`:

```ts
      onDatasetFileAdded: (event) => {
        uploadQueue.markProcessed(event.dataset, event.filename);
        queryClient.invalidateQueries({ queryKey: ['datasets'] });
        queryClient.invalidateQueries({
          queryKey: ['datasets', event.dataset, 'files'],
        });
      },
```

The literal key arrays match `queryKeys.datasets()` and `queryKeys.datasetFiles(name)` from `web/src/lib/api/queries.ts:32`; use the `queryKeys` helper instead if it is already imported in this file.

- [ ] **Step 6: Run the frontend test suite**

Run: `npm --prefix web test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/events/client.ts web/src/lib/events/client.test.ts web/src/lib/components/LayoutContent.svelte
git commit -m "feat(web): route dataset.file.added events to the upload queue"
```

---

## Task 10: Frontend — upload progress UI on the dataset page

**Files:**
- Create: `web/src/lib/components/datasets/UploadSkeletonCard.svelte`
- Create: `web/src/lib/components/datasets/UploadSummaryBar.svelte`
- Modify: `web/src/routes/(app)/datasets/[id]/+page.svelte`
- Modify: `web/src/lib/api/queries.ts:311-322` (delete `createUploadDatasetFilesMutation`)
- Modify: `web/src/lib/api/client.ts:251-259` (delete `uploadDatasetFiles`)
- Test: `web/src/routes/(app)/datasets/[id]/DatasetDetailPage.test.ts`

**Interfaces:**
- Consumes: `uploadQueue` and `UploadEntry` from Task 7, `UPLOAD_ACCEPT` from Task 8
- Produces: `UploadSkeletonCard` props `{ entry: UploadEntry, onCancel: (id: string) => void, onRetry: (id: string) => void }`; `UploadSummaryBar` props `{ totals: UploadQueue['totals'], onCancelAll: () => void }`

**Why delete the mutation:** a TanStack Query mutation models a single request with a single lifecycle. The queue owns concurrency, per-file progress, cancel, and retry, so the mutation wrapper has nothing left to do and would give a misleading second source of truth.

- [ ] **Step 1: Write the failing tests**

Append to `web/src/routes/(app)/datasets/[id]/DatasetDetailPage.test.ts`:

```ts
import { uploadQueue } from '$lib/upload/upload-queue.svelte';

test('dropping files renders a skeleton card and the summary bar', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({ data: { name: 'ds', path: '/ds', items: [] }, isLoading: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: vi.fn() }) as any
  );

  const enqueue = vi.spyOn(uploadQueue, 'enqueue');
  const { container } = render(DatasetDetailPage, { props: { data: { id: 'ds' } } });

  const region = container.querySelector('[aria-label="Dataset Detail"]')!;
  const file = new File([new Uint8Array(100)], 'a.png', { type: 'image/png' });
  await fireEvent.drop(region, { dataTransfer: { files: [file] } });

  expect(enqueue).toHaveBeenCalledWith('ds', expect.anything());

  enqueue.mockRestore();
  uploadQueue.clearFinished();
});

test('an uploading entry shows a progress card with a cancel control', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({ data: { name: 'ds2', path: '/ds2', items: [] }, isLoading: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: vi.fn() }) as any
  );

  vi.spyOn(uploadQueue, 'entriesFor').mockReturnValue([
    {
      id: 'upload-0',
      datasetName: 'ds2',
      filename: 'big.mp4',
      sent: 50,
      total: 200,
      status: 'uploading',
    },
  ]);

  render(DatasetDetailPage, { props: { data: { id: 'ds2' } } });

  expect(await screen.findByText('big.mp4')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  expect(screen.getByRole('button', { name: /cancel upload/i })).toBeTruthy();

  vi.mocked(uploadQueue.entriesFor).mockRestore();
});

test('a failed entry offers retry and shows the server error', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({ data: { name: 'ds3', path: '/ds3', items: [] }, isLoading: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: vi.fn() }) as any
  );

  vi.spyOn(uploadQueue, 'entriesFor').mockReturnValue([
    {
      id: 'upload-1',
      datasetName: 'ds3',
      filename: 'evil.exe',
      sent: 0,
      total: 10,
      status: 'error',
      error: 'Unsupported file type: evil.exe',
    },
  ]);

  render(DatasetDetailPage, { props: { data: { id: 'ds3' } } });

  expect(await screen.findByText(/Unsupported file type/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();

  vi.mocked(uploadQueue.entriesFor).mockRestore();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web test -- DatasetDetailPage.test.ts`
Expected: FAIL — the page still calls the upload mutation and renders no skeleton cards.

- [ ] **Step 3: Create `UploadSkeletonCard.svelte`**

Create `web/src/lib/components/datasets/UploadSkeletonCard.svelte`:

```svelte
<script lang="ts">
  import { X, RotateCw, AlertCircle } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { UploadEntry } from '$lib/upload/upload-queue.svelte';

  let {
    entry,
    onCancel = () => {},
    onRetry = () => {},
  }: {
    entry: UploadEntry;
    onCancel?: (id: string) => void;
    onRetry?: (id: string) => void;
  } = $props();

  let percent = $derived(
    entry.total > 0 ? Math.round((entry.sent / entry.total) * 100) : 0
  );
  let inFlight = $derived(entry.status === 'queued' || entry.status === 'uploading');

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
</script>

<Card.Root class="overflow-hidden flex flex-col p-0 bg-card border border-border rounded-lg">
  <div class="w-full aspect-square bg-slate-950 flex flex-col items-center justify-center gap-3 p-4">
    {#if entry.status === 'error'}
      <AlertCircle size={32} class="text-destructive" />
      <span class="text-xs text-destructive text-center break-words">{entry.error}</span>
      <Button variant="outline" size="sm" class="gap-1.5" onclick={() => onRetry(entry.id)}>
        <RotateCw size={14} />
        Retry
      </Button>
    {:else if entry.status === 'processing'}
      <div class="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      <span class="text-xs text-muted-foreground">Processing…</span>
    {:else}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress for {entry.filename}"
        class="w-full h-2 rounded-full bg-muted overflow-hidden"
      >
        <div class="h-full bg-primary transition-[width] duration-200" style="width: {percent}%"></div>
      </div>
      <span class="text-xs text-muted-foreground">
        {formatBytes(entry.sent)} / {formatBytes(entry.total)}
      </span>
      {#if inFlight}
        <Button
          variant="ghost"
          size="sm"
          class="gap-1.5"
          aria-label="Cancel upload of {entry.filename}"
          onclick={() => onCancel(entry.id)}
        >
          <X size={14} />
          Cancel
        </Button>
      {/if}
    {/if}
  </div>
  <Card.Content class="p-3">
    <span class="text-xs font-semibold text-muted-foreground break-all">{entry.filename}</span>
  </Card.Content>
</Card.Root>
```

- [ ] **Step 4: Create `UploadSummaryBar.svelte`**

Create `web/src/lib/components/datasets/UploadSummaryBar.svelte`:

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  let {
    totals,
    onCancelAll = () => {},
  }: {
    totals: { files: number; done: number; failed: number; sent: number; total: number };
    onCancelAll?: () => void;
  } = $props();

  let percent = $derived(
    totals.total > 0 ? Math.round((totals.sent / totals.total) * 100) : 0
  );

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
</script>

<div
  class="sticky top-0 z-20 flex items-center gap-4 rounded-md border border-border bg-card/95 px-4 py-3 backdrop-blur"
  aria-live="polite"
>
  <div class="flex flex-col gap-1.5 flex-1 min-w-0">
    <span class="text-sm text-foreground">
      Uploading {totals.done} of {totals.files} · {formatBytes(totals.sent)} / {formatBytes(totals.total)}
      {#if totals.failed > 0}
        · <span class="text-destructive">{totals.failed} failed</span>
      {/if}
    </span>
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Overall upload progress"
      class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div class="h-full bg-primary transition-[width] duration-200" style="width: {percent}%"></div>
    </div>
  </div>
  <Button variant="ghost" size="sm" onclick={onCancelAll}>Cancel All</Button>
</div>
```

- [ ] **Step 5: Rewrite the dataset page script**

In `web/src/routes/(app)/datasets/[id]/+page.svelte`, replace the imports and `handleFileUpload` with:

```svelte
<script lang="ts">
  import { ArrowLeft, Upload, Image as ImageIcon, X } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { FileInput } from '$lib/components/ui/file-input/index.js';
  import * as Empty from '$lib/components/ui/empty/index.js';
  import DatasetFileCard from '$lib/components/datasets/DatasetFileCard.svelte';
  import UploadSkeletonCard from '$lib/components/datasets/UploadSkeletonCard.svelte';
  import UploadSummaryBar from '$lib/components/datasets/UploadSummaryBar.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import { uploadQueue } from '$lib/upload/upload-queue.svelte';
  import { UPLOAD_ACCEPT } from '$lib/upload/media-kind';
  import {
    createDatasetFilesQuery,
    createUpdateCaptionMutation,
  } from '$lib/api/queries';

  let { data } = $props<{ data: { id: string } }>();
  let datasetName = $derived(data.id);

  // svelte-ignore state_referenced_locally
  const filesQuery = createDatasetFilesQuery(data.id);
  const captionMutation = createUpdateCaptionMutation();

  let items = $derived($filesQuery.data?.items || []);
  let loading = $derived($filesQuery.isLoading);
  let fileInput = $state<{ open: () => void } | null>(null);
  let isDragging = $state(false);
  let activeLightboxItem = $state<{ url: string; kind: string; filename: string } | null>(null);

  let pendingUploads = $derived(
    uploadQueue.entriesFor(datasetName).filter((e) => e.status !== 'done')
  );
  let totals = $derived(uploadQueue.totals);

  function handleFileUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    uploadQueue.enqueue(datasetName, files);
  }

  async function handleCaptionSave(captionName: string, content: string) {
    if (!captionName) return;
    try {
      await $captionMutation.mutateAsync({
        name: datasetName,
        caption_name: captionName,
        content,
      });
    } catch (err) {
      console.error('Failed to save caption', err);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer?.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  }
</script>
```

- [ ] **Step 6: Render the summary bar and skeleton cards**

In the same file, insert the summary bar directly after the header block (after the closing `</div>` of the flex row containing the title and Add Files button):

```svelte
    {#if pendingUploads.length > 0}
      <UploadSummaryBar {totals} onCancelAll={() => uploadQueue.cancelAll()} />
    {/if}
```

Replace the grid block so skeletons render alongside real items, and the empty state only shows when there is nothing at all:

```svelte
    {#if items.length === 0 && pendingUploads.length === 0 && !loading}
      <Empty.Root class="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Empty.Media>
          <ImageIcon size={48} />
        </Empty.Media>
        <Empty.Header>
          <Empty.Title class="text-lg font-semibold text-foreground">No images, videos, or captions in this dataset yet</Empty.Title>
          <Empty.Description class="text-sm">Click "Add Files" or drag & drop files anywhere onto this page</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {#each pendingUploads as entry (entry.id)}
          <UploadSkeletonCard
            {entry}
            onCancel={(id) => uploadQueue.cancel(id)}
            onRetry={(id) => uploadQueue.retry(id)}
          />
        {/each}
        {#each items as item (item.id)}
          <DatasetFileCard
            {item}
            {datasetName}
            onCaptionSave={handleCaptionSave}
            onMediaClick={(payload) => (activeLightboxItem = payload)}
          />
        {/each}
      </div>
    {/if}
```

Change the `FileInput` `accept` attribute to `accept={UPLOAD_ACCEPT}`.

The `onMediaClick` prop and the lightbox markup are completed in Task 11; until then the page compiles because `DatasetFileCard` still ignores the unknown prop. Run the page tests at the end of Task 11 if the lightbox assertions fail here.

- [ ] **Step 7: Delete the dead upload API surface**

Remove `createUploadDatasetFilesMutation` from `web/src/lib/api/queries.ts:311-322` and `uploadDatasetFiles` from `web/src/lib/api/client.ts:251-259`.

Run `grep -rn "uploadDatasetFiles\|createUploadDatasetFilesMutation" web/src web/e2e` and remove any remaining references, including mocks in existing tests.

- [ ] **Step 8: Run the frontend test suite and type check**

Run: `npm --prefix web test`
Run: `npm --prefix web run check`
Expected: PASS. `svelte-check` may report the lightbox item type until Task 11; fix any error that is not about `activeLightboxItem`.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/components/datasets/ web/src/routes/ web/src/lib/api/queries.ts web/src/lib/api/client.ts
git commit -m "feat(web): show per-file upload progress with cancel and retry"
```

---

## Task 11: Frontend — video cards and lightbox playback

**Files:**
- Modify: `web/src/lib/components/datasets/DatasetFileCard.svelte`
- Modify: `web/src/routes/(app)/datasets/[id]/+page.svelte` (lightbox)
- Modify: `modules/webui/routers/datasets.py` (remove the `image_name` alias added in Task 1)
- Test: `web/src/lib/components/datasets/DatasetFileCard.test.ts` (create if absent)
- Test: `modules/webui/tests/test_datasets_router.py`

**Interfaces:**
- Consumes: `kind` and `media_name` from Task 1, `isPlayableInBrowser` from Task 8
- Produces: `DatasetFileCard` prop `onMediaClick?: (payload: { url: string; kind: MediaKind; filename: string }) => void`, replacing `onImageClick`. The `DatasetFileItem` interface becomes:

```ts
interface DatasetFileItem {
  id: string;
  kind: 'image' | 'video' | 'text';
  media_name?: string | null;
  caption_name?: string | null;
  caption_content?: string;
}
```

- [ ] **Step 1: Write the failing frontend tests**

Create `web/src/lib/components/datasets/DatasetFileCard.test.ts`:

```ts
import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import DatasetFileCard from './DatasetFileCard.svelte';

test('a video item renders a poster and a play badge', () => {
  render(DatasetFileCard, {
    props: {
      item: { id: 'clip', kind: 'video', media_name: 'clip.mp4', caption_content: '' },
      datasetName: 'ds',
    },
  });

  const poster = screen.getByAltText('clip') as HTMLImageElement;
  expect(poster.src).toContain('/api/datasets/image');
  expect(poster.src).toContain('filename=clip.mp4');
  expect(poster.src).toContain('thumb=true');
  expect(screen.getByLabelText(/play/i)).toBeTruthy();
});

test('clicking a video reports the streaming url and kind', async () => {
  const onMediaClick = vi.fn();
  render(DatasetFileCard, {
    props: {
      item: { id: 'clip', kind: 'video', media_name: 'clip.mp4', caption_content: '' },
      datasetName: 'ds',
      onMediaClick,
    },
  });

  await fireEvent.click(screen.getByAltText('clip'));

  expect(onMediaClick).toHaveBeenCalledWith({
    url: '/api/datasets/video?dataset=ds&filename=clip.mp4',
    kind: 'video',
    filename: 'clip.mp4',
  });
});

test('clicking an image reports the image url', async () => {
  const onMediaClick = vi.fn();
  render(DatasetFileCard, {
    props: {
      item: { id: 'a', kind: 'image', media_name: 'a.png', caption_content: '' },
      datasetName: 'ds',
      onMediaClick,
    },
  });

  await fireEvent.click(screen.getByAltText('a'));

  expect(onMediaClick).toHaveBeenCalledWith({
    url: '/api/datasets/image?dataset=ds&filename=a.png',
    kind: 'image',
    filename: 'a.png',
  });
});

test('a text-only item shows the text placeholder and is not clickable', () => {
  const onMediaClick = vi.fn();
  render(DatasetFileCard, {
    props: {
      item: { id: 'c', kind: 'text', media_name: null, caption_content: 'hi' },
      datasetName: 'ds',
      onMediaClick,
    },
  });

  expect(screen.getByText('Text Only')).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web test -- DatasetFileCard.test.ts`
Expected: FAIL — the card reads `item.image_name` and calls `onImageClick`.

- [ ] **Step 3: Rewrite `DatasetFileCard.svelte`**

Replace the script block and the media button in `web/src/lib/components/datasets/DatasetFileCard.svelte`:

```svelte
<script lang="ts">
  import { FileText, Play } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea as TextArea } from '$lib/components/ui/textarea/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { MediaKind } from '$lib/upload/media-kind';

  interface DatasetFileItem {
    id: string;
    kind: MediaKind;
    media_name?: string | null;
    caption_name?: string | null;
    caption_content?: string;
  }

  let {
    item,
    datasetName,
    onCaptionSave = () => {},
    onMediaClick = () => {},
  }: {
    item: DatasetFileItem;
    datasetName: string;
    onCaptionSave?: (captionName: string, content: string) => void;
    onMediaClick?: (payload: { url: string; kind: MediaKind; filename: string }) => void;
  } = $props();

  let hasMedia = $derived(Boolean(item.media_name));

  let posterUrl = $derived(
    item.media_name
      ? `/api/datasets/image?dataset=${encodeURIComponent(datasetName)}&filename=${encodeURIComponent(item.media_name)}&thumb=true`
      : ''
  );

  function handleMediaClick() {
    if (!item.media_name) return;
    const params = `dataset=${encodeURIComponent(datasetName)}&filename=${encodeURIComponent(item.media_name)}`;
    const url =
      item.kind === 'video'
        ? `/api/datasets/video?${params}`
        : `/api/datasets/image?${params}`;
    onMediaClick({ url, kind: item.kind, filename: item.media_name });
  }

  function handleBlur(content: string) {
    const targetCaptionName = item.caption_name || `${item.id}.txt`;
    onCaptionSave(targetCaptionName, content);
  }
</script>

<Card.Root class="overflow-hidden flex flex-col p-0 bg-card border border-border rounded-lg">
  <Button
    variant="ghost"
    class="w-full aspect-square bg-slate-950 p-0 rounded-none h-auto text-left disabled:cursor-default relative"
    disabled={!hasMedia}
    onclick={handleMediaClick}
  >
    {#if hasMedia}
      <img src={posterUrl} alt={item.id} class="w-full h-full object-cover" />
      {#if item.kind === 'video'}
        <span
          aria-label="Play video"
          class="absolute inset-0 flex items-center justify-center bg-black/25"
        >
          <span class="flex size-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play size={24} />
          </span>
        </span>
      {/if}
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <FileText size={32} />
        <span>Text Only</span>
      </div>
    {/if}
  </Button>
  <Card.Content class="p-3 flex flex-col gap-2">
    <span class="text-xs font-semibold text-muted-foreground">{item.id}</span>
    <TextArea
      class="w-full min-h-[60px] bg-muted border border-border rounded text-xs p-2 text-foreground resize-y"
      placeholder="Add caption..."
      value={item.caption_content}
      onBlur={handleBlur}
    />
  </Card.Content>
</Card.Root>
```

- [ ] **Step 4: Update the lightbox**

Replace the lightbox block at the bottom of `web/src/routes/(app)/datasets/[id]/+page.svelte`:

```svelte
{#if activeLightboxItem}
  <div
    class="fixed inset-0 bg-black/85 z-[1000] flex items-center justify-center"
    onclick={() => (activeLightboxItem = null)}
    role="presentation"
  >
    {#if activeLightboxItem.kind === 'video'}
      {#if isPlayableInBrowser(activeLightboxItem.filename)}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <video
          src={activeLightboxItem.url}
          controls
          autoplay
          class="max-w-[90vw] max-h-[90dvh] rounded-lg"
          onclick={(e) => e.stopPropagation()}
        >
          <track kind="captions" />
        </video>
      {:else}
        <div class="flex max-w-md flex-col items-center gap-3 rounded-lg bg-card p-8 text-center">
          <span class="text-lg font-semibold text-foreground">{activeLightboxItem.filename}</span>
          <span class="text-sm text-muted-foreground">
            Preview not available in browser — this format is supported for training.
          </span>
        </div>
      {/if}
    {:else}
      <img
        src={activeLightboxItem.url}
        alt={activeLightboxItem.filename}
        class="max-w-[90vw] max-h-[90dvh] object-contain rounded-lg"
      />
    {/if}
    <Button
      variant="ghost"
      size="icon"
      class="absolute top-4 right-4 bg-transparent border-none text-white cursor-pointer w-auto h-auto"
      onclick={() => (activeLightboxItem = null)}
    >
      <X size={24} />
    </Button>
  </div>
{/if}
```

Add to the page's imports:

```ts
  import { UPLOAD_ACCEPT, isPlayableInBrowser } from '$lib/upload/media-kind';
```

replacing the `UPLOAD_ACCEPT`-only import added in Task 10.

- [ ] **Step 5: Remove the `image_name` alias from the backend**

In `modules/webui/routers/datasets.py::get_dataset_files`, delete the two alias lines:

```python
            # Deprecated alias, removed in Task 10.
            "image_name": None,
```
and
```python
            if kind == "image":
                item["image_name"] = p.name
```

Delete `test_dataset_files_keeps_image_name_alias` from `modules/webui/tests/test_datasets_router.py`.

- [ ] **Step 6: Update any remaining `image_name` consumers**

Run: `grep -rn "image_name" web/src modules/webui`
Expected: no matches outside of unrelated modules. Update `DatasetDetailPage.test.ts` fixtures and `DatasetCollection.svelte` if either still reads `image_name`.

- [ ] **Step 7: Run the full suites**

Run: `pytest modules/webui/tests/test_datasets_router.py modules/webui/tests/test_media_service.py -v`
Run: `npm --prefix web test`
Run: `npm --prefix web run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src modules/webui
git commit -m "feat: render dataset videos with poster frames and lightbox playback"
```

---

## Task 12: End-to-end upload progress test

**Files:**
- Create: `web/e2e/dataset-upload.spec.ts`

**Interfaces:**
- Consumes: the running dev server configured in `web/playwright.config.ts`; the route-interception style used by the existing specs in `web/e2e/`

**Why route interception:** a real upload completes too fast on localhost to observe intermediate progress. Delaying the upload response makes the progress state deterministic instead of racy.

- [ ] **Step 1: Write the test**

Create `web/e2e/dataset-upload.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('dropping a file shows progress, then the file appears', async ({ page }) => {
  await page.route('**/api/datasets/*/files', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'E2E', path: '/E2E', items: [] }),
    });
  });

  // Hold the upload open so the progress UI is observable.
  let releaseUpload: () => void = () => {};
  const uploadHeld = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });

  await page.route('**/api/datasets/*/upload', async (route) => {
    await uploadHeld;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ saved: ['e2e.png'] }),
    });
  });

  await page.goto('/datasets/E2E');

  await page.setInputFiles('input[type="file"]', {
    name: 'e2e.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(64 * 1024),
  });

  await expect(page.getByText('e2e.png')).toBeVisible();
  await expect(page.getByLabel('Overall upload progress')).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel upload/i })).toBeVisible();

  releaseUpload();

  await expect(page.getByText('Processing…')).toBeVisible();
});
```

If the file input is hidden behind the `class="hidden"` attribute, `setInputFiles` still works — Playwright sets files on hidden inputs directly. If the selector matches more than one input, scope it with `page.locator('input[type="file"]').first()`.

- [ ] **Step 2: Run the test**

Run: `npm --prefix web run e2e -- dataset-upload.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/dataset-upload.spec.ts
git commit -m "test(web): add e2e coverage for dataset upload progress"
```

---

## Task 13: Documentation

**Files:**
- Modify: `docs/WebUi.md`
- Modify: `modules/webui/README.md`

**Interfaces:**
- Consumes: everything built in Tasks 1-12

- [ ] **Step 1: Document the user-facing behavior**

In `docs/WebUi.md`, in the datasets section, add:

- Files upload one at a time with a visible per-file progress bar, three at once.
- Individual files can be canceled while uploading and retried after a failure; one failed file no longer discards the batch.
- Uploads continue in the background when you navigate to another page.
- Datasets accept video: `.webm .mkv .flv .avi .mov .wmv .mp4 .mpeg .m4v`. Videos show an extracted poster frame in the grid and play in the lightbox. `.mkv`, `.avi`, `.wmv`, `.flv`, and `.mpeg` are supported for training but cannot be previewed in a browser, so the lightbox shows a notice instead of a player.

- [ ] **Step 2: Document the API surface**

In `modules/webui/README.md`, in the endpoint list, add:

- `GET /api/datasets/video?dataset=&filename=` — Range-capable video streaming.
- `POST /api/datasets/{name}/upload` — now streams to disk and returns 415 for unsupported extensions. Publishes `dataset.file.added { dataset, filename, item_id, kind }` per saved file.
- `GET /api/datasets/{name}/files` — items now carry `kind` (`image`/`video`/`text`) and `media_name`. The former `image_name` field is removed.
- `GET /api/datasets` — dataset entries now carry `video_count`.

- [ ] **Step 3: Verify nothing else documents the old shape**

Run: `grep -rn "image_name" docs/ modules/webui/README.md`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/WebUi.md modules/webui/README.md
git commit -m "docs: document dataset upload progress and video support"
```

---

## Final Verification

- [ ] Run the full backend webui suite: `pytest modules/webui/tests/ -v`
- [ ] Run the full frontend suite: `npm --prefix web test`
- [ ] Run the type check: `npm --prefix web run check`
- [ ] Run the e2e suite: `npm --prefix web run e2e`
- [ ] Manually verify with a real multi-gigabyte video: progress advances smoothly, cancel stops the transfer, the poster frame appears, and playback works for `.mp4` while `.mkv` shows the notice.
