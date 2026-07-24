import pytest
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.schema import SchemaRegistry

DEPRECATED_OR_INTERNAL = {
    "version", "config_version", "saved_version", "optimizer_defaults", "concept_file_name", "concepts", "datasets_dir"
}

def test_all_train_config_fields_covered():
    config_field_names = set(TrainConfig.default_values().types.keys()) - DEPRECATED_OR_INTERNAL
    schema_field_names = set(SchemaRegistry.get_all_field_names())
    missing = config_field_names - schema_field_names
    assert not missing, f"TrainConfig fields missing from SchemaRegistry: {missing}"
