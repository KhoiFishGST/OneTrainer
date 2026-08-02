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
