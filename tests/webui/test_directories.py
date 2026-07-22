from pathlib import Path
from unittest.mock import patch

import pytest

from modules.webui.directories import DirectoryDenied, DirectoryMissing, DirectoryService


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
    with patch.object(Path, "resolve", side_effect=PermissionError("Denied")):
        with pytest.raises(DirectoryDenied):
            DirectoryService().list(str(tmp_path))
