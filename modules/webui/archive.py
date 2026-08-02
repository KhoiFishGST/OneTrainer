import os
import zipfile
from collections.abc import Iterator
from pathlib import Path

# 1MiB read granularity: large enough that syscall overhead is negligible on a
# multi-gigabyte model, small enough that we never hold much in memory.
CHUNK_SIZE = 1024 * 1024


class _ChunkSink:
    """A write-only, non-seekable sink that hands buffered bytes to a generator.

    zipfile detects a non-seekable stream and emits data descriptors instead of
    rewriting local headers, which is what makes streaming possible at all.
    """

    def __init__(self) -> None:
        self._buffer = bytearray()

    def write(self, data: bytes) -> int:
        self._buffer.extend(data)
        return len(data)

    def flush(self) -> None:
        pass

    def seekable(self) -> bool:
        return False

    def drain(self) -> Iterator[bytes]:
        if self._buffer:
            chunk = bytes(self._buffer)
            self._buffer.clear()
            yield chunk


def stream_directory_zip(root: Path) -> Iterator[bytes]:
    """Yield a zip archive of every file under root, without buffering it whole.

    ZIP_STORED, not deflate: safetensors are incompressible, so compression
    would burn CPU for nothing. force_zip64 is required because entry sizes are
    unknown when writing to an unseekable stream.
    """
    root = Path(root)
    sink = _ChunkSink()

    with zipfile.ZipFile(sink, "w", zipfile.ZIP_STORED, allowZip64=True) as archive:
        for path in sorted(p for p in root.rglob("*") if p.is_file()):
            arcname = str(path.relative_to(root)).replace(os.sep, "/")
            info = zipfile.ZipInfo(arcname)
            info.compress_type = zipfile.ZIP_STORED

            with archive.open(info, "w", force_zip64=True) as entry, path.open("rb") as source:
                while chunk := source.read(CHUNK_SIZE):
                    entry.write(chunk)
                    yield from sink.drain()

            yield from sink.drain()

    yield from sink.drain()
