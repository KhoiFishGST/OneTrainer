import asyncio
import copy
from collections import deque
from enum import Enum
from threading import Lock
import time
from typing import Any, Dict, Optional

from modules.webui.events import EventType

_active_training_service: Optional["TrainingService"] = None

try:
    from torch.utils.tensorboard import SummaryWriter
    _orig_add_scalar = SummaryWriter.add_scalar

    def _global_add_scalar(writer_self, tag, scalar_value, global_step=None, walltime=None):
        try:
            _orig_add_scalar(writer_self, tag, scalar_value, global_step, walltime)
        except Exception:
            pass
        if _active_training_service is not None:
            try:
                tag_lower = tag.lower()
                val = float(scalar_value)
                step_val = global_step if global_step is not None else _active_training_service._step

                metric_payload = {
                    "step": step_val,
                    "epoch": _active_training_service._epoch,
                }
                key = tag.replace("/", "_")
                metric_payload[key] = val

                if "loss" in tag_lower:
                    metric_payload["loss"] = val
                if "lr" in tag_lower or "learning_rate" in tag_lower:
                    metric_payload["lr"] = val

                _active_training_service.record_metric(metric_payload)
            except Exception:
                pass

    SummaryWriter.add_scalar = _global_add_scalar
except Exception:
    pass


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
        self._sample_requested: bool = False
        self._backup_requested: bool = False
        self._save_requested: bool = False
        self._metrics: deque = deque(maxlen=10000)
        self._samples: list = []

    def _emit_event(self, event_type: Any, data: Dict[str, Any]) -> None:
        if self._event_bus is None:
            return
        evt_str = str(event_type.value) if hasattr(event_type, "value") else str(event_type)
        try:
            if hasattr(self._event_bus, "publish_from_thread"):
                self._event_bus.publish_from_thread(evt_str, data)
            elif hasattr(self._event_bus, "publish"):
                res = self._event_bus.publish(evt_str, data)
                if asyncio.iscoroutine(res):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(res)
                    except RuntimeError:
                        pass
        except Exception:
            pass

    def _emit_state_event(self) -> None:
        status = self.get_status()
        self._emit_event(EventType.TRAINING_STATE, status)

    def request_sample(self):
        with self._lock:
            if self._state not in (TrainingState.TRAINING, TrainingState.PAUSED):
                raise RuntimeError(f"Cannot request sample from state {self._state}")
            self._sample_requested = True

    def request_backup(self):
        with self._lock:
            if self._state not in (TrainingState.TRAINING, TrainingState.PAUSED):
                raise RuntimeError(f"Cannot request backup from state {self._state}")
            self._backup_requested = True

    def request_save(self):
        with self._lock:
            if self._state not in (TrainingState.TRAINING, TrainingState.PAUSED):
                raise RuntimeError(f"Cannot request save from state {self._state}")
            self._save_requested = True


    def record_metric(self, metric_data: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        if metric_data is not None:
            data.update(metric_data)
        data.update(kwargs)
        if "timestamp" not in data:
            data["timestamp"] = time.time()

        with self._lock:
            self._metrics.append(data)

        self._emit_event(EventType.TRAINING_METRIC, data)
        return data

    def record_sample(self, sample_data: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        if sample_data is not None:
            data.update(sample_data)
        data.update(kwargs)

        with self._lock:
            self._samples.append(data)

        self._emit_event(EventType.TRAINING_SAMPLE, data)
        return data

    def emit_gpu_stat(self, stat_data: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        data = self.get_gpu_stats()
        if stat_data is not None:
            data.update(stat_data)
        data.update(kwargs)

        self._emit_event(EventType.GPU_STAT, data)
        return data

    def get_metrics(self) -> list:
        with self._lock:
            return list(self._metrics)

    def get_samples(self) -> list:
        with self._lock:
            return list(self._samples)

    def get_gpu_stats(self) -> Dict[str, Any]:
        with self._lock:
            vram_used = 0
            vram_total = 0
            gpu_util = 0.0
            gpu_temp = 0.0
            try:
                import torch
                if torch.cuda.is_available():
                    free_b, total_b = torch.cuda.mem_get_info(0)
                    vram_used = total_b - free_b
                    vram_total = total_b
            except Exception:
                pass

            try:
                import pynvml
                pynvml.nvmlInit()
                handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                vram_used = info.used
                vram_total = info.total
                gpu_util = float(util.gpu)
                gpu_temp = float(temp)
            except Exception:
                pass

            return {
                "vram_used": vram_used,
                "vram_total": vram_total,
                "utilization": gpu_util,
                "temperature": gpu_temp,
            }

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

    def _run_training_worker(self, config_data: Dict[str, Any]):
        has_real_config = isinstance(config_data, dict) and bool(
            config_data.get("base_model_name") or config_data.get("model_path") or (isinstance(config_data.get("model"), dict) and config_data["model"].get("name"))
        )
        if not has_real_config:
            import logging
            logging.error(f"TrainingService: Cannot start training. No valid base model selected in config. Keys present: {list(config_data.keys())}")
            self.set_failed("Cannot start training: No base model selected. Please select a model in the Model tab.")
            return

        global _active_training_service
        _active_training_service = self

        try:
            import logging
            logging.info("TrainingService: Initializing TrainConfig from dictionary.")
            from modules.util.config.TrainConfig import TrainConfig
            from modules.util.config.SecretsConfig import SecretsConfig
            from modules.util.callbacks.TrainCallbacks import TrainCallbacks
            from modules.util.commands.TrainCommands import TrainCommands
            from modules.util import create

            train_config = TrainConfig.default_values().from_dict(config_data, migrate=True)
            logging.info(f"TrainingService: Base model name resolved as: {train_config.base_model_name}")

            import os
            import json

            if train_config.concepts is None:
                concept_path = train_config.concept_file_name
                if concept_path and not os.path.exists(concept_path):
                    if os.path.dirname(concept_path):
                        os.makedirs(os.path.dirname(concept_path), exist_ok=True)
                    with open(concept_path, "w", encoding="utf-8") as f:
                        json.dump([], f)
                    logging.info(f"TrainingService: Created default empty concepts file at {concept_path}")

            if train_config.samples is None:
                sample_path = train_config.sample_definition_file_name
                if sample_path and not os.path.exists(sample_path):
                    if os.path.dirname(sample_path):
                        os.makedirs(os.path.dirname(sample_path), exist_ok=True)
                    with open(sample_path, "w", encoding="utf-8") as f:
                        json.dump([], f)
                    logging.info(f"TrainingService: Created default empty samples file at {sample_path}")

            try:
                import json
                with open("secrets.json", "r") as f:
                    secrets_dict = json.load(f)
                    train_config.secrets = SecretsConfig.default_values().from_dict(secrets_dict)
            except Exception:
                pass

            commands = TrainCommands()
            with self._lock:
                self._train_commands = commands

            start_time = time.time()
            last_step_time = [start_time]
            last_step_count = [0]

            import threading
            def gpu_monitor_loop():
                while self._state in (TrainingState.TRAINING, TrainingState.PAUSED):
                    try:
                        self.emit_gpu_stat()
                    except Exception:
                        pass
                    time.sleep(1.0)
            threading.Thread(target=gpu_monitor_loop, daemon=True).start()

            def on_progress(train_progress, epoch_length, max_epoch):
                now = time.time()
                current_step = train_progress.global_step
                total_steps = (epoch_length * max_epoch) if (epoch_length and max_epoch) else (self._max_steps or 0)

                dt = now - last_step_time[0]
                ds = current_step - last_step_count[0]
                if ds > 0 and dt > 0:
                    instant_speed = ds / dt
                    last_step_time[0] = now
                    last_step_count[0] = current_step
                else:
                    elapsed = max(0.1, now - start_time)
                    instant_speed = current_step / elapsed if current_step > 0 else 0.0

                remaining_steps = max(0, total_steps - current_step) if total_steps > 0 else 0
                eta = remaining_steps / instant_speed if instant_speed > 0 else 0.0

                self.update_progress(
                    step=current_step,
                    epoch=train_progress.epoch + 1,
                    max_steps=total_steps,
                    max_epochs=max_epoch,
                    speed_its=round(instant_speed, 2),
                    elapsed_seconds=round(now - start_time, 1),
                    eta_seconds=round(eta, 1),
                )

            def on_sample(sampler_output):
                try:
                    sample_info = {
                        "id": f"sample_{len(self._samples) + 1}",
                        "step": self._step,
                        "epoch": self._epoch,
                        "timestamp": time.time(),
                    }
                    if hasattr(sampler_output, "filepath"):
                        sample_info["filepath"] = str(sampler_output.filepath)
                    if hasattr(sampler_output, "prompt"):
                        sample_info["prompt"] = str(sampler_output.prompt)
                    if hasattr(sampler_output, "seed"):
                        sample_info["seed"] = sampler_output.seed
                    self.record_sample(sample_info)
                except Exception:
                    pass

            callbacks = TrainCallbacks(
                on_update_train_progress=on_progress,
                on_sample_default=on_sample,
            )

            # Patch SummaryWriter to record real-time loss/learning rate metrics
            try:
                from torch.utils.tensorboard import SummaryWriter
                orig_add_scalar = SummaryWriter.add_scalar

                def custom_add_scalar(writer_self, tag, scalar_value, global_step=None, walltime=None):
                    try:
                        orig_add_scalar(writer_self, tag, scalar_value, global_step, walltime)
                    except Exception:
                        pass
                    try:
                        tag_lower = tag.lower()
                        val = float(scalar_value)
                        step_val = global_step if global_step is not None else self._step
                        
                        metric_payload = {
                            "step": step_val,
                            "epoch": self._epoch,
                        }
                        key = tag.replace("/", "_")
                        metric_payload[key] = val

                        if "loss" in tag_lower:
                            metric_payload["loss"] = val
                        if "lr" in tag_lower or "learning_rate" in tag_lower:
                            metric_payload["lr"] = val

                        self.record_metric(metric_payload)
                    except Exception:
                        pass

                SummaryWriter.add_scalar = custom_add_scalar
            except Exception:
                pass

            logging.info("TrainingService: Instantiating PyTorch trainer...")
            trainer = create.create_trainer(train_config, callbacks, commands)
            logging.info(f"TrainingService: Trainer instantiated successfully: {type(trainer).__name__}")
            
            trainer.start()
            logging.info("TrainingService: trainer.start() completed.")

            with self._lock:
                self._state = TrainingState.TRAINING
            self._emit_state_event()

            logging.info("TrainingService: Beginning trainer.train() loop...")
            trainer.train()
            logging.info("TrainingService: trainer.train() loop exited normally.")

            if not commands.get_stop_command() or train_config.backup_before_save:
                logging.info("TrainingService: Finalizing training (trainer.end())...")
                trainer.end()

            with self._lock:
                self._state = TrainingState.COMPLETED
            self._emit_state_event()
            logging.info("TrainingService: Training completed successfully.")

        except Exception as e:
            import logging
            logging.exception(f"TrainingService: Caught exception during training: {str(e)}")
            with self._lock:
                self._state = TrainingState.FAILED
                self._error_message = str(e)
            self._emit_state_event()

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

        self._emit_state_event()

        import threading
        thread = threading.Thread(target=self._run_training_worker, args=(copy.deepcopy(snapshot_src),), daemon=True)
        thread.start()

    def stop_training(self):
        with self._lock:
            self._state = TrainingState.IDLE
            if hasattr(self, "_train_commands") and self._train_commands:
                self._train_commands.stop()
        self._emit_state_event()



    def pause_training(self):
        with self._lock:
            if self._state not in (TrainingState.STARTING, TrainingState.TRAINING):
                raise RuntimeError(f"Cannot pause training from state {self._state}")
            self._state = TrainingState.PAUSED
        self._emit_state_event()


    def resume_training(self):
        with self._lock:
            if self._state != TrainingState.PAUSED:
                raise RuntimeError(f"Cannot resume training from state {self._state}")
            self._state = TrainingState.TRAINING
        self._emit_state_event()

    def set_state(self, new_state: TrainingState):
        with self._lock:
            self._state = new_state
        self._emit_state_event()

    def set_completed(self):
        with self._lock:
            self._state = TrainingState.COMPLETED
        self._emit_state_event()

    def set_failed(self, error_message: str):
        with self._lock:
            self._state = TrainingState.FAILED
            self._error_message = error_message
        self._emit_state_event()

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
        self._emit_state_event()
