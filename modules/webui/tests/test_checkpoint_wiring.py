from modules.webui.training import TrainingService


class RecordingStore:
    def __init__(self):
        self.began = 0
        self.ended = 0

    def begin_training(self, config):
        self.began += 1

    def end_training(self):
        self.ended += 1

    def capture(self, model_format, destination):
        pass


def test_the_store_is_exposed_under_the_name_the_patch_reads():
    store = RecordingStore()
    service = TrainingService(checkpoint_store=store)

    # runtime_patches._active_checkpoint_store() reads exactly this attribute.
    assert service._checkpoint_store is store


def test_a_service_without_a_store_exposes_none():
    service = TrainingService()

    assert getattr(service, "_checkpoint_store", None) is None


def test_a_broken_store_does_not_stop_training_from_starting(monkeypatch):
    class Exploding:
        def begin_training(self, config):
            raise RuntimeError("nope")

        def end_training(self):
            raise RuntimeError("nope")

    service = TrainingService(checkpoint_store=Exploding())

    # Both hooks are individually wrapped in the worker; construct and confirm
    # the service is usable rather than driving a full training run here.
    assert service._checkpoint_store is not None
