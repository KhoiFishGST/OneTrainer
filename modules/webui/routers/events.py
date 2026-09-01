from urllib.parse import urlparse

from modules.webui.state import AppState, WebUISettings

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder

router = APIRouter()


def is_origin_allowed(origin: str | None, host: str | None, settings: WebUISettings) -> bool:
    if settings.dev and origin == settings.allowed_dev_origin:
        return True

    if not origin or not host:
        return False

    parsed_origin = urlparse(origin)
    origin_host = parsed_origin.hostname
    if not origin_host:
        return False
    origin_port = parsed_origin.port or (
        80 if parsed_origin.scheme in ("http", "ws") else 443 if parsed_origin.scheme in ("https", "wss") else None
    )

    if ":" in host:
        host_name, host_port_str = host.split(":", 1)
        try:
            host_port = int(host_port_str)
        except ValueError:
            return False
    else:
        host_name = host
        host_port = 80 if parsed_origin.scheme in ("http", "ws") else 443

    return origin_host == host_name and origin_port == host_port


@router.get("/events/backlog")
async def get_backlog(request: Request):
    app_state: AppState = request.app.state.webui
    return await app_state.events.backlog()


@router.websocket("/events")
async def websocket_events(websocket: WebSocket):
    app_state: AppState = websocket.app.state.webui
    headers = dict(websocket.headers)
    origin = headers.get("origin")
    host = headers.get("host")

    if not is_origin_allowed(origin, host, app_state.settings):
        await websocket.close(code=1008)
        return

    from modules.webui.routers.auth import is_authenticated
    if not is_authenticated(websocket, app_state):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    sub = app_state.events.subscribe()
    try:
        async for event in sub:
            try:
                await websocket.send_json(jsonable_encoder(event))
            except (WebSocketDisconnect, RuntimeError):
                break
    finally:
        await sub.aclose()
