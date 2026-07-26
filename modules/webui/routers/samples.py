from typing import Any

from modules.webui.sampling_coordinator import (
    PromptDefinitionsError,
    PromptPersistenceError,
)
from modules.webui.state import AppState

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class SamplesPutRequest(BaseModel):
    samples: list[dict[str, Any]]


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
