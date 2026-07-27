import base64
import contextlib
import io
import os
import pathlib
import threading
import time

from modules.util import path_util
from modules.util.concept_stats import folder_scan, init_concept_stats
from modules.util.config.ConceptConfig import ConceptConfig
from modules.webui.state import AppState

from fastapi import APIRouter, Request

try:
    from modules.ui.ConceptWindowController import ConceptWindowController
except ImportError:
    ConceptWindowController = None

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
            with contextlib.suppress(Exception):
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

    return await app_state.media_service.serve_image(
        request, preview_file or pathlib.Path(""), thumb=True
    )


@router.get("/concepts/stats")
async def get_concept_stats_endpoint(
    request: Request,
    path: str = "",
    advanced: bool = False,
    include_subdirectories: bool = False,
):
    if not path or not os.path.exists(path):
        return init_concept_stats(advanced)

    concept_config = ConceptConfig.default_values()
    concept_config.path = path
    concept_config.include_subdirectories = include_subdirectories

    stats_dict = init_concept_stats(advanced)
    start_time = time.perf_counter()
    cancel_flag = threading.Event()

    subfolders = [path]
    for p in subfolders:
        stats_dict = folder_scan(
            p, stats_dict, advanced, concept_config, start_time, 10.0, cancel_flag
        )
        if include_subdirectories:
            with contextlib.suppress(Exception):
                subfolders.extend(
                    [
                        f.path
                        for f in os.scandir(p)
                        if f.is_dir() and not f.name.startswith(".")
                    ]
                )

    return stats_dict


@router.post("/concepts/preview-augmentation")
async def preview_concept_augmentation(request: Request):
    app_state: AppState = request.app.state.webui
    body = await request.json()
    concept_dict = body.get("concept", {})
    index = int(body.get("image_preview_file_index", 0))
    preview_aug = bool(body.get("preview_augmentations", False))

    if ConceptWindowController is None:
        return {
            "image_data": "",
            "filename": "",
            "prompt": "[Augmentation preview requires mgds package]",
        }

    concept = ConceptConfig()
    concept.from_dict(concept_dict)

    train_config = await app_state.config_service.get_config()
    controller = ConceptWindowController(train_config, concept)

    try:
        pil_img, filename, prompt_text = controller.get_preview_image(
            index, preview_aug
        )
        buffer = io.BytesIO()
        pil_img.save(buffer, format="JPEG", quality=85)
        b64_str = base64.b64encode(buffer.getvalue()).decode("ascii")
        return {
            "image_data": f"data:image/jpeg;base64,{b64_str}",
            "filename": filename,
            "prompt": prompt_text,
        }
    except Exception as e:
        return {
            "image_data": "",
            "filename": "",
            "prompt": f"[Error generating preview: {str(e)}]",
        }


