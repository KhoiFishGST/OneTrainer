import os
from pathlib import Path

from modules.util.enum.ModelFormat import ModelFormat
from modules.webui.checkpoint_store import classify, link_or_copy, volume_key

import pytest


@pytest.mark.parametrize("model_format", [ModelFormat.INTERNAL])
def test_backups_are_never_captured(model_format, tmp_path):
    # INTERNAL is resume state: always a directory, often larger than the model,
    # and already pruned by OneTrainer's own rolling backup.
    destination = str(tmp_path / "workspace" / "backup" / "20260802-backup-1-0-100")

    assert classify(model_format, destination) is None


def test_files_written_under_the_save_directory_are_saves(tmp_path):
    destination = str(tmp_path / "workspace" / "save" / "20260802-save-1-0-100.safetensors")

    assert classify(ModelFormat.KOHYA_LORA, destination) == "save"


def test_anything_else_is_the_final_model(tmp_path):
    assert classify(ModelFormat.KOHYA_LORA, str(tmp_path / "models" / "model.safetensors")) == "final"
    assert classify(ModelFormat.DIFFUSERS, str(tmp_path / "out" / "my-model")) == "final"


def test_classification_is_case_insensitive_about_the_save_directory(tmp_path):
    destination = str(tmp_path / "workspace" / "Save" / "x.safetensors")

    assert classify(ModelFormat.KOHYA_LORA, destination) == "save"


def test_link_shares_the_inode_and_costs_no_extra_bytes(tmp_path):
    source = tmp_path / "a.safetensors"
    source.write_bytes(b"x" * 1024)
    destination = tmp_path / "linked.safetensors"

    linked = link_or_copy(source, destination)

    assert linked is True
    assert os.stat(source).st_ino == os.stat(destination).st_ino


def test_link_survives_deletion_of_the_original(tmp_path):
    # This is why deleting workspace/save/* alone reclaims no disk.
    source = tmp_path / "a.safetensors"
    source.write_bytes(b"x" * 1024)
    destination = tmp_path / "linked.safetensors"
    link_or_copy(source, destination)

    source.unlink()

    assert destination.read_bytes() == b"x" * 1024


def test_falls_back_to_a_real_copy_when_linking_is_not_allowed(tmp_path):
    source = tmp_path / "a.safetensors"
    source.write_bytes(b"x" * 1024)
    destination = tmp_path / "copied.safetensors"

    linked = link_or_copy(source, destination, allow_link=False)

    assert linked is False
    assert destination.read_bytes() == b"x" * 1024
    assert os.stat(source).st_ino != os.stat(destination).st_ino


def test_falls_back_to_a_copy_when_the_link_call_fails(tmp_path, monkeypatch):
    # Simulates EXDEV (cross-device) and FAT32/exFAT/network shares.
    source = tmp_path / "a.safetensors"
    source.write_bytes(b"x" * 1024)
    destination = tmp_path / "copied.safetensors"

    def boom(*args, **kwargs):
        raise OSError(18, "Invalid cross-device link")

    monkeypatch.setattr(os, "link", boom)

    linked = link_or_copy(source, destination)

    assert linked is False
    assert destination.read_bytes() == b"x" * 1024


def test_link_or_copy_creates_missing_parent_directories(tmp_path):
    source = tmp_path / "a.safetensors"
    source.write_bytes(b"x")
    destination = tmp_path / "deep" / "nested" / "a.safetensors"

    link_or_copy(source, destination)

    assert destination.is_file()


def test_volume_key_is_equal_for_paths_on_the_same_filesystem(tmp_path):
    a = tmp_path / "a"
    a.mkdir()
    b = tmp_path / "b"
    b.mkdir()

    assert volume_key(a) == volume_key(b)


def test_volume_key_of_a_missing_path_falls_back_to_its_nearest_parent(tmp_path):
    missing = tmp_path / "does" / "not" / "exist.safetensors"

    assert volume_key(missing) == volume_key(tmp_path)


import json

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.checkpoint_store import (
    CheckpointNotFound,
    CheckpointStore,
    MANIFEST_FILENAME,
)


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    (ws / "config").mkdir(parents=True)
    (ws / "save").mkdir(parents=True)
    return ws


@pytest.fixture
def store(tmp_path: Path, workspace: Path) -> CheckpointStore:
    return CheckpointStore(root_dir=tmp_path, workspace_provider=lambda: workspace)


@pytest.fixture
def train_config() -> TrainConfig:
    config = TrainConfig.default_values()
    config.save_filename_prefix = ""
    return config


def _start_run(store: CheckpointStore, workspace: Path, train_config: TrainConfig,
               run_key: str = "run-20260802-091500") -> str:
    """Begin a run and write the timestamped config GenericTrainer would write."""
    store.begin_training(train_config)
    (workspace / "config" / f"{run_key}.json").write_text("{}", encoding="utf-8")
    return run_key


def _checkpoint_dir(workspace: Path, run_key: str) -> Path:
    return workspace / "webui" / "checkpoints" / run_key


def _manifest(workspace: Path, run_key: str) -> dict:
    return json.loads((_checkpoint_dir(workspace, run_key) / MANIFEST_FILENAME).read_text(encoding="utf-8"))


def test_a_save_is_linked_into_the_run_directory_and_recorded(store, workspace, train_config):
    run_key = _start_run(store, workspace, train_config)
    source = workspace / "save" / "20260802-save-1-0-100.safetensors"
    source.write_bytes(b"weights")

    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    linked = _checkpoint_dir(workspace, run_key) / source.name
    assert linked.read_bytes() == b"weights"
    assert os.stat(linked).st_ino == os.stat(source).st_ino

    entries = _manifest(workspace, run_key)["checkpoints"]
    assert len(entries) == 1
    assert entries[0]["kind"] == "save"
    assert entries[0]["filename"] == source.name
    assert entries[0]["format"] == "KOHYA_LORA"
    assert entries[0]["is_directory"] is False
    assert entries[0]["size_bytes"] == len(b"weights")
    assert entries[0]["linked"] is True


def test_a_backup_is_not_captured(store, workspace, train_config):
    run_key = _start_run(store, workspace, train_config)
    backup = workspace / "backup" / "20260802-backup-1-0-100"
    backup.mkdir(parents=True)
    (backup / "state.pt").write_bytes(b"state")

    store.capture(ModelFormat.INTERNAL, str(backup))
    store.end_training()

    assert not _checkpoint_dir(workspace, run_key).exists()


def test_the_final_model_is_captured_as_kind_final(store, workspace, train_config, tmp_path):
    run_key = _start_run(store, workspace, train_config)
    final = tmp_path / "models" / "model.safetensors"
    final.parent.mkdir(parents=True)
    final.write_bytes(b"final")

    store.capture(ModelFormat.KOHYA_LORA, str(final))
    store.end_training()

    entries = _manifest(workspace, run_key)["checkpoints"]
    assert [e["kind"] for e in entries] == ["final"]


def test_a_directory_format_is_linked_file_by_file_with_a_summed_size(store, workspace, train_config, tmp_path):
    run_key = _start_run(store, workspace, train_config)
    tree = tmp_path / "out" / "my-model"
    (tree / "unet").mkdir(parents=True)
    (tree / "model_index.json").write_bytes(b"{}")
    (tree / "unet" / "weights.safetensors").write_bytes(b"y" * 500)

    store.capture(ModelFormat.DIFFUSERS, str(tree))
    store.end_training()

    copied = _checkpoint_dir(workspace, run_key) / "my-model"
    assert (copied / "model_index.json").read_bytes() == b"{}"
    assert (copied / "unet" / "weights.safetensors").read_bytes() == b"y" * 500

    entry = _manifest(workspace, run_key)["checkpoints"][0]
    assert entry["is_directory"] is True
    assert entry["size_bytes"] == 502


def test_a_name_collision_gets_a_numeric_suffix(store, workspace, train_config, tmp_path):
    run_key = _start_run(store, workspace, train_config)

    first = workspace / "save" / "model.safetensors"
    first.write_bytes(b"one")
    store.capture(ModelFormat.KOHYA_LORA, str(first))

    second = tmp_path / "elsewhere" / "model.safetensors"
    second.parent.mkdir(parents=True)
    second.write_bytes(b"two")
    store.capture(ModelFormat.KOHYA_LORA, str(second))
    store.end_training()

    names = [e["filename"] for e in _manifest(workspace, run_key)["checkpoints"]]
    assert names == ["model.safetensors", "model-2.safetensors"]


def test_link_failure_records_a_copy_without_disabling_same_volume_links(
    store, workspace, train_config, tmp_path, monkeypatch
):
    # The final model usually lands on another volume; that must not stop the
    # same-volume workspace/save entries around it from being linked.
    run_key = _start_run(store, workspace, train_config)

    cross_device = tmp_path / "elsewhere" / "final.safetensors"
    cross_device.parent.mkdir(parents=True)
    cross_device.write_bytes(b"final")

    import modules.webui.checkpoint_store as cs

    real_link = os.link
    real_volume_key = cs.volume_key

    def fake_volume_key(path):
        # Pretend anything under "elsewhere" is on a different filesystem.
        return "other" if "elsewhere" in str(path) else real_volume_key(path)

    def selective_link(src, dst):
        if "elsewhere" in str(src):
            raise OSError(18, "Invalid cross-device link")
        return real_link(src, dst)

    monkeypatch.setattr(cs, "volume_key", fake_volume_key)
    monkeypatch.setattr(os, "link", selective_link)

    store.capture(ModelFormat.KOHYA_LORA, str(cross_device))

    same_volume = workspace / "save" / "20260802-save-1-0-100.safetensors"
    same_volume.write_bytes(b"weights")
    store.capture(ModelFormat.KOHYA_LORA, str(same_volume))
    store.end_training()

    entries = {e["filename"]: e for e in _manifest(workspace, run_key)["checkpoints"]}
    assert entries["final.safetensors"]["linked"] is False
    assert entries["20260802-save-1-0-100.safetensors"]["linked"] is True


def test_capture_never_raises_when_the_run_key_cannot_be_resolved(store, workspace, train_config):
    # Two new candidates -> ambiguous. Capture must degrade, not explode.
    store.begin_training(train_config)
    (workspace / "config" / "a.json").write_text("{}", encoding="utf-8")
    (workspace / "config" / "b.json").write_text("{}", encoding="utf-8")

    source = workspace / "save" / "x.safetensors"
    source.write_bytes(b"weights")

    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    assert not (workspace / "webui").exists()


def test_capture_never_raises_when_the_source_disappeared(store, workspace, train_config):
    _start_run(store, workspace, train_config)

    store.capture(ModelFormat.KOHYA_LORA, str(workspace / "save" / "gone.safetensors"))
    store.end_training()


def test_a_checkpoint_we_could_not_store_is_still_listed_but_unavailable(
    store, workspace, train_config, monkeypatch
):
    # The save succeeded on disk; only our copy of it failed. The user should
    # still be told the file exists and where, rather than it vanishing.
    run_key = _start_run(store, workspace, train_config)
    source = workspace / "save" / "a.safetensors"
    source.write_bytes(b"weights")

    import modules.webui.checkpoint_store as cs

    def boom(*args, **kwargs):
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(cs, "link_or_copy", boom)

    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    entry = _manifest(workspace, run_key)["checkpoints"][0]
    assert entry["available"] is False
    assert entry["source_path"] == str(source)
    assert not (_checkpoint_dir(workspace, run_key) / "a.safetensors").exists()


def test_a_stored_checkpoint_is_marked_available(store, workspace, train_config):
    run_key = _start_run(store, workspace, train_config)
    source = workspace / "save" / "a.safetensors"
    source.write_bytes(b"weights")

    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    assert _manifest(workspace, run_key)["checkpoints"][0]["available"] is True


def test_an_unavailable_checkpoint_cannot_be_downloaded(store, workspace, train_config, monkeypatch):
    run_key = _start_run(store, workspace, train_config)
    source = workspace / "save" / "a.safetensors"
    source.write_bytes(b"weights")

    import modules.webui.checkpoint_store as cs

    monkeypatch.setattr(cs, "link_or_copy", lambda *a, **k: (_ for _ in ()).throw(OSError(28, "full")))

    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    with pytest.raises(CheckpointNotFound):
        store.get_checkpoint_path(run_key, "a.safetensors")


def test_a_second_run_starts_a_separate_directory(store, workspace, train_config):
    first = _start_run(store, workspace, train_config, "run-a")
    source_a = workspace / "save" / "a.safetensors"
    source_a.write_bytes(b"a")
    store.capture(ModelFormat.KOHYA_LORA, str(source_a))
    store.end_training()

    second = _start_run(store, workspace, train_config, "run-b")
    source_b = workspace / "save" / "b.safetensors"
    source_b.write_bytes(b"b")
    store.capture(ModelFormat.KOHYA_LORA, str(source_b))
    store.end_training()

    assert [e["filename"] for e in _manifest(workspace, first)["checkpoints"]] == ["a.safetensors"]
    assert [e["filename"] for e in _manifest(workspace, second)["checkpoints"]] == ["b.safetensors"]


def test_list_runs_is_newest_first_and_skips_corrupt_manifests(store, workspace, train_config):
    for key in ("run-a", "run-b"):
        _start_run(store, workspace, train_config, key)
        source = workspace / "save" / f"{key}.safetensors"
        source.write_bytes(b"x")
        store.capture(ModelFormat.KOHYA_LORA, str(source))
        store.end_training()

    broken = workspace / "webui" / "checkpoints" / "broken"
    broken.mkdir(parents=True)
    (broken / MANIFEST_FILENAME).write_text("not json", encoding="utf-8")

    runs = store.list_runs()

    assert [r["key"] for r in runs] == ["run-b", "run-a"]
    assert runs[0]["checkpoint_count"] == 1
    assert runs[0]["total_size_bytes"] == 1


def test_list_runs_is_empty_when_nothing_has_been_captured(store):
    assert store.list_runs() == []


def test_get_checkpoint_path_rejects_traversal(store, workspace, train_config):
    run_key = _start_run(store, workspace, train_config)
    source = workspace / "save" / "a.safetensors"
    source.write_bytes(b"x")
    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    for bad_key in ["../escape", "a/b", "..", "..\\escape"]:
        with pytest.raises(CheckpointNotFound):
            store.get_checkpoint_path(bad_key, "a.safetensors")

    for bad_name in ["../../etc/passwd", "a/b", ".."]:
        with pytest.raises(CheckpointNotFound):
            store.get_checkpoint_path(run_key, bad_name)


def test_get_checkpoint_path_rejects_a_name_not_in_the_manifest(store, workspace, train_config):
    run_key = _start_run(store, workspace, train_config)
    source = workspace / "save" / "a.safetensors"
    source.write_bytes(b"x")
    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    (_checkpoint_dir(workspace, run_key) / "smuggled.safetensors").write_bytes(b"nope")

    with pytest.raises(CheckpointNotFound):
        store.get_checkpoint_path(run_key, "smuggled.safetensors")


def test_delete_checkpoint_removes_the_file_and_the_manifest_entry(store, workspace, train_config):
    run_key = _start_run(store, workspace, train_config)
    source = workspace / "save" / "a.safetensors"
    source.write_bytes(b"x")
    store.capture(ModelFormat.KOHYA_LORA, str(source))
    store.end_training()

    store.delete_checkpoint(run_key, "a.safetensors")

    assert not (_checkpoint_dir(workspace, run_key) / "a.safetensors").exists()
    assert _manifest(workspace, run_key)["checkpoints"] == []
    # The original OneTrainer file is never touched.
    assert source.read_bytes() == b"x"


def test_delete_checkpoint_removes_a_directory_tree(store, workspace, train_config, tmp_path):
    run_key = _start_run(store, workspace, train_config)
    tree = tmp_path / "out" / "my-model"
    tree.mkdir(parents=True)
    (tree / "a.json").write_bytes(b"{}")
    store.capture(ModelFormat.DIFFUSERS, str(tree))
    store.end_training()

    store.delete_checkpoint(run_key, "my-model")

    assert not (_checkpoint_dir(workspace, run_key) / "my-model").exists()
    assert tree.is_dir()

