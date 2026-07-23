import pytest
from modules.webui.training import TrainingService, TrainingState

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
    service.start_training({"max_steps": 500})
    assert service.get_status()["state"] == TrainingState.TRAINING

    # TRAINING -> PAUSED
    service.pause_training()
    assert service.get_status()["state"] == TrainingState.PAUSED

    # PAUSED -> TRAINING
    service.resume_training()
    assert service.get_status()["state"] == TrainingState.TRAINING

    # TRAINING -> STOPPING
    service.stop_training()
    assert service.get_status()["state"] == TrainingState.STOPPING

    # Transition to COMPLETED from STOPPING or TRAINING
    service.set_completed()
    assert service.get_status()["state"] == TrainingState.COMPLETED

    # COMPLETED -> start_training -> TRAINING
    service.start_training({"max_steps": 200})
    assert service.get_status()["state"] == TrainingState.TRAINING

    # Transition to FAILED
    service.set_failed("Out of memory error")
    assert service.get_status()["state"] == TrainingState.FAILED
    assert service.get_status()["error_message"] == "Out of memory error"

    # FAILED -> start_training -> TRAINING
    service.start_training({"max_steps": 300})
    assert service.get_status()["state"] == TrainingState.TRAINING
    assert service.get_status()["error_message"] is None


def test_invalid_state_transitions():
    service = TrainingService()

    # Cannot pause, resume, or stop when IDLE
    with pytest.raises(RuntimeError, match="Cannot pause training"):
        service.pause_training()
        
    with pytest.raises(RuntimeError, match="Cannot resume training"):
        service.resume_training()

    with pytest.raises(RuntimeError, match="Cannot stop training"):
        service.stop_training()

    # Start training
    service.start_training({})

    # Cannot start training when already TRAINING
    with pytest.raises(RuntimeError, match="Cannot start training"):
        service.start_training({})

    # Pause training
    service.pause_training()

    # Cannot start training when PAUSED
    with pytest.raises(RuntimeError, match="Cannot start training"):
        service.start_training({})

    # Cannot pause training when PAUSED
    with pytest.raises(RuntimeError, match="Cannot pause training"):
        service.pause_training()

    # Resume training
    service.resume_training()

    # Stop training
    service.stop_training()

    # Cannot stop training when already STOPPING
    with pytest.raises(RuntimeError, match="Cannot stop training"):
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
