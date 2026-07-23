from enum import Enum
from threading import Lock
from typing import Dict, Any, Optional
import copy


class TrainingState(str, Enum):
    IDLE = "IDLE"
    STARTING = "STARTING"
    TRAINING = "TRAINING"
    PAUSED = "PAUSED"
    STOPPING = "STOPPING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TrainingService:
    def __init__(self, event_bus: Optional[Any] = None):
        self._lock = Lock()
        self._event_bus = event_bus
        self._state = TrainingState.IDLE
        self._step = 0
        self._max_steps = 0
        self._epoch = 0
        self._max_epochs = 0
        self._speed_its = 0.0
        self._elapsed_seconds = 0.0
        self._eta_seconds = 0.0
        self._error_message: Optional[str] = None
        self._config_snapshot: Optional[Dict[str, Any]] = None

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "state": self._state,
                "step": self._step,
                "max_steps": self._max_steps,
                "epoch": self._epoch,
                "max_epochs": self._max_epochs,
                "speed_its": self._speed_its,
                "elapsed_seconds": self._elapsed_seconds,
                "eta_seconds": self._eta_seconds,
                "error_message": self._error_message,
                "has_snapshot": self._config_snapshot is not None,
            }

    def get_config_snapshot(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            if self._config_snapshot is None:
                return None
            return copy.deepcopy(self._config_snapshot)

    def start_training(self, config_data: Optional[Dict[str, Any]] = None):
        with self._lock:
            if self._state not in (TrainingState.IDLE, TrainingState.COMPLETED, TrainingState.FAILED):
                raise RuntimeError(f"Cannot start training from state {self._state}")
            snapshot_src = config_data if config_data is not None else {}
            self._config_snapshot = copy.deepcopy(snapshot_src)
            self._state = TrainingState.TRAINING
            self._step = 0
            self._epoch = 0
            self._max_steps = self._config_snapshot.get("max_steps", 0) if isinstance(self._config_snapshot, dict) else 0
            self._max_epochs = self._config_snapshot.get("max_epochs", 0) if isinstance(self._config_snapshot, dict) else 0
            self._speed_its = 0.0
            self._elapsed_seconds = 0.0
            self._eta_seconds = 0.0
            self._error_message = None

    def stop_training(self):
        with self._lock:
            if self._state not in (TrainingState.STARTING, TrainingState.TRAINING, TrainingState.PAUSED):
                raise RuntimeError(f"Cannot stop training from state {self._state}")
            self._state = TrainingState.STOPPING

    def pause_training(self):
        with self._lock:
            if self._state != TrainingState.TRAINING:
                raise RuntimeError(f"Cannot pause training from state {self._state}")
            self._state = TrainingState.PAUSED

    def resume_training(self):
        with self._lock:
            if self._state != TrainingState.PAUSED:
                raise RuntimeError(f"Cannot resume training from state {self._state}")
            self._state = TrainingState.TRAINING

    def set_state(self, new_state: TrainingState):
        with self._lock:
            self._state = new_state

    def set_completed(self):
        with self._lock:
            self._state = TrainingState.COMPLETED

    def set_failed(self, error_message: str):
        with self._lock:
            self._state = TrainingState.FAILED
            self._error_message = error_message

    def update_progress(
        self,
        step: Optional[int] = None,
        epoch: Optional[int] = None,
        max_steps: Optional[int] = None,
        max_epochs: Optional[int] = None,
        speed_its: Optional[float] = None,
        elapsed_seconds: Optional[float] = None,
        eta_seconds: Optional[float] = None,
    ):
        with self._lock:
            if step is not None:
                self._step = step
            if epoch is not None:
                self._epoch = epoch
            if max_steps is not None:
                self._max_steps = max_steps
            if max_epochs is not None:
                self._max_epochs = max_epochs
            if speed_its is not None:
                self._speed_its = speed_its
            if elapsed_seconds is not None:
                self._elapsed_seconds = elapsed_seconds
            if eta_seconds is not None:
                self._eta_seconds = eta_seconds
