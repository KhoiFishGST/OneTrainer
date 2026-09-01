import hashlib
import os
from pathlib import Path

from modules.webui.atomic_io import (
    copy_file_atomic,
    link_or_copy,
    link_or_copy_with_digest,
    save_pil_atomic,
    volume_key,
    write_json_atomic,
)

import pytest
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


def test_link_or_copy_with_digest_shares_the_inode_and_returns_the_hash(tmp_path: Path):
    source = tmp_path / "a.png"
    source.write_bytes(b"pixels" * 100)
    destination = tmp_path / "mirror" / "a.png"

    linked, digest = link_or_copy_with_digest(source, destination)

    assert linked is True
    assert os.stat(source).st_ino == os.stat(destination).st_ino
    assert digest == hashlib.sha256(source.read_bytes()).hexdigest()


def test_link_or_copy_with_digest_returns_the_same_hash_on_the_copy_path(tmp_path: Path):
    # The digest is the gallery's ETag, so it must be identical whether we
    # linked or copied.
    source = tmp_path / "a.png"
    source.write_bytes(b"pixels" * 100)

    linked_dst = tmp_path / "linked.png"
    copied_dst = tmp_path / "copied.png"

    _, linked_digest = link_or_copy_with_digest(source, linked_dst)
    linked_copy, copied_digest = link_or_copy_with_digest(source, copied_dst, allow_link=False)

    assert linked_copy is False
    assert os.stat(source).st_ino != os.stat(copied_dst).st_ino
    assert copied_digest == linked_digest


def test_link_or_copy_with_digest_raises_when_both_paths_fail(tmp_path: Path, monkeypatch):
    # The gallery relies on this to mark the slot errored without touching core.
    source = tmp_path / "a.png"
    source.write_bytes(b"x")

    def boom(*args, **kwargs):
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(os, "link", boom)
    monkeypatch.setattr("modules.webui.atomic_io.copy_file_atomic", boom)

    with pytest.raises(OSError):
        link_or_copy_with_digest(source, tmp_path / "out.png")


def test_link_or_copy_and_volume_key_are_importable_from_atomic_io(tmp_path: Path):
    # They moved here from checkpoint_store; both modules' callers use them.
    source = tmp_path / "a.bin"
    source.write_bytes(b"x")

    assert link_or_copy(source, tmp_path / "b.bin") is True
    assert volume_key(tmp_path) == volume_key(source)

