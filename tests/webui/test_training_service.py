import pytest
from modules.webui.training import TrainingService, TrainingState

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

