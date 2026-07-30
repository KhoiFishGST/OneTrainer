from pathlib import Path

from modules.webui.atomic_io import copy_file_atomic, save_pil_atomic, write_json_atomic

from PIL import Image


def test_write_json_atomic_replaces_document_without_temp_file(tmp_path: Path):
    target = tmp_path / "manifest.json"
    write_json_atomic(target, {"schema_version": 1, "batches": []})
    assert target.read_text(encoding="utf-8") == '{\n  "schema_version": 1,\n  "batches": []\n}\n'
    assert list(tmp_path.glob(f".{target.name}.*.tmp")) == []


def test_copy_file_atomic_preserves_exact_bytes_and_returns_digest(tmp_path: Path):
    source = tmp_path / "source.png"
    destination = tmp_path / "gallery" / "sample.png"
    payload = b"exact-source-bytes"
    source.write_bytes(payload)
    digest = copy_file_atomic(source, destination)
    assert destination.read_bytes() == payload
    assert digest == "9ff7796a53bf4c7c273a1698c57be23ac81d97653a2421343eb4182f9525c3b1"


def test_save_pil_atomic_writes_webp_and_cleans_temp_file(tmp_path: Path):
    destination = tmp_path / "thumb.webp"
    digest = save_pil_atomic(Image.new("RGB", (16, 8), "red"), destination, image_format="WEBP")
    with Image.open(destination) as saved:
        assert saved.size == (16, 8)
        assert saved.format == "WEBP"
    assert len(digest) == 64
    assert list(tmp_path.glob(f".{destination.name}.*.tmp")) == []
