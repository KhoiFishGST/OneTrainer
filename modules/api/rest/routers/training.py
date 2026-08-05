from modules.api.rest.config_source import resolve_config
from modules.api.rest.errors import InvalidConfigError
from modules.api.rest.models import ConfigSource, SampleRequest
from modules.api.rest.service import TrainingService
from modules.util.config.SampleConfig import SampleConfig

from fastapi import APIRouter, Request, status

router = APIRouter(prefix="/training")

# Handlers are plain `def`, not `async def`: FastAPI runs them in a threadpool,
# so the config file reads here never block the event loop.


def _service(request: Request) -> TrainingService:
    return request.app.state.training


@router.get("/status")
def get_status(request: Request) -> dict:
    return _service(request).status()


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
def start(request: Request, body: ConfigSource) -> dict:
    config = resolve_config(
        config=body.config,
        config_path=body.config_path,
        preset_path=body.preset_path,
        config_values=body.config_values,
        secrets_path=body.secrets_path,
    )
    run_id = _service(request).start(config)
    return {"run_id": run_id, "state": "starting"}


@router.post("/stop", status_code=status.HTTP_202_ACCEPTED)
def stop(request: Request) -> dict:
    _service(request).stop()
    return {"accepted": True}


@router.post("/sample", status_code=status.HTTP_202_ACCEPTED)
def sample(request: Request, body: SampleRequest | None = None) -> dict:
    sample_config = None
    if body is not None and body.sample is not None:
        try:
            sample_config = SampleConfig.default_values().from_dict(body.sample)
        except Exception as e:
            raise InvalidConfigError(f"Invalid sample config: {e}") from e
    _service(request).sample(sample_config)
    return {"accepted": True}


@router.post("/backup", status_code=status.HTTP_202_ACCEPTED)
def backup(request: Request) -> dict:
    _service(request).backup()
    return {"accepted": True}


@router.post("/save", status_code=status.HTTP_202_ACCEPTED)
def save(request: Request) -> dict:
    _service(request).save()
    return {"accepted": True}
