from modules.webui.state import AppState

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/meta")
async def get_meta(request: Request):
    app_state: AppState = request.app.state.webui
    return app_state.schema.meta()
