from modules.util.config.TrainConfig import TrainConfig

from fastapi import APIRouter

router = APIRouter(prefix="/config")


@router.get("/defaults")
def defaults() -> dict:
    # to_settings_dict(secrets=False) is the existing secrets-stripping
    # serializer, so the no-secrets guarantee is enforced by core code.
    return TrainConfig.default_values().to_settings_dict(secrets=False)
