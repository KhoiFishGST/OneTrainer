from typing import Any

from pydantic import BaseModel


class ConfigSource(BaseModel):
    """Where a run's config comes from. Mirrors scripts/train.py's arguments.

    Exactly one of config / config_path must be given; that rule and the
    secrets rules are enforced in config_source.resolve_config.
    """

    config: dict[str, Any] | None = None
    config_path: str | None = None
    preset_path: str | None = None
    config_values: list[str] | None = None
    secrets_path: str | None = None


class SampleRequest(BaseModel):
    sample: dict[str, Any] | None = None
