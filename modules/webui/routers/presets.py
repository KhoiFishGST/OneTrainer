from modules.webui.config_service import RevisionConflict
from modules.webui.presets import UnknownPreset
from modules.webui.state import AppState

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()


class PresetLoadRequest(BaseModel):
    preset_id: str
    base_revision: str
    overwrite: bool = False


class PresetSaveRequest(BaseModel):
    name: str


@router.get("/presets")
async def get_presets(request: Request):
    app_state: AppState = request.app.state.webui
    return app_state.presets.tree()


@router.post("/presets/load")
async def load_preset(body: PresetLoadRequest, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        train_config = app_state.presets.load(body.preset_id)
    except UnknownPreset:
        return JSONResponse(
            status_code=404,
            content={"detail": "Preset not found"},
        )

    try:
        snapshot = await app_state.config.replace_config(
            train_config,
            body.base_revision,
            overwrite=body.overwrite,
        )
        return {"config": snapshot.config, "revision": snapshot.revision}
    except RevisionConflict as e:
        return JSONResponse(
            status_code=409,
            content={"detail": {"message": "Config revision is stale", "current_revision": e.current.revision}},
        )


@router.post("/presets/save")
async def save_preset(body: PresetSaveRequest, request: Request):
    app_state: AppState = request.app.state.webui
    snapshot = await app_state.config.snapshot()
    try:
        filename = app_state.presets.save(body.name, snapshot)
        return {"filename": filename}
    except ValueError as e:
        return JSONResponse(
            status_code=422,
            content={"detail": str(e)},
        )
