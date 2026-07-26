from modules.webui.gallery import GalleryImage, GalleryNotFound
from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request

router = APIRouter()


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

