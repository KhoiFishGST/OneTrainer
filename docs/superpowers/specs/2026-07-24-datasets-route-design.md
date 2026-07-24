# Design Spec: Datasets Management Route

**Date**: 2026-07-24  
**Branch**: `feat/svelte-web-ui`  
**Status**: Proposed / Approved Approach A

---

## 1. Overview

The **Datasets** management feature adds a dedicated `/datasets` route and subroutes (`/datasets/[id]`) to the OneTrainer Web UI. It provides an intuitive, high-performance visual dataset workspace allowing users to:
- Configure a base datasets directory (`datasets_dir`, default: `"workspace/datasets"`).
- View card grid overviews of existing dataset folders with image thumbnails, name overlays, and image/caption counts.
- Create new datasets with OS-safe naming (auto-suggesting `Dataset {n}`).
- Upload supported images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.jfif`) and captions (`.txt`, `.caption`) via browser-to-server drag-and-drop or multi-file selection.
- View paired image-caption cards in `/datasets/[id]` with instant inline caption text editing.

---

## 2. Architecture & Data Flow

```mermaid
graph TD
    User([User in Browser]) -->|Navigates to /datasets| Rail[Rail.svelte Side Nav]
    Rail --> Page1[routes/datasets/+page.svelte]
    Page1 -->|GET /api/datasets| Router[routers/datasets.py]
    Page1 -->|POST /api/datasets| Router
    
    Page1 -->|Clicks Dataset Card| Page2[routes/datasets/[id]/+page.svelte]
    Page2 -->|GET /api/datasets/{id}/files| Router
    Page2 -->|POST /api/datasets/{id}/upload| Router
    Page2 -->|PUT /api/datasets/{id}/caption| Router
    Page2 -->|GET /api/datasets/image| Router
    
    Router --> Config[TrainConfig.py / ConfigService]
    Router --> Disk[(Server File System: workspace/datasets/)]
```

---

## 3. Backend Endpoints (`modules/webui/routers/datasets.py`)

| Endpoint | Method | Description |
|---|---|---|
| `/api/datasets` | `GET` | Lists all dataset subdirectories in `datasets_dir`. Returns `[{name, path, image_count, caption_count, thumbnail_url}]`. |
| `/api/datasets` | `POST` | Body `{"name": "Dataset 1"}`. Validates name, auto-suggests `Dataset {n}` if empty, creates directory `<datasets_dir>/<name>`. |
| `/api/datasets/{name}` | `DELETE` | Removes dataset folder `<datasets_dir>/<name>` safely. |
| `/api/datasets/{name}/files` | `GET` | Lists items in dataset folder, pairing image files with matching `.txt`/`.caption` files. |
| `/api/datasets/{name}/upload` | `POST` | Multipart file upload (`files: list[UploadFile]`). Saves files directly to disk. Auto-creates blank `.txt` for standalone images. |
| `/api/datasets/{name}/caption` | `PUT` | Body `{"filename": "image1.txt", "content": "updated caption"}`. Writes text to disk. |
| `/api/datasets/image` | `GET` | Params: `dataset`, `filename`, optional `thumb=true`. Returns cropped PNG thumbnail or full image. |

---

## 4. Configuration & Middleware Integration

1. **TrainConfig Integration**:
   - `modules/util/config/TrainConfig.py`: Add `datasets_dir: str` to `TrainConfig` class and `("datasets_dir", "workspace/datasets", str, False)` to `config_definitions`.
   - `modules/webui/schema/builders/data.py`: Expose `datasets_dir` field under the Data tab.
2. **LimitUploadSizeMiddleware Exemption**:
   - `modules/webui/app.py`: Exempt requests starting with `/api/datasets/` from the 1 MiB limit, allowing multi-file image uploads up to 500 MiB.

---

## 5. Frontend Route Design (`web/src/routes/datasets/`)

### 5.1 Main Datasets Route (`/datasets/+page.svelte`)
- **Top Header Bar**:
  - Base Datasets Directory text input & **Browse** folder button (interacts with `PathInput`/`DirectoryPicker`).
- **Dataset Cards Grid**:
  - **"+ Add Dataset" Card**: First card with a styled `+` icon. Clicking opens a modal for dataset name input (defaulting to `Dataset {n}`).
  - **Dataset Card**:
    - Image thumbnail of the first image (alphanumerically sorted). Clean fallback icon if empty.
    - Dark gradient overlay showing Dataset Name at the top left.
    - Footer showing `X images • Y captions`.
    - Delete dataset icon button on hover.

### 5.2 Dataset Detail Subroute (`/datasets/[id]/+page.svelte`)
- **Top Navigation Bar**:
  - "← Back to Datasets" button.
  - Dataset Name title & physical server directory path.
  - "+ Add Images / Captions" button & Drag and Drop dropzone banner.
- **Item Cards Grid**:
  - **Card Header**: Image filename & delete button.
  - **Card Body**:
    - Image preview thumbnail (clicking opens full-size lightbox).
  - **Card Footer**:
    - Inline editable caption `<textarea>` showing contents of `<image_name>.txt`.
    - Auto-saves caption changes on blur / change.

---

## 6. Edge Cases & Resilience

- **OS Naming Sanitization**: Rejects illegal folder characters (`\`, `/`, `:`, `*`, `?`, `"`, `<`, `>`, `|`) and prevents directory traversal (`..`).
- **Unpaired Captions / Images**: Automatically creates blank `<name>.txt` when uploading `<name>.png`. If `<name>.txt` is uploaded alone, presents it as a caption card with an option to attach an image.
- **Fast Thumbnail Caching**: Serves 150x150 PIL cropped image thumbnails with client HTTP caching to prevent browser lag on large datasets.

---

## 7. Testing & Verification Plan

- **Pytest**: Add unit tests in `tests/webui/test_datasets_router.py` testing dataset creation, directory sanitization, file pairing, and caption editing.
- **Vitest**: Add unit tests in `web/src/routes/datasets/datasets.test.ts` for dataset cards rendering, creation modal, and upload handling.
- **Production Build**: Verify static compilation with `cd web && bun run build`.
