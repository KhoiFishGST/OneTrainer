import sys
from unittest.mock import MagicMock

from modules.webui.gallery import TrainingProgressSnapshot
from modules.webui.training import TrainingService, TrainingState

import pytest
from PIL import Image

_original_run_training_worker = TrainingService._run_training_worker

@pytest.fixture(autouse=True)
def mock_worker(monkeypatch):
    monkeypatch.setattr("modules.webui.training.TrainingService._run_training_worker", lambda self, config_data: None)



def test_training_service_initial_state_and_snapshot():
    service = TrainingService()
    status = service.get_status()
    assert status["state"] == TrainingState.IDLE
    assert status["step"] == 0
    assert status["max_steps"] == 0
    assert status["epoch"] == 0
    assert status["max_epochs"] == 0
    assert service.get_config_snapshot() is None


def test_start_training_creates_immutable_snapshot():
    service = TrainingService()
    config = {
        "model": {"name": "test-model"},
        "training": {"learning_rate": 0.0001, "batch_size": 4},
        "max_steps": 1000,
        "max_epochs": 10
    }

    service.start_training(config)
    status = service.get_status()
    assert status["state"] == TrainingState.TRAINING
    assert status["max_steps"] == 1000
    assert status["max_epochs"] == 10

    # Verify snapshot equality
    snapshot = service.get_config_snapshot()
    assert snapshot == config
    assert snapshot is not config

    # Mutate original config dict and ensure snapshot in service is unchanged
    config["training"]["learning_rate"] = 0.9999
    config["model"]["name"] = "mutated-model"

    snapshot_after_mutation = service.get_config_snapshot()
    assert snapshot_after_mutation["training"]["learning_rate"] == 0.0001
    assert snapshot_after_mutation["model"]["name"] == "test-model"

    # Mutate returned snapshot and ensure service snapshot is unchanged
    snapshot_after_mutation["training"]["learning_rate"] = 0.555
    assert service.get_config_snapshot()["training"]["learning_rate"] == 0.0001


def test_valid_state_transitions():
    service = TrainingService()

    # IDLE -> STARTING / TRAINING
    service.start_training({"max_steps": 500, "model_path": "mock"})
    assert service.get_status()["state"] == TrainingState.TRAINING

    # TRAINING -> PAUSED
    service.pause_training()
    assert service.get_status()["state"] == TrainingState.PAUSED

    # PAUSED -> TRAINING
    service.resume_training()
    assert service.get_status()["state"] == TrainingState.TRAINING

    # TRAINING -> STOPPING/IDLE
    service.stop_training()
    assert service.get_status()["state"] == TrainingState.IDLE

    # Transition to COMPLETED from IDLE (previously STOPPING)
    service.set_completed()
    assert service.get_status()["state"] == TrainingState.COMPLETED

    # COMPLETED -> start_training -> TRAINING
    service.start_training({"max_steps": 200, "model_path": "mock"})
    assert service.get_status()["state"] == TrainingState.TRAINING

    # Transition to FAILED
    service.set_failed("Out of memory error")
    assert service.get_status()["state"] == TrainingState.FAILED
    assert service.get_status()["error_message"] == "Out of memory error"

    # FAILED -> start_training -> TRAINING
    service.start_training({"max_steps": 300, "model_path": "mock"})
    assert service.get_status()["state"] == TrainingState.TRAINING
    assert service.get_status()["error_message"] is None


def test_invalid_state_transitions():
    service = TrainingService()

    # Pause/Resume from IDLE is invalid
    with pytest.raises(RuntimeError, match="Cannot pause training"):
        service.pause_training()

    with pytest.raises(RuntimeError, match="Cannot resume training"):
        service.resume_training()

    # Start training
    service.start_training({"model_path": "mock"})

    # Cannot start training when already TRAINING
    with pytest.raises(RuntimeError, match="Cannot start training"):
        service.start_training({"model_path": "mock"})

    # Pause training
    service.pause_training()

    # Cannot start training when PAUSED
    with pytest.raises(RuntimeError, match="Cannot start training"):
        service.start_training({"model_path": "mock"})

    # Cannot pause training when PAUSED
    with pytest.raises(RuntimeError, match="Cannot pause training"):
        service.pause_training()

    # Resume training
    service.resume_training()

    # Stop training
    service.stop_training()


def test_update_progress_and_status():
    service = TrainingService()
    service.start_training({"max_steps": 1000, "max_epochs": 10})

    service.update_progress(
        step=50,
        epoch=1,
        speed_its=2.5,
        elapsed_seconds=20.0,
        eta_seconds=380.0
    )

    status = service.get_status()
    assert status["step"] == 50
    assert status["epoch"] == 1
    assert status["max_steps"] == 1000
    assert status["max_epochs"] == 10
    assert status["speed_its"] == 2.5
    assert status["elapsed_seconds"] == 20.0
    assert status["eta_seconds"] == 380.0


def test_has_sample_definitions(tmp_path):
    from unittest.mock import MagicMock
    service = TrainingService()

    # 1. No active train config -> False
    assert service._has_sample_definitions() is False

    # 2. Config with samples in memory -> True
    config = MagicMock()
    config.samples = [{"prompt": "test"}]
    service._active_train_config = config
    assert service._has_sample_definitions() is True

    # 3. Config with empty sample_definition_file_name or missing file -> False
    config.samples = None
    config.sample_definition_file_name = None
    assert service._has_sample_definitions() is False

    non_existent = tmp_path / "non_existent.json"
    config.sample_definition_file_name = str(non_existent)
    assert service._has_sample_definitions() is False

    # 4. File contains empty list -> False
    empty_file = tmp_path / "samples_empty.json"
    empty_file.write_text("[]", encoding="utf-8")
    config.sample_definition_file_name = str(empty_file)
    assert service._has_sample_definitions() is False

    # 5. File contains valid non-empty list -> True
    valid_file = tmp_path / "samples_valid.json"
    valid_file.write_text('[{"prompt": "photo of a cat"}]', encoding="utf-8")
    config.sample_definition_file_name = str(valid_file)
    assert service._has_sample_definitions() is True


def test_request_sample_validation_and_dispatch():
    from unittest.mock import MagicMock
    service = TrainingService()
    service._state = TrainingState.TRAINING

    mock_commands = MagicMock()
    service._train_commands = mock_commands

    # _has_sample_definitions returns False -> raises RuntimeError
    config = MagicMock()
    config.samples = None
    config.sample_definition_file_name = None
    service._active_train_config = config

    with pytest.raises(RuntimeError, match="No sample prompts configured in sample definitions file"):
        service.request_sample()
    mock_commands.sample_default.assert_not_called()

    # _has_sample_definitions returns True -> calls sample_default
    config.samples = [{"prompt": "test"}]
    service.request_sample()
    mock_commands.sample_default.assert_called_once()


def test_request_backup_dispatch():
    from unittest.mock import MagicMock
    service = TrainingService()
    service._state = TrainingState.TRAINING

    mock_commands = MagicMock()
    service._train_commands = mock_commands

    service.request_backup()
    mock_commands.backup.assert_called_once()


def test_request_save_dispatch():
    from unittest.mock import MagicMock
    service = TrainingService()
    service._state = TrainingState.TRAINING

    mock_commands = MagicMock()
    service._train_commands = mock_commands

    service.request_save()
    mock_commands.save.assert_called_once()


class FakeTrainer:
    def __init__(self, callbacks, commands):
        self.callbacks = callbacks
        self.commands = commands
        self.exit_mode = "success"

    def configure_exit(self, exit_mode):
        self.exit_mode = exit_mode

    def start(self):
        pass

    def train(self):
        if self.exit_mode == "failure":
            raise RuntimeError("Trainer failure")
        if self.callbacks:
            if hasattr(self.callbacks, "on_update_status"):
                from modules.util.TrainProgress import TrainProgress
                self.callbacks.on_update_train_progress(TrainProgress(epoch=0, epoch_step=0, global_step=0), 100, 10)
                self.callbacks.on_update_status("Sampling ...")
                self.callbacks.on_update_status("Training ...")

    def end(self):
        pass


def valid_config_dict():
    from modules.util.config.TrainConfig import TrainConfig
    d = TrainConfig.default_values().to_dict()
    d["base_model_name"] = "test-model"
    d["model_path"] = "test_model.safetensors"
    return d


def test_training_status_callbacks_bound_one_gallery_batch(monkeypatch):
    coordinator = MagicMock()
    training_service = TrainingService(sampling_coordinator=coordinator)

    def fake_create_trainer(train_config, callbacks, commands):
        return FakeTrainer(callbacks, commands)

    mock_create = MagicMock(create_trainer=fake_create_trainer)
    monkeypatch.setitem(sys.modules, "modules.util.create", mock_create)

    config = valid_config_dict()

    _original_run_training_worker(training_service, config)

    coordinator.begin_training.assert_called_once()
    coordinator.on_status.assert_any_call("Sampling ...", TrainingProgressSnapshot(epoch=1, epoch_step=0, global_step=0))
    coordinator.on_status.assert_any_call("Training ...", TrainingProgressSnapshot(epoch=1, epoch_step=0, global_step=0))
    coordinator.finish_training.assert_called_once()


def test_sample_callback_does_not_write_training_samples(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    coordinator = MagicMock()
    training_service = TrainingService(sampling_coordinator=coordinator)

    coordinator.on_default_sample.return_value = {"run_key": "run", "batch_id": 1, "status": "ready"}

    img = Image.new("RGB", (64, 64), color="red")
    sample_path = tmp_path / "workspace" / "samples" / "0 - prompt" / "sample.png"
    sample_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(sample_path)

    sampler_output = MagicMock()
    sampler_output.data = img
    sampler_output.filepath = sample_path

    training_service._handle_default_sample(sampler_output)

    assert not (tmp_path / "training_samples").exists()
    assert training_service.get_samples()[-1]["run_key"] == "run"


def test_sample_event_is_not_emitted_when_gallery_rejects_output():
    coordinator = MagicMock()
    training_service = TrainingService(sampling_coordinator=coordinator)

    coordinator.on_default_sample.return_value = None
    training_service._handle_default_sample(object())

    assert training_service.get_samples() == []


def test_progress_retains_epoch_step():
    training_service = TrainingService()
    training_service.update_progress(step=12, epoch=2, epoch_step=7)
    assert training_service._progress_snapshot() == TrainingProgressSnapshot(epoch=2, epoch_step=7, global_step=12)


@pytest.mark.parametrize("exit_mode", ["failure", "stop"])
def test_training_exit_always_finishes_coordinator(monkeypatch, exit_mode):
    coordinator = MagicMock()
    training_service = TrainingService(sampling_coordinator=coordinator)

    def fake_create_trainer(train_config, callbacks, commands):
        trainer = FakeTrainer(callbacks, commands)
        trainer.configure_exit(exit_mode)
        return trainer

    mock_create = MagicMock(create_trainer=fake_create_trainer)
    monkeypatch.setitem(sys.modules, "modules.util.create", mock_create)

    config = valid_config_dict()

    _original_run_training_worker(training_service, config)

    coordinator.finish_training.assert_called_once()


def test_handle_status_exception_handled_gracefully():
    coordinator = MagicMock()
    coordinator.on_status.side_effect = RuntimeError("Status handler error")
    training_service = TrainingService(sampling_coordinator=coordinator)

    # Should not raise exception
    training_service._handle_status("Training ...")
    coordinator.on_status.assert_called_once()


def test_handle_default_sample_exception_handled_gracefully():
    coordinator = MagicMock()
    coordinator.on_default_sample.side_effect = RuntimeError("Sample handler error")
    training_service = TrainingService(sampling_coordinator=coordinator)

    # Should not raise exception
    training_service._handle_default_sample(object())
    coordinator.on_default_sample.assert_called_once()


def test_auto_create_default_samples_when_concepts_not_none(tmp_path, monkeypatch):
    training_service = TrainingService()

    def fake_create_trainer(train_config, callbacks, commands):
        return FakeTrainer(callbacks, commands)

    mock_create = MagicMock(create_trainer=fake_create_trainer)
    monkeypatch.setitem(sys.modules, "modules.util.create", mock_create)

    config = valid_config_dict()
    config["concepts"] = [{"name": "concept1"}]
    config["samples"] = None
    sample_file = tmp_path / "sub" / "samples.json"
    config["sample_definition_file_name"] = str(sample_file)

    _original_run_training_worker(training_service, config)
    assert sample_file.exists()





