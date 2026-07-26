import hashlib
import io
import mimetypes
from pathlib import Path

from modules.webui.atomic_io import save_pil_atomic

from PIL import Image, ImageOps
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import FileResponse, Response


class MediaService:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir
        self.cache_dir = root_dir / "workspace-cache" / "thumbnails"
        self._ensure_cache_dir()

    def _ensure_cache_dir(self) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _compute_cache_key(
        source_path: Path,
        mtime: float,
        size_bytes: int,
        width: int,
        height: int,
        crop_square: bool,
    ) -> str:
        key_str = f"{source_path.resolve()}:{mtime}:{size_bytes}:{width}:{height}:{crop_square}"
        return hashlib.sha256(key_str.encode("utf-8")).hexdigest()

    @staticmethod
    def _get_fallback_placeholder_bytes(width: int = 150, height: int = 150) -> bytes:
        img = Image.new("RGBA", (width, height), (30, 30, 30, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def _get_fallback_placeholder_file(
        self, width: int = 150, height: int = 150
    ) -> tuple[Path, str, str]:
        self._ensure_cache_dir()
        placeholder_bytes = self._get_fallback_placeholder_bytes(width, height)
        etag = hashlib.sha256(placeholder_bytes).hexdigest()
        placeholder_path = self.cache_dir / f"placeholder_{width}x{height}.png"
        if not placeholder_path.exists():
            try:
                placeholder_img = Image.open(io.BytesIO(placeholder_bytes))
                save_pil_atomic(placeholder_img, placeholder_path, image_format="PNG")
            except Exception:
                placeholder_path.write_bytes(placeholder_bytes)
        return placeholder_path, "image/png", etag

    def get_thumbnail_file(
        self,
        source_path: Path,
        width: int = 150,
        height: int = 150,
        crop_square: bool = True,
    ) -> tuple[Path, str, str]:
        if not source_path.exists() or not source_path.is_file():
            return self._get_fallback_placeholder_file(width, height)

        try:
            stat = source_path.stat()
            cache_key = self._compute_cache_key(
                source_path, stat.st_mtime, stat.st_size, width, height, crop_square
            )
            cached_path = self.cache_dir / f"{cache_key}.webp"
            etag = cache_key

            if cached_path.exists():
                return cached_path, "image/webp", etag

            with Image.open(source_path) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA" if "A" in img.mode or img.mode == "P" else "RGB")

                if crop_square:
                     w, h = img.size
                     min_dim = min(w, h)
                     left = (w - min_dim) // 2
                     top = (h - min_dim) // 2
                     right = left + min_dim
                     bottom = top + min_dim
                     img = img.crop((left, top, right, bottom))

                img = img.resize((width, height), Image.Resampling.LANCZOS)
                self._ensure_cache_dir()
                save_pil_atomic(img, cached_path, image_format="WEBP")

            return cached_path, "image/webp", etag
        except Exception:
            return self._get_fallback_placeholder_file(width, height)

    async def serve_image(
        self,
        request: Request,
        source_path: Path,
        thumb: bool = False,
        target_size: int = 150,
    ) -> Response:
        if thumb:
            file_path, mime_type, etag = await run_in_threadpool(
                self.get_thumbnail_file,
                source_path,
                target_size,
                target_size,
                True,
            )
        else:
            if source_path.exists() and source_path.is_file():
                file_path = source_path
                guessed_mime, _ = mimetypes.guess_type(source_path)
                mime_type = guessed_mime or "image/jpeg"
                stat = source_path.stat()
                etag = self._compute_cache_key(
                    source_path, stat.st_mtime, stat.st_size, 0, 0, False
                )
            else:
                file_path, mime_type, etag = await run_in_threadpool(
                    self._get_fallback_placeholder_file, target_size, target_size
                )

        if_none_match = request.headers.get("if-none-match")
        if if_none_match and if_none_match.strip('"') == etag.strip('"'):
            return Response(status_code=304)

        headers = {
            "ETag": f'"{etag}"',
            "Cache-Control": "public, max-age=86400",
        }
        return FileResponse(file_path, media_type=mime_type, headers=headers)
