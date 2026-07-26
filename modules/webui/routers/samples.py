from fastapi import APIRouter, Request
from modules.webui.state import AppState

router = APIRouter()


@router.get("/samples")
async def get_samples(request: Request):
    app_state: AppState = request.app.state.webui
    config_svc = app_state.config_service
    samples = await config_svc.get_sample_definitions()
    return {"samples": samples}


@router.put("/samples")
async def put_samples(request: Request):
    app_state: AppState = request.app.state.webui
    config_svc = app_state.config_service
    body = await request.json()
    if isinstance(body, dict) and "samples" in body:
        samples_list = body["samples"]
    elif isinstance(body, list):
        samples_list = body
    else:
        samples_list = []
    updated = await config_svc.update_sample_definitions(samples_list)
    return {"samples": updated}
