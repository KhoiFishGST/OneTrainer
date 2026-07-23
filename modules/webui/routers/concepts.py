from typing import Any

from fastapi import APIRouter, Request

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
