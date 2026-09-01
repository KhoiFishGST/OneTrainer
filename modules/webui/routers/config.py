from modules.webui.config_codec import SettingsDocumentError, decode_settings_document
from modules.webui.config_io import load_train_config, save_settings
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


class ConfigSaveFileRequest(BaseModel):
    name: str
    overwrite: bool = False


class ConfigLoadFileRequest(BaseModel):
    path: str
    base_revision: str


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


@router.post("/config/save_file")
@router.post("/config/save")
async def save_file_config(body: ConfigSaveFileRequest, request: Request):
    app_state: AppState = request.app.state.webui
    clean_name = body.name.strip()
    if not clean_name:
        return JSONResponse(status_code=422, content={"detail": "Config name cannot be empty"})

    filename = clean_name if clean_name.endswith(".json") else f"{clean_name}.json"
    target_dir = app_state.settings.root_dir / "training_configs"
    target_path = target_dir / filename

    if target_path.exists() and not body.overwrite:
        return JSONResponse(
            status_code=409,
            content={"detail": "File already exists", "path": str(target_path), "exists": True},
        )

    snapshot = await app_state.config.snapshot()
    current_secrets = app_state.config.get_config().secrets
    config = decode_settings_document(snapshot.config, current_secrets)
    save_settings(config, target_path)
    return {"filename": str(target_path)}


@router.post("/config/load_file")
async def load_file_config(body: ConfigLoadFileRequest, request: Request):
    app_state: AppState = request.app.state.webui
    loaded = load_train_config(body.path, secrets_path=app_state.settings.secrets_path)
    if loaded is None:
        return JSONResponse(status_code=404, content={"detail": "Config file not found"})

    snapshot = await app_state.config.replace_config(loaded, body.base_revision, overwrite=True)
    return {"config": snapshot.config, "revision": snapshot.revision}


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

