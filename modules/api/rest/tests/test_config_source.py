import json

from modules.api.rest.config_source import resolve_config
from modules.api.rest.errors import InvalidConfigError
from modules.util.config.TrainConfig import TrainConfig

import pytest


def _document() -> dict:
    return TrainConfig.default_values().to_settings_dict(secrets=False)


def test_inline_config_is_loaded():
    document = _document()
    document["workspace_dir"] = "workspace/inline"
    assert resolve_config(config=document).workspace_dir == "workspace/inline"


def test_config_path_is_loaded(tmp_path):
    document = _document()
    document["workspace_dir"] = "workspace/from-disk"
    path = tmp_path / "run.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    assert resolve_config(config_path=str(path)).workspace_dir == "workspace/from-disk"


def test_neither_config_nor_path_is_rejected():
    with pytest.raises(InvalidConfigError, match="exactly one"):
        resolve_config()


def test_both_config_and_path_is_rejected(tmp_path):
    with pytest.raises(InvalidConfigError, match="exactly one"):
        resolve_config(config=_document(), config_path=str(tmp_path / "run.json"))


def test_missing_config_file_is_a_config_error(tmp_path):
    with pytest.raises(InvalidConfigError, match="not found"):
        resolve_config(config_path=str(tmp_path / "absent.json"))


def test_malformed_config_file_is_a_config_error(tmp_path):
    path = tmp_path / "run.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(InvalidConfigError, match="valid JSON"):
        resolve_config(config_path=str(path))


def test_inline_secrets_are_rejected():
    # The API never accepts credentials over the wire; they resolve server-side.
    document = _document()
    document["secrets"] = {"huggingface_token": "hf_leak"}
    with pytest.raises(InvalidConfigError, match="[Ss]ecrets"):
        resolve_config(config=document)


def test_config_value_overrides_are_applied():
    config = resolve_config(config=_document(), config_values=["workspace_dir=workspace/override"])
    assert config.workspace_dir == "workspace/override"


def test_config_value_override_coerces_booleans():
    config = resolve_config(config=_document(), config_values=["multi_gpu=true"])
    assert config.multi_gpu is True


def test_config_value_override_reaches_nested_config_objects():
    config = resolve_config(config=_document(), config_values=["cloud.enabled=true"])
    assert config.cloud.enabled is True


def test_config_value_override_without_equals_is_rejected():
    with pytest.raises(InvalidConfigError, match="KEY=VALUE"):
        resolve_config(config=_document(), config_values=["workspace_dir"])


def test_config_value_override_cannot_set_secrets():
    # Closes the second door: without this, an override list smuggles a
    # credential past the inline-secrets rejection above.
    with pytest.raises(InvalidConfigError, match="[Ss]ecrets"):
        resolve_config(config=_document(), config_values=["secrets.huggingface_token=hf_leak"])
    with pytest.raises(InvalidConfigError, match="[Ss]ecrets"):
        resolve_config(config=_document(), config_values=["secrets=leak"])


def test_preset_is_applied_before_config(tmp_path):
    # The preset sets both fields; the config overrides only one, so cache_dir
    # surviving from the preset is what proves the ordering.
    preset = _document()
    preset["workspace_dir"] = "workspace/from-preset"
    preset["cache_dir"] = "cache/from-preset"
    preset_path = tmp_path / "#preset.json"
    preset_path.write_text(json.dumps(preset), encoding="utf-8")

    config_document = _document()
    config_document["workspace_dir"] = "workspace/from-config"
    del config_document["cache_dir"]

    config = resolve_config(config=config_document, preset_path=str(preset_path))
    assert config.workspace_dir == "workspace/from-config"
    assert config.cache_dir == "cache/from-preset"


def test_secrets_load_from_the_given_path(tmp_path):
    secrets_path = tmp_path / "secrets.json"
    secrets_path.write_text(json.dumps({"huggingface_token": "hf_test"}), encoding="utf-8")
    config = resolve_config(config=_document(), secrets_path=str(secrets_path))
    assert config.secrets.huggingface_token == "hf_test"


def test_explicitly_named_missing_secrets_file_is_an_error(tmp_path):
    # Mirrors scripts/train.py: an explicit --secrets-path that does not exist raises.
    with pytest.raises(InvalidConfigError, match="secrets"):
        resolve_config(config=_document(), secrets_path=str(tmp_path / "absent.json"))


def test_missing_default_secrets_file_is_tolerated(tmp_path, monkeypatch):
    # Also mirrors scripts/train.py: the implicit secrets.json may be absent.
    monkeypatch.chdir(tmp_path)
    config = resolve_config(config=_document())
    assert config.secrets.huggingface_token == ""
