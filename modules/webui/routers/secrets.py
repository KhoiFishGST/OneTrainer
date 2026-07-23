from typing import Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Request

from modules.util.config.config_io import save_secrets
from modules.webui.state import AppState

router = APIRouter(tags=["secrets"])


class SecretsUpdateRequest(BaseModel):
    huggingface_token: Optional[str] = None
    webui_password: Optional[str] = None


@router.get("/secrets")
async def get_secrets(request: Request) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    secrets = state.config._config.secrets
    return {
        "huggingface_token": secrets.huggingface_token,
        "huggingface_token_set": bool(secrets.huggingface_token),
        "webui_password_set": bool(secrets.webui_password),
    }


@router.api_route("/secrets", methods=["POST", "PUT"])
async def update_secrets(
    req: SecretsUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    secrets = state.config._config.secrets

    if req.huggingface_token is not None:
        secrets.huggingface_token = req.huggingface_token.strip()

    if req.webui_password is not None:
        secrets.webui_password = req.webui_password

    save_secrets(state.config._config, state.settings.secrets_path)

    return {
        "status": "ok",
        "huggingface_token_set": bool(secrets.huggingface_token),
        "webui_password_set": bool(secrets.webui_password),
    }
