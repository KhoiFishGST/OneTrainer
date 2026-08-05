import json
from pathlib import Path

from modules.api.rest.errors import InvalidConfigError
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig

DEFAULT_SECRETS_PATH = "secrets.json"


def resolve_config(
        config: dict | None = None,
        config_path: str | None = None,
        preset_path: str | None = None,
        config_values: list[str] | None = None,
        secrets_path: str | None = None,
) -> TrainConfig:
    """Assemble a TrainConfig the same way scripts/train.py does.

    Order is preset -> config -> overrides, matching the CLI exactly so the two
    entry points can never disagree about what a given set of inputs means.
    Secrets are always resolved server-side from a path; they are never accepted
    in a request body.
    """
    if (config is None) == (config_path is None):
        raise InvalidConfigError("Provide exactly one of 'config' or 'config_path'")

    if config is not None and "secrets" in config:
        raise InvalidConfigError(
            "Inline secrets are not accepted. Use 'secrets_path' to point at a secrets file."
        )

    train_config = TrainConfig.default_values()

    if preset_path is not None:
        _apply_document(train_config, _read_json(preset_path, "preset"), migrate=False)

    document = config if config is not None else _read_json(config_path, "config")
    _apply_document(train_config, document, migrate=preset_path is None)

    for config_value in config_values or []:
        _apply_override(train_config, config_value)

    train_config.secrets = _load_secrets(secrets_path)
    return train_config


def _read_json(path: str, label: str) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise InvalidConfigError(f"{label} file not found: {path}") from None
    except json.JSONDecodeError as e:
        raise InvalidConfigError(f"{label} file is not valid JSON: {path} ({e})") from e


def _apply_document(train_config: TrainConfig, document: dict, migrate: bool) -> None:
    try:
        train_config.from_dict(document, migrate=migrate)
    except Exception as e:
        raise InvalidConfigError(f"Invalid config: {e}") from e


def _apply_override(train_config: TrainConfig, config_value: str) -> None:
    key, separator, value = config_value.partition("=")
    if not separator:
        raise InvalidConfigError(f"Override must be KEY=VALUE: {config_value!r}")

    if key == "secrets" or key.startswith("secrets."):
        raise InvalidConfigError(
            "Overrides may not set 'secrets'. Use 'secrets_path' to point at a secrets file."
        )

    *parent_keys, leaf_key = key.split(".")

    try:
        target = train_config
        for parent_key in parent_keys:
            target = getattr(target, parent_key)
        # Subscript, not .get(): an unknown key must raise KeyError here so the
        # handler below turns it into a 422. BaseConfig.from_dict iterates its
        # own schema rather than the incoming data, so a key it does not know is
        # silently ignored -- which would accept a typo'd override and train for
        # hours with the wrong config. scripts/train.py:34 subscripts too.
        if target.types[leaf_key] is bool:
            value = value.lower() in ("true", "1", "yes")
        target.from_dict({leaf_key: value}, migrate=False)
    except Exception as e:
        raise InvalidConfigError(f"Invalid override {config_value!r}: {e}") from e


def _load_secrets(secrets_path: str | None) -> SecretsConfig:
    explicit = secrets_path is not None
    path = Path(secrets_path or DEFAULT_SECRETS_PATH)
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        if explicit:
            raise InvalidConfigError(f"secrets file not found: {path}") from None
        return SecretsConfig.default_values()
    except json.JSONDecodeError as e:
        raise InvalidConfigError(f"secrets file is not valid JSON: {path} ({e})") from e
    return SecretsConfig.default_values().from_dict(document)
