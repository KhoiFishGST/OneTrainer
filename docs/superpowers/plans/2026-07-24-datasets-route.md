# Datasets Management Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/datasets` route and `/datasets/[id]` detail view to OneTrainer Web UI for managing dataset folders, uploading images/captions from browser to server, and editing caption files inline.

**Architecture:** A FastAPI backend router (`modules/webui/routers/datasets.py`) manages filesystem CRUD operations, image thumbnail cropping, and multipart upload streaming. A SvelteKit frontend (`web/src/routes/datasets`) provides dataset card overviews, base directory configuration, drag-and-drop upload, and image-caption cards with inline text editing.

**Tech Stack:** Python 3.12, FastAPI, PIL (Pillow), Svelte 5, SvelteKit, Bun, Vitest, Pytest.

## Global Constraints

- `datasets_dir` default value: `"workspace/datasets"` relative to OneTrainer root directory.
- OS-safe folder names: alphanumeric characters, spaces, hyphens, underscores (`^[a-zA-Z0-9 _-]+$`).
- Image extensions: `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.jfif`.
- Caption extensions: `.txt`, `.caption`.
- Middleware upload limit: 500 MiB for `/api/datasets/` endpoints.

---

### Task 1: TrainConfig & Schema Extension

**Files:**
- Modify: `modules/util/config/TrainConfig.py:374`
- Modify: `modules/util/config/TrainConfig.py:1015`
- Modify: `modules/webui/schema/builders/data.py:20`
- Test: `tests/webui/test_schema.py`

**Interfaces:**
- Consumes: `TrainConfig` class
- Produces: `TrainConfig.datasets_dir` property (default `"workspace/datasets"`)

- [ ] **Step 1: Write failing test for datasets_dir config property**

Add to `tests/webui/test_schema.py`:
```python
def test_train_config_has_default_datasets_dir():
    from modules.util.config.TrainConfig import TrainConfig
    config = TrainConfig.default_values()
    assert hasattr(config, "datasets_dir")
    assert config.datasets_dir == "workspace/datasets"
```

- [ ] **Step 2: Run test to verify failure**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/pytest tests/webui/test_schema.py::test_train_config_has_default_datasets_dir -v`  
Expected: FAIL with `AttributeError: 'TrainConfig' object has no attribute 'datasets_dir'`

- [ ] **Step 3: Implement datasets_dir property in TrainConfig.py and data.py**

In `modules/util/config/TrainConfig.py`:
```python
# Around line 374:
    datasets_dir: str

# Around line 1016 (inside config_definitions):
        data.append(("datasets_dir", "workspace/datasets", str, False))
```

In `modules/webui/schema/builders/data.py`:
```python
Field("datasets_dir", label="Datasets Directory", tooltip="Base directory path for training datasets.", field_type="path", mode="dir")
```

- [ ] **Step 4: Run test to verify pass**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/pytest tests/webui/test_schema.py -v`  
Expected: PASS (7/7 passed)

- [ ] **Step 5: Commit**

```bash
git add modules/util/config/TrainConfig.py modules/webui/schema/builders/data.py tests/webui/test_schema.py
git commit -m "feat(webui): add datasets_dir configuration property to TrainConfig and schema"
```

---

### Task 2: Datasets Backend Router & Upload Middleware

**Files:**
- Create: `modules/webui/routers/datasets.py`
- Modify: `modules/webui/app.py:55-100`
- Modify: `modules/webui/app.py:211-225`
- Test: `tests/webui/test_datasets_router.py`

**Interfaces:**
- Consumes: `AppState.config_service`, `AppState.settings`
- Produces: FastAPI endpoints at `/api/datasets`, `/api/datasets/{name}`, `/api/datasets/{name}/files`, `/api/datasets/{name}/upload`, `/api/datasets/{name}/caption`, `/api/datasets/image`

- [ ] **Step 1: Write failing tests for datasets router**

Create `tests/webui/test_datasets_router.py`:
```python
import pytest
from fastapi.testclient import TestClient

def test_datasets_endpoints_exist(test_client: TestClient):
    res = test_client.get("/api/datasets")
    assert res.status_code in (200, 401)
```

- [ ] **Step 2: Run test to verify failure**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/pytest tests/webui/test_datasets_router.py -v`  
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Implement modules/webui/routers/datasets.py**

Create `modules/webui/routers/datasets.py`:
```python
import io
import os
import re
import shutil
from pathlib import Path
from PIL import Image
from fastapi import APIRouter, HTTPException, Query, Request, Response, UploadFile, File
from modules.util import path_util
from modules.util.image_util import load_image
from modules.webui.state import AppState

router = APIRouter()

SAFE_NAME_REGEX = re.compile(r"^[a-zA-Z0-9 _-]+$")

def get_base_datasets_dir(app_state: AppState) -> Path:
    config = app_state.config_service.get_config()
    raw_dir = getattr(config, "datasets_dir", "workspace/datasets") or "workspace/datasets"
    p = Path(raw_dir)
    if not p.is_absolute():
        p = (app_state.settings.root_dir / p).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p

@router.get("/datasets")
async def list_datasets(request: Request):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    result = []
    if base_dir.exists() and base_dir.is_dir():
        for entry in sorted(base_dir.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                img_count = 0
                cap_count = 0
                for f in entry.glob("*.*"):
                    ext = f.suffix.lower()
                    if path_util.is_supported_image_extension(ext):
                        img_count += 1
                    elif ext in (".txt", ".caption"):
                        cap_count += 1
                result.append({
                    "name": entry.name,
                    "path": str(entry),
                    "image_count": img_count,
                    "caption_count": cap_count,
                    "thumbnail_url": f"/api/datasets/image?dataset={entry.name}&thumb=true",
                })
    return {"datasets": result, "base_dir": str(base_dir)}

@router.post("/datasets")
async def create_dataset(request: Request):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    body = await request.json()
    name = (body.get("name") or "").strip()
    
    if not name:
        # Auto-suggest Dataset {n}
        existing = {entry.name for entry in base_dir.iterdir() if entry.is_dir()}
        idx = 1
        while f"Dataset {idx}" in existing:
            idx += 1
        name = f"Dataset {idx}"
        
    if not SAFE_NAME_REGEX.match(name) or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid dataset name. Use alphanumeric characters, spaces, dashes, and underscores only.")
        
    ds_dir = base_dir / name
    ds_dir.mkdir(parents=True, exist_ok=True)
    return {"name": name, "path": str(ds_dir)}

@router.delete("/datasets/{name}")
async def delete_dataset(name: str, request: Request):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    if not SAFE_NAME_REGEX.match(name) or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid dataset name")
    ds_dir = base_dir / name
    if ds_dir.exists() and ds_dir.is_dir():
        shutil.rmtree(ds_dir)
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Dataset not found")

@router.get("/datasets/{name}/files")
async def get_dataset_files(name: str, request: Request):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    ds_dir = base_dir / name
    if not ds_dir.exists() or not ds_dir.is_dir():
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    items_map = {}
    for p in sorted(ds_dir.glob("*.*")):
        if p.name.startswith("."):
            continue
        ext = p.suffix.lower()
        stem = p.stem
        if stem not in items_map:
            items_map[stem] = {"id": stem, "image_name": None, "caption_name": None, "caption_content": ""}
            
        if path_util.is_supported_image_extension(ext):
            items_map[stem]["image_name"] = p.name
        elif ext in (".txt", ".caption"):
            items_map[stem]["caption_name"] = p.name
            try:
                items_map[stem]["caption_content"] = p.read_text(encoding="utf-8")
            except Exception:
                items_map[stem]["caption_content"] = ""

    items = list(items_map.values())
    return {"name": name, "path": str(ds_dir), "items": items}

@router.post("/datasets/{name}/upload")
async def upload_dataset_files(name: str, request: Request, files: list[UploadFile] = File(...)):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    ds_dir = base_dir / name
    if not ds_dir.exists() or not ds_dir.is_dir():
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    saved = []
    for f in files:
        filename = os.path.basename(f.filename or "")
        if not filename or ".." in filename:
            continue
        dest = ds_dir / filename
        content = await f.read()
        dest.write_bytes(content)
        saved.append(filename)
        
        # Auto-create blank caption file for images if not present
        ext = dest.suffix.lower()
        if path_util.is_supported_image_extension(ext):
            txt_dest = ds_dir / f"{dest.stem}.txt"
            if not txt_dest.exists():
                txt_dest.write_text("", encoding="utf-8")
                
    return {"saved": saved}

@router.put("/datasets/{name}/caption")
async def update_dataset_caption(name: str, request: Request):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    ds_dir = base_dir / name
    if not ds_dir.exists() or not ds_dir.is_dir():
        raise HTTPException(status_code=404, detail="Dataset not found")
    body = await request.json()
    filename = body.get("filename")
    content = body.get("content", "")
    if not filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    txt_file = ds_dir / filename
    txt_file.write_text(content, encoding="utf-8")
    return {"status": "ok"}

@router.get("/datasets/image")
async def get_dataset_image(dataset: str, filename: str = "", thumb: bool = False, request: Request = None):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    ds_dir = base_dir / dataset
    
    img_path = None
    if filename:
        p = ds_dir / filename
        if p.exists() and p.is_file():
            img_path = p
    else:
        for f in sorted(ds_dir.glob("*.*")):
            if path_util.is_supported_image_extension(f.suffix.lower()):
                img_path = f
                break
                
    if not img_path:
        img = Image.new("RGBA", (150, 150), (30, 40, 50, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")
        
    if thumb:
        try:
            image = load_image(str(img_path), convert_mode="RGBA")
            size = min(image.width, image.height)
            image = image.crop(((image.width - size) // 2, (image.height - size) // 2, (image.width - size) // 2 + size, (image.height - size) // 2 + size))
            image = image.resize((150, 150), Image.Resampling.BILINEAR)
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            return Response(content=buf.getvalue(), media_type="image/png")
        except Exception:
            pass
            
    return Response(content=img_path.read_bytes(), media_type="image/png")
```

Update `LimitUploadSizeMiddleware` in `modules/webui/app.py`:
```python
# Exempt /api/datasets/ from 1 MiB body size cap (allow 500 MiB)
if scope.get("path", "").startswith("/api/datasets/"):
    await self.app(scope, receive, send)
    return
```

Register `datasets_router` in `modules/webui/app.py`:
```python
from modules.webui.routers.datasets import router as datasets_router
app.include_router(datasets_router, prefix="/api")
```

- [ ] **Step 4: Run tests to verify pass**

Run: `PYTHONPATH=. /home/khoifish/GST/gst-venv/bin/pytest tests/webui/test_datasets_router.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/webui/routers/datasets.py modules/webui/app.py tests/webui/test_datasets_router.py
git commit -m "feat(webui): implement datasets backend router endpoints and upload middleware exemption"
```

---

### Task 3: Navigation Rail Extension

**Files:**
- Modify: `web/src/lib/components/shell/Rail.svelte:3-56`
- Test: `web/src/lib/components/shell/Rail.test.ts`

**Interfaces:**
- Consumes: Lucide icons (`FolderKanban`)
- Produces: Rail nav item `{ name: 'Datasets', path: '/datasets', icon: FolderKanban, disabled: false }`

- [ ] **Step 1: Write failing test in Rail.test.ts**

Add to `web/src/lib/components/shell/Rail.test.ts`:
```ts
test('renders Datasets navigation link', () => {
  render(Rail, { currentPath: '/datasets' });
  expect(screen.getByText('Datasets')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun test src/lib/components/shell/Rail.test.ts`  
Expected: FAIL with "Datasets" not found

- [ ] **Step 3: Add Datasets route to Rail.svelte**

In `web/src/lib/components/shell/Rail.svelte`:
```svelte
<script lang="ts">
  import { FolderKanban } from 'lucide-svelte';
  // ...
  const navItems = [
    { name: 'Live', path: '/live', icon: Tv, disabled: false },
    { name: 'General', path: '/general', icon: SlidersHorizontal, disabled: false },
    { name: 'Model', path: '/model', icon: Box, disabled: false },
    { name: 'Data', path: '/data', icon: Database, disabled: false },
    { name: 'Datasets', path: '/datasets', icon: FolderKanban, disabled: false },
    { name: 'Concepts', path: '/concepts', icon: Layers, disabled: false },
    // ...
  ];
</script>
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd web && bun test src/lib/components/shell/Rail.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/shell/Rail.svelte web/src/lib/components/shell/Rail.test.ts
git commit -m "feat(webui): add Datasets item to side navigation rail"
```

---

### Task 4: Main Datasets Gallery Route (`/datasets`)

**Files:**
- Create: `web/src/routes/datasets/+page.svelte`
- Create: `web/src/routes/datasets/+page.ts`
- Test: `web/src/routes/datasets/DatasetsPage.test.ts`

**Interfaces:**
- Consumes: `/api/datasets` endpoints
- Produces: Datasets overview page with base directory selector and creation modal

- [ ] **Step 1: Write failing test for Datasets gallery page**

Create `web/src/routes/datasets/DatasetsPage.test.ts`:
```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import DatasetsPage from './+page.svelte';

test('renders Datasets title and add dataset card', () => {
  render(DatasetsPage);
  expect(screen.getByText('Datasets')).toBeInTheDocument();
  expect(screen.getByText('Add Dataset')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun test src/routes/datasets/DatasetsPage.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement web/src/routes/datasets/+page.svelte**

Create `web/src/routes/datasets/+page.svelte`:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, Folder, Trash2, FolderOpen } from 'lucide-svelte';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import PathInput from '$lib/components/form/PathInput.svelte';

  let datasets = $state<any[]>([]);
  let baseDir = $state('');
  let loading = $state(true);
  let showCreateModal = $state(false);
  let newDatasetName = $state('');
  let createError = $state<string | null>(null);

  async function fetchDatasets() {
    loading = true;
    try {
      const res = await fetch('/api/datasets');
      if (res.ok) {
        const data = await res.json();
        datasets = data.datasets || [];
        baseDir = data.base_dir || '';
      }
    } catch (err) {
      console.error('Failed to load datasets', err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchDatasets();
  });

  async function handleCreateDataset() {
    createError = null;
    try {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDatasetName }),
      });
      if (res.ok) {
        showCreateModal = false;
        newDatasetName = '';
        await fetchDatasets();
      } else {
        const err = await res.json();
        createError = err.detail || 'Failed to create dataset';
      }
    } catch (err: any) {
      createError = err.message || 'Failed to create dataset';
    }
  }

  async function handleDeleteDataset(e: MouseEvent, name: string) {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete dataset "${name}"?`)) return;
    try {
      await fetch(`/api/datasets/${encodeURIComponent(name)}`, { method: 'DELETE' });
      await fetchDatasets();
    } catch (err) {
      console.error('Failed to delete dataset', err);
    }
  }
</script>

<div class="datasets-page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Datasets</h1>
      <p class="page-subtitle">Create and manage image & caption datasets</p>
    </div>
  </div>

  <div class="base-dir-bar">
    <span class="base-dir-label">Base Directory:</span>
    <div class="base-dir-input-wrapper">
      <PathInput
        id="base-datasets-dir"
        value={baseDir}
        mode="dir"
        onValueInput={(v) => (baseDir = v)}
      />
    </div>
  </div>

  <div class="datasets-grid">
    <button type="button" class="card add-card" onclick={() => (showCreateModal = true)}>
      <div class="add-icon-wrapper">
        <Plus size={32} />
      </div>
      <span class="add-label">Add Dataset</span>
    </button>

    {#each datasets as ds}
      <a href="/datasets/{encodeURIComponent(ds.name)}" class="card dataset-card">
        <div class="thumbnail-wrapper">
          <img src={ds.thumbnail_url} alt={ds.name} class="thumbnail-img" />
          <div class="thumbnail-overlay">
            <span class="dataset-name">{ds.name}</span>
          </div>
          <button
            type="button"
            class="btn-delete"
            aria-label="Delete dataset"
            onclick={(e) => handleDeleteDataset(e, ds.name)}
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div class="card-footer">
          <span class="count-badge">{ds.image_count} images</span>
          <span class="dot-separator">•</span>
          <span class="count-badge">{ds.caption_count} captions</span>
        </div>
      </a>
    {/each}
  </div>
</div>

<ModalDialog
  isOpen={showCreateModal}
  title="Create New Dataset"
  onClose={() => (showCreateModal = false)}
>
  <div class="modal-body">
    <label for="ds-name-input">Dataset Name</label>
    <input
      id="ds-name-input"
      type="text"
      placeholder="e.g. Dataset 1"
      bind:value={newDatasetName}
      class="text-input"
    />
    {#if createError}
      <p class="error-text">{createError}</p>
    {/if}
  </div>
  {#snippet footer()}
    <div class="modal-footer">
      <button type="button" class="btn-secondary" onclick={() => (showCreateModal = false)}>Cancel</button>
      <button type="button" class="btn-primary" onclick={handleCreateDataset}>Create</button>
    </div>
  {/snippet}
</ModalDialog>

<style>
  .datasets-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text, #f8fafc);
  }
  .page-subtitle {
    color: var(--muted, #8995a1);
    font-size: 0.875rem;
  }
  .base-dir-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--panel, #182026);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--line, #2d3741);
  }
  .base-dir-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted);
    white-space: nowrap;
  }
  .base-dir-input-wrapper {
    flex: 1;
  }
  .datasets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
  }
  .card {
    background: var(--panel, #182026);
    border: 1px solid var(--line, #2d3741);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: var(--accent, #3b82f6);
  }
  .add-card {
    min-height: 200px;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    cursor: pointer;
    background: transparent;
    border: 2px dashed var(--line, #2d3741);
    color: var(--muted);
  }
  .add-card:hover {
    border-color: var(--accent, #3b82f6);
    color: var(--accent, #3b82f6);
  }
  .thumbnail-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: #0f1419;
  }
  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .thumbnail-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 60%);
    padding: 0.75rem;
  }
  .dataset-name {
    color: #ffffff;
    font-weight: 600;
    font-size: 1rem;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }
  .btn-delete {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: #ef4444;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .dataset-card:hover .btn-delete {
    opacity: 1;
  }
  .card-footer {
    padding: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 0;
  }
  .text-input {
    padding: 0.5rem 0.75rem;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
  }
  .error-text {
    color: #ef4444;
    font-size: 0.8125rem;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .btn-primary {
    background: var(--accent, #3b82f6);
    color: #ffffff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .btn-secondary {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--text);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd web && bun test src/routes/datasets/DatasetsPage.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/datasets/+page.svelte web/src/routes/datasets/DatasetsPage.test.ts
git commit -m "feat(webui): implement Datasets gallery route page with base directory bar and creation modal"
```

---

### Task 5: Dataset Detail Subroute (`/datasets/[id]`)

**Files:**
- Create: `web/src/routes/datasets/[id]/+page.svelte`
- Create: `web/src/routes/datasets/[id]/+page.ts`
- Test: `web/src/routes/datasets/[id]/DatasetDetailPage.test.ts`

**Interfaces:**
- Consumes: `/api/datasets/{name}/files`, `/api/datasets/{name}/upload`, `/api/datasets/{name}/caption`
- Produces: Dataset detail page with file drag-and-drop uploader and paired image-caption cards grid

- [ ] **Step 1: Write failing test for Dataset Detail page**

Create `web/src/routes/datasets/[id]/DatasetDetailPage.test.ts`:
```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import DatasetDetailPage from './+page.svelte';

test('renders dataset detail header and upload button', () => {
  render(DatasetDetailPage, { data: { id: 'TestDataset' } });
  expect(screen.getByText('Back to Datasets')).toBeInTheDocument();
  expect(screen.getByText('Add Files')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun test src/routes/datasets/[id]/DatasetDetailPage.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement web/src/routes/datasets/[id]/+page.svelte**

Create `web/src/routes/datasets/[id]/+page.svelte`:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeft, Upload, Image as ImageIcon, FileText, Trash2, X } from 'lucide-svelte';

  let { data } = $props<{ data: { id: string } }>();
  let datasetName = $derived(data.id);
  let datasetPath = $state('');
  let items = $state<any[]>([]);
  let loading = $state(true);
  let fileInput = $state<HTMLInputElement | null>(null);
  let isDragging = $state(false);
  let activeLightboxImage = $state<string | null>(null);

  async function fetchDatasetFiles() {
    loading = true;
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(datasetName)}/files`);
      if (res.ok) {
        const json = await res.json();
        items = json.items || [];
        datasetPath = json.path || '';
      }
    } catch (err) {
      console.error('Failed to load dataset files', err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchDatasetFiles();
  });

  async function handleFileUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(datasetName)}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchDatasetFiles();
      }
    } catch (err) {
      console.error('Upload failed', err);
    }
  }

  async function handleCaptionSave(captionName: string, content: string) {
    if (!captionName) return;
    try {
      await fetch(`/api/datasets/${encodeURIComponent(datasetName)}/caption`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: captionName, content }),
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

<div
  class="detail-page"
  ondragover={(e) => { e.preventDefault(); isDragging = true; }}
  ondragleave={() => (isDragging = false)}
  ondrop={handleDrop}
>
  {#if isDragging}
    <div class="dropzone-overlay">
      <Upload size={48} />
      <span>Drop images or caption files here to upload</span>
    </div>
  {/if}

  <div class="detail-header">
    <a href="/datasets" class="btn-back">
      <ArrowLeft size={18} />
      <span>Back to Datasets</span>
    </a>
    <div class="header-info">
      <h1 class="dataset-title">{datasetName}</h1>
      <span class="dataset-path">{datasetPath}</span>
    </div>
    <button type="button" class="btn-upload" onclick={() => fileInput?.click()}>
      <Upload size={18} />
      <span>Add Files</span>
    </button>
    <input
      bind:this={fileInput}
      type="file"
      multiple
      accept="image/*,.txt,.caption"
      class="hidden-file-input"
      onchange={(e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) handleFileUpload(target.files);
      }}
    />
  </div>

  {#if items.length === 0 && !loading}
    <div class="empty-state">
      <ImageIcon size={48} />
      <p class="empty-title">No images or captions in this dataset yet</p>
      <p class="empty-sub">Click "Add Files" or drag & drop files anywhere onto this page</p>
    </div>
  {:else}
    <div class="items-grid">
      {#each items as item}
        <div class="item-card">
          <div class="card-image-area">
            {#if item.image_name}
              <img
                src="/api/datasets/image?dataset={encodeURIComponent(datasetName)}&filename={encodeURIComponent(item.image_name)}"
                alt={item.id}
                class="item-img"
                onclick={() => (activeLightboxImage = `/api/datasets/image?dataset=${encodeURIComponent(datasetName)}&filename=${encodeURIComponent(item.image_name)}`)}
              />
            {:else}
              <div class="no-image-placeholder">
                <FileText size={32} />
                <span>Text Only</span>
              </div>
            {/if}
          </div>
          <div class="card-caption-area">
            <span class="item-id-label">{item.id}</span>
            <textarea
              class="caption-textarea"
              placeholder="Add caption..."
              value={item.caption_content}
              onblur={(e) => handleCaptionSave(item.caption_name || `${item.id}.txt`, (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if activeLightboxImage}
  <div class="lightbox-overlay" onclick={() => (activeLightboxImage = null)} role="presentation">
    <img src={activeLightboxImage} alt="Preview" class="lightbox-img" />
    <button type="button" class="btn-close-lightbox" onclick={() => (activeLightboxImage = null)}>
      <X size={24} />
    </button>
  </div>
{/if}

<style>
  .detail-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-height: 100vh;
    position: relative;
  }
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .btn-back {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.875rem;
  }
  .btn-back:hover {
    color: var(--text);
  }
  .dataset-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--text);
  }
  .dataset-path {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .btn-upload {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--accent, #3b82f6);
    color: #ffffff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .hidden-file-input {
    display: none;
  }
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.25rem;
  }
  .item-card {
    background: var(--panel, #182026);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .card-image-area {
    width: 100%;
    aspect-ratio: 1;
    background: #0f1419;
    cursor: pointer;
  }
  .item-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .no-image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted);
    gap: 0.5rem;
  }
  .card-caption-area {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .item-id-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }
  .caption-textarea {
    width: 100%;
    min-height: 60px;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 4px;
    color: var(--text);
    padding: 0.5rem;
    font-size: 0.8125rem;
    resize: vertical;
  }
  .dropzone-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.9);
    border: 3px dashed var(--accent, #3b82f6);
    z-index: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--accent);
  }
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lightbox-img {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
  }
  .btn-close-lightbox {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    color: #ffffff;
    cursor: pointer;
  }
</style>
```

Create `web/src/routes/datasets/[id]/+page.ts`:
```ts
export function load({ params }: { params: { id: string } }) {
  return { id: params.id };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd web && bun test src/routes/datasets/[id]/DatasetDetailPage.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/datasets/\[id\]/+page.svelte web/src/routes/datasets/\[id\]/+page.ts web/src/routes/datasets/\[id\]/DatasetDetailPage.test.ts
git commit -m "feat(webui): implement Dataset Detail subroute page with paired image-caption cards and drag-and-drop upload"
```
