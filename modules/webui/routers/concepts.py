import os
import pathlib

from modules.util import path_util
from modules.webui.state import AppState

from fastapi import APIRouter, Request

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
async def get_concept_preview_image(
    request: Request, path: str = "", include_subdirectories: bool = False
):
    app_state: AppState = request.app.state.webui
    preview_file = None

    if path and os.path.exists(path):
        concept_path = pathlib.Path(path)
        if concept_path.is_file() and path_util.is_supported_image_extension(
            concept_path.suffix.lower()
        ):
            preview_file = concept_path
        elif concept_path.is_dir():
            glob_pattern = "**/*.*" if include_subdirectories else "*.*"
            try:
                for p in concept_path.glob(glob_pattern):
                    if any(
                        part.startswith(".")
                        for part in p.relative_to(concept_path).parent.parts
                    ):
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

    return await app_state.media_service.serve_image(
        request, preview_file or pathlib.Path(""), thumb=True
    )

