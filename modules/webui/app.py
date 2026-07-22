from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from modules.webui.config_service import ConfigService
from modules.webui.directories import DirectoryService
from modules.webui.presets import PresetService
from modules.webui.routers.config import router as config_router
from modules.webui.routers.directories import router as directories_router
from modules.webui.routers.meta import router as meta_router
from modules.webui.routers.presets import router as presets_router
from modules.webui.schema import SchemaRegistry
from modules.webui.state import AppState, WebUISettings

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class HTTP413Exception(Exception):
    pass


MAX_BODY_SIZE = 1_048_576  # 1 MiB


class LimitUploadSizeMiddleware:
    def __init__(self, app: ASGIApp, max_body_size: int = MAX_BODY_SIZE):
        self.app = app
        self.max_body_size = max_body_size

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > self.max_body_size:
                    response = JSONResponse(
                        {"detail": "Payload too large"},
                        status_code=413,
                    )
                    await response(scope, receive, send)
                    return
            except ValueError:
                pass

        total_bytes = 0

        async def custom_receive() -> Message:
            nonlocal total_bytes
            message = await receive()
            if message["type"] == "http.request":
                body = message.get("body", b"")
                total_bytes += len(body)
                if total_bytes > self.max_body_size:
                    raise HTTP413Exception
            return message

        try:
            await self.app(scope, custom_receive, send)
        except HTTP413Exception:
            response = JSONResponse(
                {"detail": "Payload too large"},
                status_code=413,
            )
            await response(scope, receive, send)


def create_app(settings: WebUISettings, capture=None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        config_svc = ConfigService.load(settings)
        schema_reg = SchemaRegistry()
        preset_svc = PresetService(settings.presets_dir, settings.secrets_path)
        directory_svc = DirectoryService()
        app.state.webui = AppState(
            settings=settings,
            config=config_svc,
            schema=schema_reg,
            presets=preset_svc,
            directories=directory_svc,
        )
        yield

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(LimitUploadSizeMiddleware)

    app.include_router(config_router, prefix="/api")
    app.include_router(meta_router, prefix="/api")
    app.include_router(presets_router, prefix="/api")
    app.include_router(directories_router, prefix="/api")

    return app
