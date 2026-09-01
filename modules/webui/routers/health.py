from modules.webui.state import AppState

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def get_health(request: Request):
    app_state: AppState = request.app.state.webui
    snapshot = await app_state.config.snapshot()
    frontend_built = (app_state.settings.static_dir / "index.html").exists()
    return {
        "status": "ok",
        "version": app_state.version,
        "frontend_built": frontend_built,
        "revision": snapshot.revision,
        "warnings": app_state.warnings,
    }
