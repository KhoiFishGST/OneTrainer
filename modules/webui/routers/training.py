from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from modules.webui.state import AppState

router = APIRouter()


@router.get("/training/status")
async def get_status(request: Request):
    app_state: AppState = request.app.state.webui
    return app_state.training_service.get_status()


@router.post("/training/start")
async def start_training(request: Request, body: Optional[dict[str, Any]] = None):
    app_state: AppState = request.app.state.webui
    config_data = None
    if body and "config" in body and isinstance(body["config"], dict):
        config_data = body["config"]
    elif body:
        config_data = body
    if not config_data:
        try:
            snapshot = await app_state.config_service.snapshot()
            config_data = snapshot.config
        except Exception:
            config_data = {}
    try:
        app_state.training_service.start_training(config_data)
        return app_state.training_service.get_status()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/training/stop")
async def stop_training(request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.training_service.stop_training()
        return app_state.training_service.get_status()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))



@router.post("/training/pause")
async def pause_training(request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.training_service.pause_training()
        return app_state.training_service.get_status()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))



@router.post("/training/resume")
async def resume_training(request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.training_service.resume_training()
        return app_state.training_service.get_status()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))



@router.post("/training/sample")
async def request_sample(request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.training_service.request_sample()
        return {"status": "ok"}
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))



@router.post("/training/backup")
async def request_backup(request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.training_service.request_backup()
        return {"status": "ok"}
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/training/save")
async def request_save(request: Request):
    app_state: AppState = request.app.state.webui
    try:
        app_state.training_service.request_save()
        return {"status": "ok"}
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))




@router.get("/training/metrics")
async def get_metrics(request: Request):
    app_state: AppState = request.app.state.webui
    return app_state.training_service.get_metrics()


@router.get("/training/samples")
async def get_samples(request: Request):
    app_state: AppState = request.app.state.webui
    return app_state.training_service.get_samples()


@router.get("/training/samples/{sample_id}/image")
async def get_sample_image(sample_id: str, request: Request):
    app_state: AppState = request.app.state.webui
    samples = app_state.training_service.get_samples()
    sample = next((s for s in samples if s.get("sample_id") == sample_id or s.get("id") == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    filepath = sample.get("filepath")
    if not filepath:
        raise HTTPException(status_code=404, detail="Sample image filepath not recorded")

    file_path = Path(filepath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Sample image file missing from disk")

    return FileResponse(file_path)



@router.get("/training/gpu")
async def get_gpu(request: Request):
    app_state: AppState = request.app.state.webui
    return app_state.training_service.get_gpu_stats()
