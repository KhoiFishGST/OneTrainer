from modules.webui.directories import DirectoryDenied, DirectoryMissing
from modules.webui.state import AppState

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/fs/directories")
async def list_directories(request: Request, path: str = ""):
    app_state: AppState = request.app.state.webui
    try:
        return app_state.directories.list(path)
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
