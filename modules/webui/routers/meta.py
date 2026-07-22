from modules.webui.state import AppState

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/meta")
async def get_meta(request: Request):
    app_state: AppState = request.app.state.webui
    res = app_state.schema.meta()
    res["version"] = app_state.version
    return res
