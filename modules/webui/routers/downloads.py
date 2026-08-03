from enum import Enum

from modules.webui.archive import stream_directory_zip, stream_zip
from modules.webui.checkpoint_store import CheckpointNotFound
from modules.webui.run_artifacts import (
    archive_entries,
    resolve_artifact,
    resolve_artifacts,
    to_payload,
)
from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

router = APIRouter()


class ArtifactKind(str, Enum):
    """Closed set, so path traversal is structurally impossible and the route
    cannot collide with /archives/{filename}.zip."""

    config = "config"
    samples = "samples"
    tensorboard = "tensorboard"


@router.get("/downloads/runs")
def list_download_runs(request: Request):
    app_state: AppState = request.app.state.webui
    return {"runs": app_state.checkpoint_store.list_runs()}


@router.get("/downloads/runs/{run_key}")
def get_download_run(run_key: str, request: Request):
    app_state: AppState = request.app.state.webui
    store = app_state.checkpoint_store
    try:
        detail = store.get_run(run_key)
    except CheckpointNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    artifacts = resolve_artifacts(store.workspace_dir, run_key, detail.get("run") or {})
    return {**detail, "artifacts": [to_payload(a) for a in artifacts]}


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


@router.get("/downloads/runs/{run_key}/artifacts/{kind}")
def download_run_artifact(run_key: str, kind: ArtifactKind, request: Request):
    """Serve a run's config, samples or tensorboard logs.

    The config is a single file, so FileResponse gives resumable range support
    for free. Archives stream with zero disk -- nothing is cached.
    """
    app_state: AppState = request.app.state.webui
    store = app_state.checkpoint_store
    try:
        detail = store.get_run(run_key)
    except CheckpointNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    artifact = resolve_artifact(store.workspace_dir, run_key, detail.get("run") or {}, kind.value)
    if not artifact.available or artifact.path is None:
        raise HTTPException(
            status_code=404,
            detail=f"No {kind.value} available for this run",
        )

    if not artifact.is_archive:
        return FileResponse(
            artifact.path,
            filename=artifact.download_name,
            media_type="application/json",
        )

    return StreamingResponse(
        stream_zip(archive_entries(artifact), artifact.compression),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{artifact.download_name}"'},
    )


@router.delete("/downloads/runs/{run_key}/files/{filename}")
def delete_checkpoint(run_key: str, filename: str, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.checkpoint_store.delete_checkpoint(run_key, filename)
    except CheckpointNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return {"status": "ok"}
