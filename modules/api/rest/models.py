from typing import Any

from pydantic import BaseModel, ConfigDict


class ConfigSource(BaseModel):
    """Where a run's config comes from. Mirrors scripts/train.py's arguments.

    Exactly one of config / config_path must be given; that rule and the
    secrets rules are enforced in config_source.resolve_config.
    """

    # Unknown fields are an error rather than silently dropped. A body carrying
    # a top-level "secrets" block should be told no, not quietly ignored, and a
    # misspelled field name should fail loudly instead of taking a default.
    model_config = ConfigDict(extra="forbid")

    config: dict[str, Any] | None = None
    config_path: str | None = None
    preset_path: str | None = None
    config_values: list[str] | None = None
    secrets_path: str | None = None


class SampleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sample: dict[str, Any] | None = None
