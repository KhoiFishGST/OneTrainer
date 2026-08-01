from typing import Any

from modules.webui.state import AppState

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(tags=["appearance"])


class AppearanceUpdateRequest(BaseModel):
    # Both optional: the UI sends only the field the user touched, so a theme
    # change from one browser cannot stomp an animations change from another.
    theme: str | None = None
    animations: bool | None = None


@router.get("/appearance")
async def get_appearance(request: Request) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    return state.settings_store.get_appearance()


@router.put("/appearance")
async def update_appearance(req: AppearanceUpdateRequest, request: Request) -> Any:
    state: AppState = request.app.state.webui
    try:
        return state.settings_store.set_appearance(
            theme=req.theme,
            animations=req.animations,
        )
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"detail": str(exc)})
