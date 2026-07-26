from modules.webui.gallery import GalleryImage, GalleryNotFound
from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse

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
def get_gallery_image(run_key: str, filename: str, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        image_info: GalleryImage = app_state.gallery_service.get_image(run_key, filename)
    except GalleryNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    cache_headers = {
        "ETag": image_info.etag,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
    }

    if_none_match = request.headers.get("if-none-match")
    if if_none_match and if_none_match == image_info.etag:
        return Response(status_code=304, headers=cache_headers)

    return FileResponse(
        path=image_info.path,
        media_type=image_info.media_type,
        headers=cache_headers,
    )
