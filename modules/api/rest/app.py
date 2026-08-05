import subprocess
from pathlib import Path

from modules.api.rest.errors import ApiError, error_envelope
from modules.api.rest.routers import config as config_router
from modules.api.rest.routers import health as health_router
from modules.api.rest.service import TrainingService

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def resolve_version(root_dir: Path) -> str:
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=root_dir,
            capture_output=True,
            text=True,
            timeout=2.0,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except Exception:
        return "unknown"
    return "unknown"


def create_app(
    root_dir: Path | None = None,
    training_service: TrainingService | None = None,
    version: str | None = None,
) -> FastAPI:
    """Build the REST app.

    Transport-agnostic on purpose: this binds nothing and knows nothing about
    hosts or ports. scripts/train_server.py is what pins it to 127.0.0.1, which
    is also what lets another server mount this app under its own rules.
    """
    root_dir = Path(root_dir) if root_dir is not None else Path.cwd()

    app = FastAPI(title="OneTrainer REST API", redoc_url=None)
    app.state.training = training_service if training_service is not None else TrainingService()
    app.state.version = version if version is not None else resolve_version(root_dir)

    @app.exception_handler(ApiError)
    def _handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_envelope(exc.error_type, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    def _handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Override FastAPI's default 422 body so a client only ever parses one
        # error shape.
        return JSONResponse(
            status_code=422,
            content=error_envelope(
                "invalid_config",
                "Request body is invalid",
                {"errors": jsonable_encoder(exc.errors())},
            ),
        )

    app.include_router(health_router.router)
    app.include_router(config_router.router)
    return app
