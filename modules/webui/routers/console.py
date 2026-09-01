from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/console/log")
async def get_console_log(request: Request):
    app_state: AppState = request.app.state.webui
    capture = app_state.capture
    if capture is None or capture.sink is None:
        raise HTTPException(status_code=404, detail="Log file not found")

    log_path = capture.sink.log_path.resolve()
    if not log_path.exists() or not log_path.is_file():
        raise HTTPException(status_code=404, detail="Log file not found")

    return FileResponse(path=log_path, filename="webui.log", media_type="text/plain")
