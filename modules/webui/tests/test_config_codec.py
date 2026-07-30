from copy import deepcopy
from pathlib import Path

from modules.util.config.config_io import load_train_config
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_codec import SettingsDocumentError, decode_settings_document

import pytest


def valid_document() -> dict:
    return TrainConfig.default_values().to_settings_dict(secrets=False)


def test_decode_rejects_unknown_nested_field():
    document = valid_document()
    document["optimizer"]["unknown"] = 1
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert error.value.issues == [("optimizer.unknown", "Unknown field")]


@pytest.mark.parametrize(
    ("path", "value", "message"),
    [
        ("tensorboard_port", True, "Expected integer"),
        ("workspace_dir", None, "Value is not nullable"),
        ("training_method", "NOT_A_METHOD", "Unknown enum value"),
        ("learning_rate", float("nan"), "Expected finite number"),
    ],
)
def test_decode_rejects_invalid_scalars(path, value, message):
    document = valid_document()
    document[path] = value
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert error.value.issues == [(path, message)]


def test_decode_requires_complete_current_document():
    document = valid_document()
    del document["workspace_dir"]
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert error.value.issues == [("workspace_dir", "Missing field")]


def test_decode_preserves_server_secrets_without_mutating_input():
    document = valid_document()
    original = deepcopy(document)
    secrets = SecretsConfig.default_values()
    secrets.huggingface_token = "server-only"
    decoded = decode_settings_document(document, secrets)
    assert decoded.secrets.huggingface_token == "server-only"
    assert document == original


def test_decode_rejects_malformed_list_elements():
    document = valid_document()
    document["additional_embeddings"] = ["not_an_object"]
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert ("additional_embeddings.0", "Expected object") in error.value.issues

    document = valid_document()
    document["scheduler_params"] = [123]
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert ("scheduler_params.0", "Expected object") in error.value.issues

    document = valid_document()
    document["scheduler_params"] = [{"param_key": 123}]
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert ("scheduler_params.0.param_key", "Expected string") in error.value.issues


def test_decode_rejects_malformed_dictionary_values():
    document = valid_document()
    document["optimizer_defaults"] = {"adam": "not_an_object"}
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert ("optimizer_defaults.adam", "Expected object") in error.value.issues


def test_decode_default_train_config_roundtrip():
    document = valid_document()
    secrets = SecretsConfig.default_values()
    decoded = decode_settings_document(document, secrets)
    assert isinstance(decoded, TrainConfig)


def test_decode_all_builtin_presets_roundtrip():
    preset_files = list(Path("training_presets").rglob("#*.json"))
    assert len(preset_files) > 0, "No preset files found"
    secrets = SecretsConfig.default_values()

    for preset_path in preset_files:
        if preset_path.name == "#.json":
            continue
        config = load_train_config(preset_path)
        assert config is not None, f"Failed to load preset {preset_path}"
        document = config.to_settings_dict(secrets=False)
        decoded = decode_settings_document(document, secrets)
        assert isinstance(decoded, TrainConfig)
