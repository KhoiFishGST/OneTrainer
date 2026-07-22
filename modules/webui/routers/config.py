from modules.webui.config_codec import SettingsDocumentError
from modules.webui.config_service import ConfigPersistenceError, RevisionConflict
from modules.webui.state import AppState

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()


class ConfigPutRequest(BaseModel):
    config: dict[str, object]
    base_revision: str
    overwrite: bool = False


@router.get("/config")
async def get_config(request: Request):
    app_state: AppState = request.app.state.webui
    snapshot = await app_state.config.snapshot()
    return {"config": snapshot.config, "revision": snapshot.revision}


@router.put("/config")
async def put_config(body: ConfigPutRequest, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        snapshot = await app_state.config.replace(
            body.config,
            body.base_revision,
            overwrite=body.overwrite,
        )
        return {"config": snapshot.config, "revision": snapshot.revision}
    except SettingsDocumentError as e:
        return JSONResponse(
            status_code=422,
            content={"detail": [{"path": issue.path, "message": issue.message} for issue in e.field_issues]},
        )
    except RevisionConflict as e:
        return JSONResponse(
            status_code=409,
            content={"detail": {"message": "Config revision is stale", "current_revision": e.current.revision}},
        )
    except ConfigPersistenceError as e:
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)},
        )


@router.get("/config/schema")
async def get_config_schema(model_type: str, training_method: str, request: Request):
    app_state: AppState = request.app.state.webui
    try:
        return app_state.schema.build(model_type, training_method)
    except ValueError as e:
        return JSONResponse(
            status_code=422,
            content={"detail": str(e)},
        )
