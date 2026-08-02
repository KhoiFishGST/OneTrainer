import io
import zipfile
from pathlib import Path

from modules.webui.archive import stream_directory_zip


def test_streams_a_valid_archive_of_the_whole_tree(tmp_path: Path):
    root = tmp_path / "my-model"
    (root / "unet").mkdir(parents=True)
    (root / "model_index.json").write_bytes(b"{}")
    (root / "unet" / "weights.safetensors").write_bytes(b"y" * 5000)

    data = b"".join(stream_directory_zip(root))

    archive = zipfile.ZipFile(io.BytesIO(data))
    assert archive.testzip() is None
    assert sorted(archive.namelist()) == ["model_index.json", "unet/weights.safetensors"]
    assert archive.read("unet/weights.safetensors") == b"y" * 5000


def test_yields_incrementally_rather_than_one_final_blob(tmp_path: Path):
    root = tmp_path / "big"
    root.mkdir()
    for i in range(4):
        (root / f"f{i}.bin").write_bytes(b"z" * 300_000)

    chunks = list(stream_directory_zip(root))

    assert len(chunks) > 1


def test_uses_forward_slashes_in_entry_names(tmp_path: Path):
    root = tmp_path / "m"
    (root / "a" / "b").mkdir(parents=True)
    (root / "a" / "b" / "c.json").write_bytes(b"{}")

    data = b"".join(stream_directory_zip(root))

    assert "a/b/c.json" in zipfile.ZipFile(io.BytesIO(data)).namelist()
    assert not any("\\" in n for n in zipfile.ZipFile(io.BytesIO(data)).namelist())


def test_an_empty_directory_still_yields_a_valid_archive(tmp_path: Path):
    root = tmp_path / "empty"
    root.mkdir()

    archive = zipfile.ZipFile(io.BytesIO(b"".join(stream_directory_zip(root))))

    assert archive.namelist() == []
    assert archive.testzip() is None
