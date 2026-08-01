import asyncio
import logging
import subprocess
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path


class QuietPollFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if any(ep in msg for ep in ("/api/events", "/api/training/gpu", "/api/console", "/api/auth/status")):
            if " 200 " in msg or " 304 " in msg or " 200" in msg or " 304" in msg:
                return False
        return True


logging.getLogger("uvicorn.access").addFilter(QuietPollFilter())

from modules.webui.compression import SelectiveGZipMiddleware
from modules.webui.config_service import ConfigService, ConfigSnapshot
from modules.webui.directories import DirectoryService
from modules.webui.events import EventHub, EventType
from modules.webui.gallery import GalleryService
from modules.webui.media import MediaService
from modules.webui.metrics_store import MetricsStore
from modules.webui.presets import PresetService
from modules.webui.routers.appearance import router as appearance_router
from modules.webui.routers.auth import router as auth_router
from modules.webui.routers.concepts import router as concepts_router
from modules.webui.routers.config import router as config_router
from modules.webui.routers.console import router as console_router
from modules.webui.routers.datasets import router as datasets_router
from modules.webui.routers.directories import router as directories_router
from modules.webui.routers.events import router as events_router
from modules.webui.routers.gallery import router as gallery_router
from modules.webui.routers.health import router as health_router
from modules.webui.routers.meta import router as meta_router
from modules.webui.routers.presets import router as presets_router
from modules.webui.routers.samples import router as samples_router
from modules.webui.routers.secrets import router as secrets_router
from modules.webui.routers.training import router as training_router
from modules.webui.runtime_patches import install_runtime_patches
from modules.webui.sampling_coordinator import SamplingCoordinator
from modules.webui.schema import SchemaRegistry
from modules.webui.settings_store import SettingsStore
from modules.webui.state import AppState, WebUISettings
from modules.webui.training import TrainingService

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class HTTP413Exception(Exception):
    pass


MAX_BODY_SIZE = 1_048_576  # 1 MiB
IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"


class LimitUploadSizeMiddleware:
    def __init__(self, app: ASGIApp, max_body_size: int = MAX_BODY_SIZE):
        self.app = app
        self.max_body_size = max_body_size

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if scope.get("path", "").startswith("/api/datasets/"):
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
    install_runtime_patches()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        config_svc = ConfigService.load(settings)
        schema_reg = SchemaRegistry()
        preset_svc = PresetService(settings.presets_dir, settings.secrets_path)
        directory_svc = DirectoryService()
        event_hub = EventHub()

        await event_hub.start()

        metrics_store = MetricsStore()
        gallery_svc = GalleryService(
            root_dir=settings.root_dir,
            workspace_provider=lambda: config_svc.current_workspace,
            warning_sink=lambda message, payload: event_hub.publish_from_thread(
                EventType.GALLERY_WARNING.value,
                {"message": message, **payload},
            ),
            run_resolved_sink=metrics_store.bind_run_dir,
        )
        sampling_svc = SamplingCoordinator(
            root_dir=settings.root_dir,
            sample_path_provider=lambda: config_svc.sample_definition_path,
            gallery=gallery_svc,
        )
        sampling_svc.recover_pending()
        training_svc = TrainingService(
            event_bus=event_hub,
            sampling_coordinator=sampling_svc,
            metrics_store=metrics_store,
        )
        media_svc = MediaService(root_dir=settings.root_dir)
        settings_store = SettingsStore(settings.root_dir / "webui.json")

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
            training=training_svc,
            gallery=gallery_svc,
            sampling=sampling_svc,
            media=media_svc,
            media_service=media_svc,
            store=settings_store,
        )

        try:
            yield
        finally:
            config_svc.remove_change_listener(on_config_change)
            sampling_svc.finish_training()
            await event_hub.close()

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(LimitUploadSizeMiddleware)

    from modules.webui.routers.auth import is_authenticated

    from fastapi.responses import JSONResponse

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        path = request.url.path
        public_endpoints = {
            "/api/auth/login",
            "/api/auth/status",
            "/api/health",
            "/login",
            "/favicon.ico",
            "/favicon.png",
            "/logo.png",
            "/icon.png",
        }
        if path in public_endpoints or path.startswith("/_app/"):
            return await call_next(request)

        state: AppState = getattr(request.app.state, "webui", None)
        if state is not None:
            if not is_authenticated(request, state):
                if path.startswith("/api/"):
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Authentication required"},
                    )
                index_file = settings.static_dir / "index.html"
                if not settings.dev and index_file.exists():
                    return RedirectResponse(url="/login", status_code=307)

        return await call_next(request)

    # Added last among request-path middleware so it wraps everything below it,
    # including auth redirects and the static file handler.
    app.add_middleware(SelectiveGZipMiddleware)

    if settings.dev:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.allowed_dev_origin],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(appearance_router, prefix="/api")
    app.include_router(config_router, prefix="/api")
    app.include_router(concepts_router, prefix="/api")
    app.include_router(datasets_router, prefix="/api")
    app.include_router(gallery_router, prefix="/api")
    app.include_router(meta_router, prefix="/api")
    app.include_router(presets_router, prefix="/api")
    app.include_router(directories_router, prefix="/api")
    app.include_router(console_router, prefix="/api")
    app.include_router(events_router, prefix="/api")
    app.include_router(training_router, prefix="/api")
    app.include_router(secrets_router, prefix="/api")
    app.include_router(samples_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")

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
                # Everything under _app/immutable has a content hash in its
                # filename, so it can never go stale.
                if rel_path.startswith("_app/immutable/"):
                    return FileResponse(target_path, headers={"cache-control": IMMUTABLE_CACHE_CONTROL})
                return FileResponse(target_path)

            if Path(rel_path).suffix != "":
                raise HTTPException(status_code=404, detail="Not Found")

            return FileResponse(index_file)

    return app
