from modules.webui.directories import DirectoryDenied, DirectoryMissing
from modules.webui.state import AppState

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/fs/list")
async def fs_list(
    request: Request,
    path: str = "",
    mode: str = "both",
    extensions: str | list[str] | None = Query(None),  # noqa: B008
    show_hidden: bool = False,
):
    app_state: AppState = request.app.state.webui
    try:
        return app_state.directories.list(
            raw_path=path,
            mode=mode,
            extensions=extensions,
            show_hidden=show_hidden,
        )
    except DirectoryMissing:
        return JSONResponse(
            status_code=404,
            content={"detail": "Directory does not exist"},
        )
    except DirectoryDenied:
        return JSONResponse(
            status_code=403,
            content={"detail": "Permission denied"},
        )


@router.get("/fs/directories")
async def list_directories(request: Request, path: str = ""):
    app_state: AppState = request.app.state.webui
    try:
        return app_state.directories.list(path, mode="dir")
    except DirectoryMissing:
        return JSONResponse(
            status_code=404,
            content={"detail": "Directory does not exist"},
        )
    except DirectoryDenied:
        return JSONResponse(
            status_code=403,
            content={"detail": "Permission denied"},
        )

