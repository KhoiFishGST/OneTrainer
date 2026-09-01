from typing import Any

from modules.webui.config_io import save_secrets
from modules.webui.state import AppState

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(tags=["secrets"])


class SecretsUpdateRequest(BaseModel):
    huggingface_token: str | None = None
    webui_password: str | None = None


@router.get("/secrets")
async def get_secrets(request: Request) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    secrets = state.config._config.secrets
    return {
        "huggingface_token": secrets.huggingface_token,
        "huggingface_token_set": bool(secrets.huggingface_token),
        "webui_password_set": state.settings_store.has_password(),
    }


@router.api_route("/secrets", methods=["POST", "PUT"])
async def update_secrets(
    req: SecretsUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    secrets = state.config._config.secrets

    # The store write goes first: if webui.json is unreadable it raises here,
    # before any in-memory state is touched, so a 500 cannot leave the
    # in-memory token diverged from secrets.json on disk.
    if req.webui_password is not None:
        state.settings_store.set_password(req.webui_password)

    if req.huggingface_token is not None:
        secrets.huggingface_token = req.huggingface_token.strip()

    save_secrets(state.config._config, state.settings.secrets_path)

    return {
        "status": "ok",
        "huggingface_token_set": bool(secrets.huggingface_token),
        "webui_password_set": state.settings_store.has_password(),
    }
