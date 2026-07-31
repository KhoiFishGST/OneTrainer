import os
import re
import shutil
import urllib.parse
from pathlib import Path

from modules.util import path_util
from modules.webui.state import AppState

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

router = APIRouter()

SAFE_NAME_REGEX = re.compile(r"^[a-zA-Z0-9 _-]+$")


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

def get_base_datasets_dir(app_state: AppState) -> Path:
    raw_dir = app_state.settings_store.get_datasets_dir()
    p = Path(raw_dir)
    if not p.is_absolute():
        p = (app_state.settings.root_dir / p).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


class BaseDirUpdate(BaseModel):
    path: str


@router.put("/datasets/base-dir")
async def set_datasets_base_dir(req: BaseDirUpdate, request: Request):
    app_state: AppState = request.app.state.webui
    app_state.settings_store.set_datasets_dir(req.path.strip())
    return {
        "status": "ok",
        "base_dir": app_state.settings_store.get_datasets_dir(),
        "resolved_base_dir": str(get_base_datasets_dir(app_state)),
    }


@router.get("/datasets")
async def list_datasets(request: Request):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    result = []
    if base_dir.exists() and base_dir.is_dir():
        for entry in sorted(base_dir.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
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
                encoded_name = urllib.parse.quote(entry.name)
                result.append({
                    "name": entry.name,
                    "path": str(entry),
                    "image_count": img_count,
                    "video_count": vid_count,
                    "caption_count": cap_count,
                    "thumbnail_url": f"/api/datasets/image?dataset={encoded_name}&thumb=true",
                })
    return {
        "datasets": result,
        "base_dir": app_state.settings_store.get_datasets_dir(),
        "resolved_base_dir": str(base_dir),
    }


@router.post("/datasets")
async def create_dataset(request: Request):
    app_state: AppState = request.app.state.webui
    base_dir = get_base_datasets_dir(app_state)
    try:
        body = await request.json()
    except Exception:
        body = {}
    name = (body.get("name") if body else "") or ""
    name = name.strip()

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
        if p.name.startswith(".") or p.suffix.lower() == ".part":
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

    items = list(items_map.values())
    return {"name": name, "path": str(ds_dir), "items": items}


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

        await app_state.events.publish(
            "dataset.file.added",
            {
                "dataset": name,
                "filename": filename,
                "item_id": dest.stem,
                "kind": classify_media(dest.suffix) or "text",
            },
        )

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
async def get_dataset_image(
    dataset: str, filename: str = "", thumb: bool = False, request: Request = None
):
    app_state: AppState = request.app.state.webui
    if ".." in dataset or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid path")
    base_dir = get_base_datasets_dir(app_state)
    ds_dir = base_dir / dataset

    img_path = None
    if filename:
        p = ds_dir / filename
        if p.exists() and p.is_file():
            img_path = p
    else:
        if ds_dir.exists() and ds_dir.is_dir():
            for f in sorted(ds_dir.glob("*.*")):
                if path_util.is_supported_image_extension(f.suffix.lower()):
                    img_path = f
                    break

    return await app_state.media_service.serve_image(
        request, img_path or Path(""), thumb=thumb
    )
