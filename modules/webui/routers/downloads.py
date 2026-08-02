from modules.webui.archive import stream_directory_zip
from modules.webui.checkpoint_store import CheckpointNotFound
from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

router = APIRouter()


@router.get("/downloads/runs")
def list_download_runs(request: Request):
    app_state: AppState = request.app.state.webui
    return {"runs": app_state.checkpoint_store.list_runs()}


@router.get("/downloads/runs/{run_key}")
def get_download_run(run_key: str, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        return app_state.checkpoint_store.get_run(run_key)
    except CheckpointNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/downloads/runs/{run_key}/files/{filename}")
def download_checkpoint_file(run_key: str, filename: str, request: Request):
    """Serve a single-file checkpoint.

    Starlette's FileResponse already implements Range, If-Range, 206 and
    Accept-Ranges, so a dropped multi-gigabyte download resumes rather than
    restarting. Nothing extra is needed here.
    """
    app_state: AppState = request.app.state.webui
    try:
        path = app_state.checkpoint_store.get_checkpoint_path(run_key, filename)
    except CheckpointNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    if path.is_dir():
        raise HTTPException(
            status_code=400,
            detail="This checkpoint is a directory. Download it as an archive instead.",
        )

    return FileResponse(path, filename=path.name, media_type="application/octet-stream")


@router.get("/downloads/runs/{run_key}/archives/{filename}.zip")
def download_checkpoint_archive(run_key: str, filename: str, request: Request):
    """Serve a directory checkpoint as a streamed zip.

    A streamed archive cannot be seeked, so this is deliberately not resumable;
    the UI says so.
    """
    app_state: AppState = request.app.state.webui
    try:
        path = app_state.checkpoint_store.get_checkpoint_path(run_key, filename)
    except CheckpointNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    if not path.is_dir():
        raise HTTPException(
            status_code=400,
            detail="This checkpoint is a single file. Download it directly instead.",
        )

    return StreamingResponse(
        stream_directory_zip(path),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{path.name}.zip"'},
    )


@router.delete("/downloads/runs/{run_key}/files/{filename}")
def delete_checkpoint(run_key: str, filename: str, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.checkpoint_store.delete_checkpoint(run_key, filename)
    except CheckpointNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return {"status": "ok"}
