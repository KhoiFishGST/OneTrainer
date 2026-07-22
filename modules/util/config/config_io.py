import json
from contextlib import suppress
from pathlib import Path

from modules.util import path_util
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.path_util import write_json_atomic


def load_preset_tree(
    directory: str | Path = "training_presets",
    include_user_files: bool = False,
) -> list[tuple[str, str | list]]:
    # include_user_files=False mirrors the native top bar (built-in "#" presets only);
    # the web PresetService passes True to also list web-saved user presets.
    directory = Path(directory)
    nodes: list[tuple[str, str | list]] = []
    if not directory.is_dir():
        return nodes
    for entry in sorted(directory.iterdir(), key=lambda item: item.name.lower()):
        if entry.is_dir():
            children = load_preset_tree(entry, include_user_files)
            if children:
                nodes.append((entry.name, children))
        elif entry.suffix == ".json" and entry.name != "#.json" \
                and (include_user_files or entry.name.startswith("#")):
            nodes.append((entry.stem, str(entry).replace("\\", "/")))
    return nodes


def load_secrets(path: str | Path = "secrets.json") -> SecretsConfig | None:
    with suppress(FileNotFoundError):
        secret_dict = json.loads(Path(path).read_text(encoding="utf-8"))
        return SecretsConfig.default_values().from_dict(secret_dict)
    return None


def load_train_config(config_path: str | Path, secrets_path: str | Path = "secrets.json") -> TrainConfig | None:
    config_path = Path(config_path)
    try:
        loaded_dict = json.loads(config_path.read_text(encoding="utf-8"))
        is_builtin = config_path.name.startswith("#") and config_path.name != "#.json"
        loaded = TrainConfig.default_values().from_dict(loaded_dict, migrate=not is_builtin).to_unpacked_config()
        secrets = load_secrets(secrets_path)
        if secrets is not None:
            loaded.secrets = secrets
        return loaded
    except FileNotFoundError:
        return None


def save_settings(config: TrainConfig, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json_atomic(str(path), config.to_settings_dict(secrets=False))
    return path


def save_named_preset(config: TrainConfig, name: str, directory: str | Path = "training_presets") -> Path:
    safe_name = path_util.safe_filename(name)
    if not safe_name:
        raise ValueError("Preset name is empty after sanitization")
    return save_settings(config, Path(directory) / f"{safe_name}.json")


def save_secrets(config: TrainConfig, path: str | Path = "secrets.json") -> Path:
    path = Path(path)
    write_json_atomic(str(path), config.secrets.to_dict())
    return path
