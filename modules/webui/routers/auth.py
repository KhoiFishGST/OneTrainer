import secrets
from typing import Any

from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter(tags=["auth"])

# Active authenticated tokens
_ACTIVE_TOKENS: set[str] = set()


class LoginRequest(BaseModel):
    password: str


def is_authenticated(request_or_ws: Any, state: AppState) -> bool:
    password_required = bool(state.config._config.secrets.webui_password)
    if not password_required:
        return True

    headers = getattr(request_or_ws, "headers", {})
    auth_header = headers.get("Authorization") or headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token in _ACTIVE_TOKENS:
            return True

    cookies = getattr(request_or_ws, "cookies", {})
    cookie_token = cookies.get("onetrainer_session")
    return bool(cookie_token and cookie_token in _ACTIVE_TOKENS)


@router.get("/auth/status")
async def get_auth_status(request: Request) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    password_required = bool(state.config._config.secrets.webui_password)
    authenticated = is_authenticated(request, state)
    return {
        "password_required": password_required,
        "authenticated": authenticated,
    }


@router.post("/auth/login")
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    password_required = bool(state.config._config.secrets.webui_password)
    if not password_required:
        return {"status": "ok", "authenticated": True, "token": None}

    expected_password = state.config._config.secrets.webui_password
    if req.password != expected_password:
        raise HTTPException(status_code=401, detail="Invalid password")

    token = secrets.token_hex(32)
    _ACTIVE_TOKENS.add(token)

    response.set_cookie(
        key="onetrainer_session",
        value=token,
        httponly=True,
        samesite="lax",
    )

    return {"status": "ok", "authenticated": True, "token": token}


@router.post("/auth/logout")
async def logout(
    request: Request,
    response: Response,
) -> dict[str, Any]:
    cookie_token = request.cookies.get("onetrainer_session")
    if cookie_token in _ACTIVE_TOKENS:
        _ACTIVE_TOKENS.remove(cookie_token)

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token in _ACTIVE_TOKENS:
            _ACTIVE_TOKENS.remove(token)

    response.delete_cookie("onetrainer_session")
    return {"status": "ok", "authenticated": False}
