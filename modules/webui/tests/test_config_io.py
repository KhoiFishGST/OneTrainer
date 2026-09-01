import json

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_io import load_preset_tree, load_train_config, save_named_preset, save_settings


def test_save_and_load_settings_preserves_external_secrets(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = TrainConfig.default_values()
    config.workspace_dir = "workspace/custom"
    config.secrets.huggingface_token = "server-token"
    save_settings(config, tmp_path / "training_presets" / "#.json")
    (tmp_path / "secrets.json").write_text(json.dumps({"huggingface_token": "loaded-token"}), encoding="utf-8")

    loaded = load_train_config(tmp_path / "training_presets" / "#.json", tmp_path / "secrets.json")

    assert loaded is not None
    assert loaded.workspace_dir == "workspace/custom"
    assert loaded.secrets.huggingface_token == "loaded-token"
    assert "secrets" not in json.loads((tmp_path / "training_presets" / "#.json").read_text(encoding="utf-8"))


def test_preset_tree_excludes_last_session_and_user_files(tmp_path):
    presets = tmp_path / "training_presets"
    (presets / "sdxl").mkdir(parents=True)
    (presets / "#.json").write_text("{}", encoding="utf-8")
    (presets / "#base.json").write_text("{}", encoding="utf-8")
    (presets / "user.json").write_text("{}", encoding="utf-8")
    (presets / "sdxl" / "#lora.json").write_text("{}", encoding="utf-8")

    assert load_preset_tree(presets) == [
        ("#base", str(presets / "#base.json").replace("\\", "/")),
        ("sdxl", [("#lora", str(presets / "sdxl" / "#lora.json").replace("\\", "/"))]),
    ]


def test_preset_tree_can_include_user_files(tmp_path):
    presets = tmp_path / "training_presets"
    presets.mkdir()
    (presets / "#.json").write_text("{}", encoding="utf-8")
    (presets / "user.json").write_text("{}", encoding="utf-8")
    assert load_preset_tree(presets) == []
    assert load_preset_tree(presets, include_user_files=True) == [
        ("user", str(presets / "user.json").replace("\\", "/")),
    ]


def test_named_preset_sanitizes_name(tmp_path):
    path = save_named_preset(TrainConfig.default_values(), "unsafe:/ name", tmp_path)
    assert path.name == "unsafe name.json"
    assert path.parent == tmp_path
