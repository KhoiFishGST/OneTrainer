from starlette.middleware.gzip import GZipMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

# Payloads that are already compressed. Gzipping them costs event-loop CPU for
# no meaningful size win, which matters because gallery thumbnails are served
# from the same single-threaded loop that drives training events.
INCOMPRESSIBLE_SUFFIXES = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".avif",
    ".ico",
    ".mp4",
    ".webm",
    ".mp3",
    ".ogg",
    ".wav",
    ".woff",
    ".woff2",
    ".zip",
    ".gz",
    ".safetensors",
)

# API routes that stream image bytes rather than JSON.
INCOMPRESSIBLE_PATH_PREFIXES = (
    "/api/datasets/image",
    "/api/gallery/runs/",
    "/api/training/samples/",
)


class SelectiveGZipMiddleware:
    """Gzip text payloads, pass binary media through untouched."""

    def __init__(self, app: ASGIApp, minimum_size: int = 1024, compresslevel: int = 6) -> None:
        self.app = app
        self.gzip_app = GZipMiddleware(app, minimum_size=minimum_size, compresslevel=compresslevel)

    @staticmethod
    def is_incompressible(path: str) -> bool:
        lowered = path.lower()
        if lowered.endswith(INCOMPRESSIBLE_SUFFIXES):
            return True
        return lowered.startswith(INCOMPRESSIBLE_PATH_PREFIXES)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self.is_incompressible(scope.get("path", "")):
            await self.app(scope, receive, send)
            return
        await self.gzip_app(scope, receive, send)
