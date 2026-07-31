# Dataset Upload UX and Video Support

Date: 2026-07-31
Status: Approved, not yet implemented

## Problem

Uploading files to a dataset gives the user no feedback. Selecting or dropping
files starts a single opaque request; nothing changes on screen until, some time
later, the grid repopulates all at once.

The current implementation (`web/src/routes/(app)/datasets/[id]/+page.svelte`,
`handleFileUpload`) bundles every selected file into one `FormData` and sends it
with a single `fetch`. That causes four distinct problems:

1. **Progress is structurally impossible.** `fetch` does not expose upload
   progress in any shipping browser. Streaming request bodies are Chrome-only and
   require HTTP/2, so there is no byte count to render.
2. **The batch is all-or-nothing.** Three hundred images are one request. A
   single failure discards the whole batch, and nothing appears in the grid until
   the final byte lands.
3. **The server buffers whole files in memory.** `modules/webui/routers/datasets.py`
   does `content = await f.read()` followed by `write_bytes`. A multi-gigabyte
   upload is a multi-gigabyte allocation.
4. **Unsupported files vanish silently.** The upload loop `continue`s past files
   it will not accept, and the response never mentions them.

Dataset uploads must also accept video, which OneTrainer already supports for
training.

## Rejected approach: uploading bytes over the WebSocket

The WebSocket connection at `/api/events` is the wrong transport for file bytes,
despite the intuition that it would be faster.

- It is not faster. A WebSocket is one TCP connection; several concurrent HTTP
  requests beat one serialized stream.
- It discards what HTTP provides free: parallelism, range semantics, proxy and
  cache behavior. Chunking, framing, ordering, and backpressure would all have to
  be hand-rolled.
- The idiomatic browser API for upload progress is `XMLHttpRequest`, via
  `xhr.upload.onprogress`. Every major upload library still relies on it.

The WebSocket is the right channel for the *server-side* half of the work —
caption creation and poster extraction, which happen after the HTTP response and
have no response to ride on.

## Scope decisions

- **One request per file; retry the whole file on failure.** No chunking, no
  resumable sessions. A failed multi-gigabyte upload restarts from zero, mitigated
  by a per-file Retry control. Deployments are predominantly localhost or LAN.
- **Video preview is poster frame plus lightbox playback.** No inline `<video>`
  elements in grid cards; a grid of large videos would issue many concurrent range
  requests and decode heavily.
- **No transcoding.** Formats browsers cannot play are surfaced honestly rather
  than converted.

---

## Part 1: Upload

### Transport

`web/src/lib/api/client.ts` gains an `xhrUpload(url, file)` helper returning
`{ promise, abort }`, wiring `xhr.upload.onprogress` to a byte counter. The
existing fetch-based `uploadDatasetFiles` method is removed along with its
`createUploadDatasetFilesMutation` wrapper; the queue store calls `xhrUpload`
directly, because TanStack Query mutations model one request, not a managed
multi-file queue.

Concurrency is capped at 3 simultaneous uploads.

### Client state

A new module-level rune store at `web/src/lib/upload/upload-queue.svelte.ts`
holds one entry per file:

```ts
{
  id: string
  file: File
  datasetName: string
  sent: number
  total: number
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled'
  error?: string
}
```

The store is module-level rather than component-level so uploads survive
navigation away from the dataset page.

Status transitions: `queued → uploading → processing → done`. An entry enters
`processing` when its HTTP response returns and leaves it when the matching
`dataset.file.added` event arrives. `error` and `canceled` are terminal until the
user retries.

### Server

`POST /api/datasets/{name}/upload` changes in four ways:

- **Streaming write.** `await f.read()` is replaced by a chunked
  `shutil.copyfileobj` from `f.file` into `{filename}.part`, followed by
  `os.replace` to the final name. FastAPI's `UploadFile` already spools to a temp
  file past 1 MB, so memory stays bounded. The `.part` rename is atomic, so the
  file listing never observes a partially written file.
- **`.part` cleanup.** A failed or aborted upload removes its `.part` file in a
  `finally` block.
- **Extension validation.** Files whose extension is not a supported image,
  supported video, or `.txt`/`.caption` produce HTTP 415 with the offending
  filename, instead of being silently skipped.
- **Event publication.** On success the server publishes
  `dataset.file.added { dataset, filename, item_id, kind }` on the existing
  `EventHub` (`modules/webui/events.py`).

The endpoint continues to accept `list[UploadFile]` so existing callers and tests
keep working, but the client sends one file per request.

### Client-side event handling

The dataset page subscribes to `dataset.file.added` and patches the
`getDatasetFiles` query cache for the named dataset, marking the corresponding
queue entry `done`. A second browser tab viewing the same dataset therefore
updates live.

### UI

Progress appears where the file will ultimately live, not in a floating overlay.

- **Skeleton cards.** Each queued file immediately renders a card in the grid
  with a progress ring and its filename, so files appear the instant they are
  dropped. The card is replaced by the real card when the file is `done`.
- **Sticky summary bar** in the page header:
  `Uploading 3 of 12 · 240 MB / 1.4 GB · 2 failed`, with a Cancel All control.
  Hidden when the queue is empty.
- **Per-card controls.** Cancel while uploading; Retry after failure. Failures are
  per-file, so one rejected video does not lose the other eleven.
- The existing drag-and-drop overlay is retained. The page is no longer blocked
  during upload.

### Testing

- Unit tests for the queue store against a fake uploader: concurrency cap holds at
  3, cancel aborts only the targeted entry, retry re-enqueues, aggregate byte
  accounting is correct across mixed statuses.
- Backend tests: a large upload does not materialize in memory; `.part` files are
  removed when an upload fails mid-write; unsupported extensions return 415;
  `dataset.file.added` is published on success.
- A Playwright test asserting skeleton cards and the summary bar appear on drop.

---

## Part 2: Video

Supported extensions come from `modules/util/path_util.py`:
`.webm .mkv .flv .avi .mov .wmv .mp4 .mpeg .m4v`.

### Recognition

`datasets.py` hardcodes an image-versus-`.txt` distinction in three places: the
per-dataset counts in `list_datasets`, the item map in `get_dataset_files`, and
the caption auto-creation in `upload_dataset_files`. All three gain a
`path_util.is_supported_video_extension` branch beside the existing image check.

`list_datasets` returns a `video_count` alongside `image_count`.

`get_dataset_files` items gain `kind: 'image' | 'video' | 'text'`, and the
`image_name` field is renamed `media_name`, so the card does not infer type from
the extension. This is a breaking response change; `DatasetFileCard.svelte`,
`DatasetCollection.svelte`, and their tests are updated together.

Videos receive the same auto-created blank `.txt` sibling that images do,
matching OneTrainer's existing caption convention.

### Poster frames

`MediaService` (`modules/webui/media.py`) gains `get_video_poster_file()` using
PyAV (`av==16.1.0`, already in `requirements-global.txt` — no new dependency).

It seeks to roughly 10% of duration, avoiding the black or title frames common at
position zero, decodes a single frame, and writes a JPEG into the existing
thumbnail cache using the same key derivation as image thumbnails (path, mtime,
size). Decode failure falls back to the existing placeholder rather than raising.

Extraction runs at upload completion, before `dataset.file.added` is published, so
the skeleton card flips directly to a poster. Posters for pre-existing files are
extracted lazily on first request and cached.

### Streaming endpoint

New `GET /api/datasets/video?dataset=&filename=` returns a Starlette
`FileResponse`, which handles HTTP Range requests natively — required for seeking,
and it prevents the browser from pulling a whole large file in one shot. It
applies the same `..` path validation as the existing image endpoint.

Poster frames are served through the existing `/api/datasets/image` endpoint,
which routes to the cache.

### Cards and lightbox

`DatasetFileCard` renders the poster with a play badge and a duration overlay for
`kind === 'video'`. The caption textarea is unchanged.

The lightbox in `web/src/routes/(app)/datasets/[id]/+page.svelte` branches on
kind: `<img>` for images, `<video controls autoplay>` for playable video.

The file input `accept` attribute is extended with the video extensions.

### Browser playback limitation

OneTrainer trains on `.mkv`, `.avi`, `.wmv`, `.flv`, and `.mpeg`, but browsers
cannot play those containers. Poster extraction works for all of them, since PyAV
decodes server-side, so the grid renders correctly.

For non-playable containers the lightbox shows "Preview not available in browser —
this format is supported for training" rather than a dead player. The playable set
is `.mp4`, `.webm`, `.m4v`, and `.mov`; the check is a static extension allowlist.

Transcoding for preview is out of scope. It would require a background ffmpeg job
queue and cache for something the user only needs to eyeball.

### Testing

- Backend: video listing and counting; poster extraction against a small
  generated clip; poster cache hits avoid re-decoding; Range requests return 206
  with correct bounds; path traversal is rejected.
- Component: the video card renders poster, play badge, and duration; the lightbox
  branches correctly per kind; non-playable formats show the fallback message.

## Out of scope

- Chunked or resumable uploads.
- Transcoding video for browser preview.
- Inline video playback in grid cards.
- Folder or archive upload.
