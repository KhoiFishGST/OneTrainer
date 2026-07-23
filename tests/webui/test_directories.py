from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from modules.webui.app import create_app
from modules.webui.directories import DirectoryDenied, DirectoryMissing, DirectoryService
from modules.webui.state import WebUISettings

import pytest


@pytest.fixture
def client(tmp_path):
    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "training_presets" / "#.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "training_presets",
        static_dir=tmp_path / "web" / "build",
        dev=True,
    )
    with TestClient(create_app(settings)) as c:
        yield c


def test_directory_listing_is_sorted_resolved_and_directory_only(tmp_path):
    (tmp_path / "z-dir").mkdir()
    (tmp_path / "a-dir").mkdir()
    (tmp_path / "file.txt").write_text("not listed", encoding="utf-8")
    result = DirectoryService(max_entries=5000).list(str(tmp_path))
    assert result["path"] == str(tmp_path.resolve())
    assert [entry["name"] for entry in result["directories"]] == ["a-dir", "z-dir"]
    assert result["truncated"] is False


def test_directory_listing_caps_results(tmp_path):
    for index in range(4):
        (tmp_path / f"dir-{index}").mkdir()
    result = DirectoryService(max_entries=3).list(str(tmp_path))
    assert len(result["directories"]) == 3
    assert result["truncated"] is True


def test_missing_directory_has_typed_error(tmp_path):
    with pytest.raises(DirectoryMissing):
        DirectoryService().list(str(tmp_path / "missing"))


def test_non_directory_file_raises_directory_missing(tmp_path):
    file_path = tmp_path / "file.txt"
    file_path.write_text("hello", encoding="utf-8")
    with pytest.raises(DirectoryMissing):
        DirectoryService().list(str(file_path))


def test_permission_denied_raises_directory_denied(tmp_path):
    with patch.object(Path, "resolve", side_effect=PermissionError("Denied")), pytest.raises(DirectoryDenied):
        DirectoryService().list(str(tmp_path))


def test_list_directories_with_extension_filter(client, tmp_path):
    (tmp_path / "model.safetensors").write_text("dummy")
    (tmp_path / "notes.txt").write_text("dummy")
    (tmp_path / "subfolder").mkdir()

    resp = client.get(f"/api/fs/list?path={tmp_path}&mode=both&extensions=.safetensors")
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    names = [e["name"] for e in entries]
    assert "model.safetensors" in names
    assert "subfolder" in names
    assert "notes.txt" not in names


def test_list_directories_mode_filtering(client, tmp_path):
    (tmp_path / "model.safetensors").write_text("dummy")
    (tmp_path / "subfolder").mkdir()

    resp_dir = client.get(f"/api/fs/list?path={tmp_path}&mode=dir")
    assert resp_dir.status_code == 200
    entries_dir = resp_dir.json()["entries"]
    assert len(entries_dir) == 1
    assert entries_dir[0]["name"] == "subfolder"
    assert entries_dir[0]["is_dir"] is True

    resp_file = client.get(f"/api/fs/list?path={tmp_path}&mode=file")
    assert resp_file.status_code == 200
    entries_file = resp_file.json()["entries"]
    assert len(entries_file) == 1
    assert entries_file[0]["name"] == "model.safetensors"
    assert entries_file[0]["is_dir"] is False
    assert "size_bytes" in entries_file[0]
    assert "modified" in entries_file[0]

