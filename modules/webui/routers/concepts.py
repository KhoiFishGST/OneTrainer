import io
import os
import pathlib
from typing import Any
from PIL import Image

from fastapi import APIRouter, Request, Response

from modules.util import path_util
from modules.util.image_util import load_image
from modules.webui.state import AppState

router = APIRouter()


@router.get("/concepts")
async def get_concepts(request: Request):
    app_state: AppState = request.app.state.webui
    config_svc = app_state.config_service
    concepts = await config_svc.get_concepts()
    return concepts


@router.put("/concepts")
async def put_concepts(request: Request):
    app_state: AppState = request.app.state.webui
    config_svc = app_state.config_service
    body = await request.json()
    if isinstance(body, dict) and "concepts" in body:
        concepts_list = body["concepts"]
    elif isinstance(body, list):
        concepts_list = body
    else:
        concepts_list = body

    updated = await config_svc.update_concepts(concepts_list)
    return {"concepts": updated}


@router.get("/concepts/preview-image")
async def get_concept_preview_image(path: str, include_subdirectories: bool = False):
    if not path or not os.path.exists(path) or not os.path.isdir(path):
        img = Image.new("RGBA", (150, 150), (30, 40, 50, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

    glob_pattern = "**/*.*" if include_subdirectories else "*.*"
    preview_file = None
    try:
        concept_path = pathlib.Path(path)
        for p in concept_path.glob(glob_pattern):
            if any(part.startswith(".") for part in p.relative_to(concept_path).parent.parts):
                continue
            ext = os.path.splitext(p)[1]
            if (
                p.is_file()
                and path_util.is_supported_image_extension(ext)
                and not p.name.endswith("-masklabel.png")
                and not p.name.endswith("-condlabel.png")
            ):
                preview_file = p
                break
    except Exception:
        pass

    if preview_file:
        try:
            image = load_image(str(preview_file), convert_mode="RGBA")
            size = min(image.width, image.height)
            image = image.crop(
                (
                    (image.width - size) // 2,
                    (image.height - size) // 2,
                    (image.width - size) // 2 + size,
                    (image.height - size) // 2 + size,
                )
            )
            image = image.resize((150, 150), Image.Resampling.BILINEAR)
            buf = io.BytesIO()
            image.save(buf, format="PNG")
            return Response(content=buf.getvalue(), media_type="image/png")
        except Exception:
            pass

    img = Image.new("RGBA", (150, 150), (30, 40, 50, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")
