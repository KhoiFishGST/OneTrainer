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


from modules.webui.archive import stream_zip


def test_stream_zip_uses_the_arcnames_it_was_given(tmp_path: Path):
    # The samples archive is a selection stored flat, not a directory mirror.
    (tmp_path / "deep" / "nested").mkdir(parents=True)
    first = tmp_path / "deep" / "nested" / "a.png"
    first.write_bytes(b"a" * 100)
    second = tmp_path / "b.json"
    second.write_bytes(b"{}")

    data = b"".join(stream_zip([(first, "a.png"), (second, "b.json")]))

    archive = zipfile.ZipFile(io.BytesIO(data))
    assert archive.testzip() is None
    assert sorted(archive.namelist()) == ["a.png", "b.json"]
    assert archive.read("a.png") == b"a" * 100


def test_stream_zip_skips_entries_whose_file_vanished(tmp_path: Path):
    # A sample deleted between manifest read and archive build must not abort
    # the whole download.
    present = tmp_path / "present.png"
    present.write_bytes(b"x")

    data = b"".join(stream_zip([(present, "present.png"), (tmp_path / "gone.png", "gone.png")]))

    archive = zipfile.ZipFile(io.BytesIO(data))
    assert archive.namelist() == ["present.png"]


def test_stream_zip_honours_the_requested_compression(tmp_path: Path):
    # Tensorboard event files are protobuf and compress well; images do not.
    target = tmp_path / "events.out"
    target.write_bytes(b"repeat" * 5000)

    data = b"".join(stream_zip([(target, "events.out")], compression=zipfile.ZIP_DEFLATED))

    archive = zipfile.ZipFile(io.BytesIO(data))
    assert archive.infolist()[0].compress_type == zipfile.ZIP_DEFLATED
    assert archive.read("events.out") == b"repeat" * 5000
    assert len(data) < 30000


def test_stream_directory_zip_still_defaults_to_stored(tmp_path: Path):
    root = tmp_path / "m"
    root.mkdir()
    (root / "w.safetensors").write_bytes(b"y" * 200)

    data = b"".join(stream_directory_zip(root))

    archive = zipfile.ZipFile(io.BytesIO(data))
    assert archive.infolist()[0].compress_type == zipfile.ZIP_STORED

