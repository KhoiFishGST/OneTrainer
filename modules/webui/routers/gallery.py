from modules.webui.config_io import load_train_config
from modules.webui.config_service import RevisionConflict
from modules.webui.gallery import GalleryImage, GalleryNotFound
from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()


class GalleryRunLoadRequest(BaseModel):
    base_revision: str


@router.get("/gallery/runs")
def list_gallery_runs(request: Request):
    app_state: AppState = request.app.state.webui
    return {"runs": app_state.gallery_service.list_runs()}


@router.get("/gallery/current")
def get_current_gallery(request: Request):
    app_state: AppState = request.app.state.webui
    return app_state.gallery_service.get_current_model()


@router.get("/gallery/runs/{run_key}")
def get_gallery_run(run_key: str, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        return app_state.gallery_service.get_run_model(run_key)
    except GalleryNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/gallery/runs/{run_key}/images/{filename}")
async def get_gallery_image(run_key: str, filename: str, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        image_info: GalleryImage = app_state.gallery_service.get_image(run_key, filename)
    except GalleryNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return await app_state.media_service.serve_image(
        request, image_info.path, thumb=False
    )


@router.post("/gallery/runs/{run_key}/load")
async def load_gallery_run_config(run_key: str, body: GalleryRunLoadRequest, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        config_path = app_state.gallery_service.get_run_config_path(run_key)
    except GalleryNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    loaded = load_train_config(config_path, secrets_path=app_state.settings.secrets_path)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Config file for this run no longer exists")

    try:
        snapshot = await app_state.config.replace_config(loaded, body.base_revision, overwrite=True)
    except RevisionConflict as e:
        return JSONResponse(
            status_code=409,
            content={"detail": {"message": "Config revision is stale", "current_revision": e.current.revision}},
        )

    return {"config": snapshot.config, "revision": snapshot.revision}

