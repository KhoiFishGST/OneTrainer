from pathlib import Path
from typing import Any

from modules.webui.atomic_io import write_json_atomic
from modules.webui.sampling_coordinator import (
    PromptDefinitionsError,
    PromptPersistenceError,
)
from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()


class SamplesPutRequest(BaseModel):
    samples: list[dict[str, Any]]


class SampleFileCreateRequest(BaseModel):
    name: str


@router.get("/samples/files")
async def list_sample_files(request: Request):
    app_state: AppState = request.app.state.webui
    samples_dir = app_state.settings.root_dir / "training_samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    files = sorted([f.name for f in samples_dir.glob("*.json") if f.is_file()])
    if "samples.json" not in files:
        files.insert(0, "samples.json")
    return {"files": files}


@router.post("/samples/files")
async def create_sample_file(body: SampleFileCreateRequest, request: Request):
    app_state: AppState = request.app.state.webui
    raw_name = body.name.strip()
    if not raw_name:
        return JSONResponse(status_code=422, content={"detail": "Sample file name cannot be empty"})
    clean_name = Path(raw_name).name
    if not clean_name or clean_name in (".", "..") or clean_name != raw_name:
        return JSONResponse(status_code=422, content={"detail": "Invalid sample file name"})
    filename = clean_name if clean_name.endswith(".json") else f"{clean_name}.json"
    samples_dir = app_state.settings.root_dir / "training_samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    target_path = samples_dir / filename
    if not target_path.exists():
        write_json_atomic(target_path, [])
    return {"filename": filename}


@router.get("/samples")
def get_samples(request: Request):
    app_state: AppState = request.app.state.webui
    sampling_coord = app_state.sampling_coordinator
    state = sampling_coord.get_definitions()
    return {"samples": state.samples, "queued": state.queued}


@router.put("/samples")
def put_samples(request: Request, body: SamplesPutRequest):
    app_state: AppState = request.app.state.webui
    sampling_coord = app_state.sampling_coordinator
    try:
        state = sampling_coord.put_definitions(body.samples)
        return {"samples": state.samples, "queued": state.queued}
    except PromptDefinitionsError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except PromptPersistenceError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

