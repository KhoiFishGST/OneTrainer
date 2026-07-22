import base64
import secrets
from pathlib import Path

from modules.util import path_util
from modules.util.config.config_io import load_preset_tree, load_train_config, save_named_preset
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_codec import decode_settings_document
from modules.webui.config_service import ConfigSnapshot


class UnknownPreset(Exception):
    pass


class PresetService:
    def __init__(self, presets_dir: str | Path, secrets_path: str | Path):
        self.presets_dir = Path(presets_dir)
        self.secrets_path = Path(secrets_path)
        self._nonce = secrets.token_bytes(16)
        self._id_map: dict[str, Path] = {}

    def tree(self) -> list[dict]:
        self._id_map.clear()
        nodes = load_preset_tree(self.presets_dir, include_user_files=True)
        return self._format_nodes(nodes)

    def _format_nodes(self, nodes: list[tuple[str, str | list]]) -> list[dict]:
        result = []
        for label, content in nodes:
            if isinstance(content, list):
                result.append({
                    "label": label,
                    "children": self._format_nodes(content),
                })
            else:
                file_path = Path(content)
                try:
                    rel_path = file_path.relative_to(self.presets_dir)
                except ValueError:
                    rel_path = file_path
                rel_str = str(rel_path).replace("\\", "/")
                raw_id = self._nonce + rel_str.encode("utf-8")
                preset_id = base64.urlsafe_b64encode(raw_id).decode("ascii").rstrip("=")
                self._id_map[preset_id] = file_path
                result.append({
                    "label": label,
                    "id": preset_id,
                })
        return result

    def load(self, preset_id: str) -> TrainConfig:
        if preset_id not in self._id_map:
            self.tree()
        file_path = self._id_map.get(preset_id)
        if file_path is None:
            raise UnknownPreset(f"Unknown preset ID: {preset_id}")
        config = load_train_config(file_path, self.secrets_path)
        if config is None:
            raise UnknownPreset(f"Could not load preset at {file_path}")
        return config

    def save(self, name: str, snapshot: ConfigSnapshot) -> str:
        safe_name = path_util.safe_filename(name)
        if not safe_name:
            raise ValueError("Preset name is empty after sanitization")
        if name.strip().startswith("#") or safe_name.startswith("#"):
            raise ValueError("Preset name cannot start with '#'")

        default_secrets = SecretsConfig.default_values()
        config = decode_settings_document(snapshot.config, default_secrets)
        saved_path = save_named_preset(config, safe_name, directory=self.presets_dir)
        self.tree()
        return saved_path.name
