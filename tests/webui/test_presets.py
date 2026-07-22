import json

import pytest

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_service import ConfigSnapshot
from modules.webui.presets import PresetService, UnknownPreset


def test_tree_returns_opaque_ids_and_loads_only_listed_entries(tmp_path):
    presets = tmp_path / "training_presets"
    presets.mkdir()
    document = TrainConfig.default_values().to_settings_dict(secrets=False)
    (presets / "#base.json").write_text(json.dumps(document), encoding="utf-8")
    service = PresetService(presets, tmp_path / "secrets.json")
    tree = service.tree()
    preset_id = tree[0]["id"]
    assert "/" not in preset_id and "\\" not in preset_id
    assert service.load(preset_id).workspace_dir == "workspace/run"
    with pytest.raises(UnknownPreset):
        service.load("Li4vc2VjcmV0cy5qc29u")


def test_save_uses_canonical_snapshot_and_refreshes_tree(tmp_path):
    service = PresetService(tmp_path / "training_presets", tmp_path / "secrets.json")
    document = TrainConfig.default_values().to_settings_dict(secrets=False)
    path = service.save("my preset", ConfigSnapshot(document, "instance:1"))
    assert path == "my preset.json"
    assert service.tree()[0]["label"] == "my preset"


def test_save_rejects_names_starting_with_hash_or_empty(tmp_path):
    service = PresetService(tmp_path / "training_presets", tmp_path / "secrets.json")
    document = TrainConfig.default_values().to_settings_dict(secrets=False)
    snapshot = ConfigSnapshot(document, "instance:1")

    with pytest.raises(ValueError, match="cannot start with"):
        service.save("#forbidden", snapshot)

    with pytest.raises(ValueError, match="empty after sanitization"):
        service.save("???", snapshot)


def test_tree_supports_nested_directories(tmp_path):
    presets = tmp_path / "training_presets"
    sub_dir = presets / "subfolder"
    sub_dir.mkdir(parents=True)
    document = TrainConfig.default_values().to_settings_dict(secrets=False)
    (sub_dir / "#nested.json").write_text(json.dumps(document), encoding="utf-8")

    service = PresetService(presets, tmp_path / "secrets.json")
    tree = service.tree()
    assert len(tree) == 1
    assert tree[0]["label"] == "subfolder"
    assert "children" in tree[0]
    assert tree[0]["children"][0]["label"] == "#nested"
    leaf_id = tree[0]["children"][0]["id"]
    loaded = service.load(leaf_id)
    assert loaded is not None
