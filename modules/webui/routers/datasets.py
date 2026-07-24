import io
import mimetypes
import os
import re
import shutil
import urllib.parse
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
    config = app_state.config_service.get_config()
    raw_dir = getattr(config, "datasets_dir", "workspace/datasets") or "workspace/datasets"
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
                encoded_name = urllib.parse.quote(entry.name)
                result.append({
                    "name": entry.name,
                    "path": str(entry),
                    "image_count": img_count,
                    "caption_count": cap_count,
                    "thumbnail_url": f"/api/datasets/image?dataset={encoded_name}&thumb=true",
                })
    return {"datasets": result, "base_dir": raw_dir, "resolved_base_dir": str(base_dir)}


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
    if ".." in dataset or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid path")
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

    mime_type, _ = mimetypes.guess_type(str(img_path))
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/png"

    return Response(content=img_path.read_bytes(), media_type=mime_type)
