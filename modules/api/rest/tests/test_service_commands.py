import threading

from modules.api.rest.errors import NoActiveRunError
from modules.api.rest.service import TrainingService
from modules.util.config.SampleConfig import SampleConfig
from modules.util.config.TrainConfig import TrainConfig

import pytest


class FakeTrainer:
    def __init__(self, config, callbacks, commands):
        self.config = config
        self.callbacks = callbacks
        self.commands = commands
        self.ended = False
        self.release = threading.Event()

    def start(self):
        pass

    def train(self):
        self.release.wait(timeout=5)

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


def _wait_for_state(service, state, timeout=5.0):
    waiter = threading.Event()
    for _ in range(int(timeout / 0.01)):
        if service.status()["state"] == state:
            return
        waiter.wait(0.01)
    raise AssertionError(f"never reached state {state!r}; last was {service.status()['state']!r}")


@pytest.fixture
def running(service, factory):
    service.start(TrainConfig.default_values())
    _wait_for_state(service, "running")
    return service


@pytest.mark.parametrize("command", ["stop", "sample", "backup", "save"])
def test_commands_without_an_active_run_are_rejected(service, command):
    with pytest.raises(NoActiveRunError):
        getattr(service, command)()


def test_stop_raises_the_stop_flag_and_moves_to_stopping(running, factory):
    running.stop()
    assert running.status()["state"] == "stopping"
    assert factory.trainer.commands.get_stop_command() is True
    factory.trainer.release.set()


def test_a_stopped_run_ends_as_canceled(running, factory):
    running.stop()
    factory.trainer.release.set()
    _wait_for_state(running, "canceled")


def test_sample_without_a_config_requests_the_default_sample(running, factory):
    running.sample()
    assert factory.trainer.commands.get_and_reset_sample_default_command() is True
    factory.trainer.release.set()


def test_sample_with_a_config_requests_a_custom_sample(running, factory):
    sample = SampleConfig.default_values()
    running.sample(sample)
    assert factory.trainer.commands.get_and_reset_sample_custom_commands() == [sample]
    assert factory.trainer.commands.get_and_reset_sample_default_command() is False
    factory.trainer.release.set()


def test_backup_requests_a_backup(running, factory):
    running.backup()
    assert factory.trainer.commands.get_and_reset_backup_command() is True
    factory.trainer.release.set()


def test_save_requests_a_save(running, factory):
    running.save()
    assert factory.trainer.commands.get_and_reset_save_command() is True
    factory.trainer.release.set()


class SlowStartTrainer:
    """A trainer whose model load blocks, so a stop can race it deterministically."""

    def __init__(self, config, callbacks, commands):
        self.commands = commands
        self.in_start = threading.Event()
        self.finish_start = threading.Event()
        self.in_train = threading.Event()
        self.release = threading.Event()

    def start(self):
        self.in_start.set()
        self.finish_start.wait(timeout=5)

    def train(self):
        self.in_train.set()
        self.release.wait(timeout=5)

    def end(self):
        pass


def test_stop_during_a_slow_model_load_is_not_clobbered_back_to_running():
    # trainer.start() can take minutes. A stop arriving during it sets
    # "stopping"; the worker must not drop the run back to "running" once
    # start() returns -- the documented state machine has no such backwards
    # transition, and a polling client would watch its stop get undone.
    holder = {}

    def factory(config, callbacks, commands):
        holder["trainer"] = SlowStartTrainer(config, callbacks, commands)
        return holder["trainer"]

    service = TrainingService(trainer_factory=factory)
    service.start(TrainConfig.default_values())

    waiter = threading.Event()
    while "trainer" not in holder:
        waiter.wait(0.01)
    trainer = holder["trainer"]

    assert trainer.in_start.wait(timeout=5)
    assert service.status()["state"] == "starting"

    service.stop()
    assert service.status()["state"] == "stopping"

    # Let the model load finish. The worker now reaches its "running"
    # transition, which must be declined because a stop already landed.
    trainer.finish_start.set()
    assert trainer.in_train.wait(timeout=5)
    assert service.status()["state"] == "stopping"

    trainer.release.set()
    _wait_for_state(service, "canceled")


def test_commands_after_the_run_finished_are_rejected(running, factory):
    factory.trainer.release.set()
    _wait_for_state(running, "completed")
    with pytest.raises(NoActiveRunError):
        running.backup()
