import threading

from modules.api.rest.errors import ConflictError
from modules.api.rest.service import TrainingService
from modules.util.config.TrainConfig import TrainConfig
from modules.util.TrainProgress import TrainProgress

import pytest


class FakeTrainer:
    """Stands in for GenericTrainer. Blocks in train() until released, so a test
    can observe the running state deterministically instead of racing it."""

    def __init__(self, config, callbacks, commands):
        self.config = config
        self.callbacks = callbacks
        self.commands = commands
        self.started = False
        self.ended = False
        self.entered_train = threading.Event()
        self.release = threading.Event()
        self.raise_on_train: Exception | None = None

    def start(self):
        self.started = True

    def train(self):
        self.entered_train.set()
        self.release.wait(timeout=5)
        if self.raise_on_train is not None:
            raise self.raise_on_train

    def end(self):
        self.ended = True


class FakeFactory:
    def __init__(self):
        self.trainer: FakeTrainer | None = None

    def __call__(self, config, callbacks, commands):
        self.trainer = FakeTrainer(config, callbacks, commands)
        return self.trainer


@pytest.fixture
def factory():
    return FakeFactory()


@pytest.fixture
def service(factory):
    return TrainingService(trainer_factory=factory)


def _config() -> TrainConfig:
    return TrainConfig.default_values()


def _wait_for_state(service, state, timeout=5.0):
    deadline = threading.Event()
    for _ in range(int(timeout / 0.01)):
        if service.status()["state"] == state:
            return
        deadline.wait(0.01)
    raise AssertionError(f"never reached state {state!r}; last was {service.status()['state']!r}")


def test_status_before_any_run_is_idle(service):
    status = service.status()
    assert status["state"] == "idle"
    assert status["run_id"] is None
    assert status["started_at"] is None
    assert status["step"] == 0
    assert status["error"] is None


def test_start_returns_a_run_id_that_appears_in_status(service, factory):
    run_id = service.start(_config())
    assert service.status()["run_id"] == run_id
    factory.trainer.release.set()


def test_start_while_active_conflicts_and_reports_the_active_run_id(service, factory):
    run_id = service.start(_config())
    with pytest.raises(ConflictError) as excinfo:
        service.start(_config())
    assert excinfo.value.details == {"run_id": run_id}
    factory.trainer.release.set()


def test_state_becomes_running_once_the_trainer_loop_is_entered(service, factory):
    service.start(_config())
    _wait_for_state(service, "running")
    assert factory.trainer.started is True
    factory.trainer.release.set()


def test_a_finished_run_completes_and_calls_end(service, factory):
    service.start(_config())
    _wait_for_state(service, "running")
    factory.trainer.release.set()
    _wait_for_state(service, "completed")
    assert factory.trainer.ended is True


def test_a_failing_run_reports_failed_with_the_error_type_and_message(service, factory):
    service.start(_config())
    _wait_for_state(service, "running")
    factory.trainer.raise_on_train = RuntimeError("cuda go boom")
    factory.trainer.release.set()
    _wait_for_state(service, "failed")
    assert service.status()["error"] == {"type": "RuntimeError", "message": "cuda go boom"}


def test_terminal_state_is_sticky_so_a_late_poll_still_learns_the_outcome(service, factory):
    service.start(_config())
    _wait_for_state(service, "running")
    factory.trainer.release.set()
    _wait_for_state(service, "completed")
    assert service.status()["state"] == "completed"
    assert service.status()["state"] == "completed"


def test_elapsed_seconds_freezes_once_the_run_ends(service, factory):
    service.start(_config())
    _wait_for_state(service, "running")
    factory.trainer.release.set()
    _wait_for_state(service, "completed")
    first = service.status()["elapsed_seconds"]
    threading.Event().wait(0.05)
    assert service.status()["elapsed_seconds"] == first


def test_status_callback_populates_the_message_field(service, factory):
    service.start(_config())
    _wait_for_state(service, "running")
    factory.trainer.callbacks.on_update_status("caching")
    assert service.status()["message"] == "caching"
    factory.trainer.release.set()


def test_progress_callback_maps_onto_the_raw_counters(service, factory):
    service.start(_config())
    _wait_for_state(service, "running")

    # GenericTrainer.py:832 passes current_epoch_length as the 2nd argument --
    # steps per epoch, not a total. max_steps is the product.
    progress = TrainProgress(epoch=3, epoch_step=142, global_step=1642)
    factory.trainer.callbacks.on_update_train_progress(progress, 500, 10)

    status = service.status()
    assert status["epoch"] == 3
    assert status["max_epochs"] == 10
    assert status["epoch_step"] == 142
    assert status["epoch_length"] == 500
    assert status["step"] == 1642
    assert status["max_steps"] == 5000
    factory.trainer.release.set()


def test_subclass_hooks_fire_around_the_run(service, factory):
    seen = []

    class Recording(TrainingService):
        def _on_run_begin(self, run_id, config):
            seen.append(("begin", run_id))

        def _on_run_end(self, run_id, state):
            seen.append(("end", run_id, state))

        def _on_status(self, message):
            seen.append(("status", message))

    recording = Recording(trainer_factory=factory)
    run_id = recording.start(_config())
    _wait_for_state(recording, "running")
    factory.trainer.callbacks.on_update_status("caching")
    factory.trainer.release.set()
    _wait_for_state(recording, "completed")

    assert ("begin", run_id) in seen
    assert ("status", "caching") in seen
    assert ("end", run_id, "completed") in seen


def test_a_raising_hook_does_not_break_the_run(service, factory):
    class Broken(TrainingService):
        def _on_status(self, message):
            raise ValueError("hook is broken")

    broken = Broken(trainer_factory=factory)
    broken.start(_config())
    _wait_for_state(broken, "running")
    factory.trainer.callbacks.on_update_status("caching")
    assert broken.status()["message"] == "caching"
    factory.trainer.release.set()
    _wait_for_state(broken, "completed")
