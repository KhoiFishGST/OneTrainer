import json

from modules.api.rest.ApiError import InvalidConfigError
from modules.api.rest.ConfigSource import ConfigSource
from modules.util.config.TrainConfig import TrainConfig

import pytest


def _document() -> dict:
    return TrainConfig.default_values().to_settings_dict(secrets=False)


def test_inline_config_is_loaded():
    document = _document()
    document["workspace_dir"] = "workspace/inline"
    assert ConfigSource(config=document).resolve().workspace_dir == "workspace/inline"


def test_config_path_is_loaded(tmp_path):
    document = _document()
    document["workspace_dir"] = "workspace/from-disk"
    path = tmp_path / "run.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    assert ConfigSource(config_path=str(path)).resolve().workspace_dir == "workspace/from-disk"


def test_neither_config_nor_path_is_rejected():
    with pytest.raises(InvalidConfigError, match="exactly one"):
        ConfigSource().resolve()


def test_both_config_and_path_is_rejected(tmp_path):
    with pytest.raises(InvalidConfigError, match="exactly one"):
        ConfigSource(config=_document(), config_path=str(tmp_path / "run.json")).resolve()


def test_missing_config_file_is_a_config_error(tmp_path):
    with pytest.raises(InvalidConfigError, match="not found"):
        ConfigSource(config_path=str(tmp_path / "absent.json")).resolve()


def test_malformed_config_file_is_a_config_error(tmp_path):
    path = tmp_path / "run.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(InvalidConfigError, match="valid JSON"):
        ConfigSource(config_path=str(path)).resolve()


def test_inline_secrets_are_rejected():
    # The API never accepts credentials over the wire; they resolve server-side.
    document = _document()
    document["secrets"] = {"huggingface_token": "hf_leak"}
    with pytest.raises(InvalidConfigError, match="[Ss]ecrets"):
        ConfigSource(config=document).resolve()


def test_config_value_overrides_are_applied():
    config = ConfigSource(config=_document(), config_values=["workspace_dir=workspace/override"]).resolve()
    assert config.workspace_dir == "workspace/override"


def test_config_value_override_coerces_booleans():
    config = ConfigSource(config=_document(), config_values=["multi_gpu=true"]).resolve()
    assert config.multi_gpu is True


def test_config_value_override_reaches_nested_config_objects():
    config = ConfigSource(config=_document(), config_values=["cloud.enabled=true"]).resolve()
    assert config.cloud.enabled is True


def test_config_value_override_without_equals_is_rejected():
    with pytest.raises(InvalidConfigError, match="KEY=VALUE"):
        ConfigSource(config=_document(), config_values=["workspace_dir"]).resolve()


def test_unknown_top_level_override_key_is_rejected():
    # BaseConfig.from_dict iterates its own schema, not the incoming data, so an
    # unknown key is a silent no-op there. Catching it here is what stops a
    # typo'd override from being accepted and training for hours with the wrong
    # config -- and it matches scripts/train.py, which raises on the same input.
    with pytest.raises(InvalidConfigError, match="epocs"):
        ConfigSource(config=_document(), config_values=["epocs=10"]).resolve()


def test_unknown_nested_override_key_is_rejected():
    with pytest.raises(InvalidConfigError, match="enabld"):
        ConfigSource(config=_document(), config_values=["cloud.enabld=true"]).resolve()


def test_unknown_override_parent_is_rejected():
    with pytest.raises(InvalidConfigError, match="clod"):
        ConfigSource(config=_document(), config_values=["clod.enabled=true"]).resolve()


def test_config_value_override_cannot_set_secrets():
    # Closes the second door: without this, an override list smuggles a
    # credential past the inline-secrets rejection above.
    with pytest.raises(InvalidConfigError, match="[Ss]ecrets"):
        ConfigSource(config=_document(), config_values=["secrets.huggingface_token=hf_leak"]).resolve()
    with pytest.raises(InvalidConfigError, match="[Ss]ecrets"):
        ConfigSource(config=_document(), config_values=["secrets=leak"]).resolve()


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

    config = ConfigSource(config=config_document, preset_path=str(preset_path)).resolve()
    assert config.workspace_dir == "workspace/from-config"
    assert config.cache_dir == "cache/from-preset"


def test_secrets_load_from_the_given_path(tmp_path):
    secrets_path = tmp_path / "secrets.json"
    secrets_path.write_text(json.dumps({"huggingface_token": "hf_test"}), encoding="utf-8")
    config = ConfigSource(config=_document(), secrets_path=str(secrets_path)).resolve()
    assert config.secrets.huggingface_token == "hf_test"


def test_explicitly_named_missing_secrets_file_is_an_error(tmp_path):
    # Mirrors scripts/train.py: an explicit --secrets-path that does not exist raises.
    with pytest.raises(InvalidConfigError, match="secrets"):
        ConfigSource(config=_document(), secrets_path=str(tmp_path / "absent.json")).resolve()


def test_missing_default_secrets_file_is_tolerated(tmp_path, monkeypatch):
    # Also mirrors scripts/train.py: the implicit secrets.json may be absent.
    monkeypatch.chdir(tmp_path)
    config = ConfigSource(config=_document()).resolve()
    assert config.secrets.huggingface_token == ""
