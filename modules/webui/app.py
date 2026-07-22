import asyncio
import subprocess
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from modules.webui.config_service import ConfigService, ConfigSnapshot
from modules.webui.directories import DirectoryService
from modules.webui.events import EventHub
from modules.webui.presets import PresetService
from modules.webui.routers.config import router as config_router
from modules.webui.routers.console import router as console_router
from modules.webui.routers.directories import router as directories_router
from modules.webui.routers.events import router as events_router
from modules.webui.routers.health import router as health_router
from modules.webui.routers.meta import router as meta_router
from modules.webui.routers.presets import router as presets_router
from modules.webui.schema import SchemaRegistry
from modules.webui.state import AppState, WebUISettings

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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
        event_hub = EventHub()

        await event_hub.start()

        version = "unknown"
        try:
            proc = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=settings.root_dir,
                capture_output=True,
                text=True,
                timeout=2.0,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                version = proc.stdout.strip()
        except Exception:
            version = "unknown"

        if capture is not None:
            loop = asyncio.get_running_loop()
            snap = await config_svc.snapshot()
            workspace_dir = snap.config.get("workspace_dir")
            capture.attach(loop, event_hub, workspace_dir=workspace_dir)

        warnings = config_svc.warnings
        for w in warnings:
            sys.stderr.write(f"Warning: {w}\n")
            sys.stderr.flush()

        async def on_config_change(snapshot: ConfigSnapshot) -> None:
            await event_hub.publish("config_changed", {"revision": snapshot.revision})
            if capture is not None:
                workspace = snapshot.config.get("workspace_dir")
                if workspace:
                    capture.set_workspace(workspace)

        config_svc.add_change_listener(on_config_change)

        app.state.webui = AppState(
            settings=settings,
            config=config_svc,
            schema=schema_reg,
            presets=preset_svc,
            directories=directory_svc,
            events=event_hub,
            version=version,
            warnings=warnings,
            capture=capture,
        )

        try:
            yield
        finally:
            config_svc.remove_change_listener(on_config_change)
            await event_hub.close()

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(LimitUploadSizeMiddleware)

    if settings.dev:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.allowed_dev_origin],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(config_router, prefix="/api")
    app.include_router(meta_router, prefix="/api")
    app.include_router(presets_router, prefix="/api")
    app.include_router(directories_router, prefix="/api")
    app.include_router(console_router, prefix="/api")
    app.include_router(events_router, prefix="/api")

    index_file = settings.static_dir / "index.html"
    if not settings.dev and index_file.exists():
        static_root = settings.static_dir.resolve()

        @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
        async def serve_static_or_spa(full_path: str):
            if full_path.startswith("api/") or full_path == "api":
                raise HTTPException(status_code=404, detail="Not Found")

            rel_path = full_path.lstrip("/")
            if not rel_path:
                return FileResponse(index_file)

            try:
                target_path = (static_root / rel_path).resolve()
                target_path.relative_to(static_root)
            except (ValueError, RuntimeError) as err:
                raise HTTPException(status_code=400, detail="Invalid path") from err

            if target_path.is_file():
                return FileResponse(target_path)

            if Path(rel_path).suffix != "":
                raise HTTPException(status_code=404, detail="Not Found")

            return FileResponse(index_file)

    return app
