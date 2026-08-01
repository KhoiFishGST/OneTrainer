from modules.webui.events import EventBus, EventType
from modules.webui.training import TrainingService, TrainingState

import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"



def test_training_service_emits_metric_and_state_events():
    bus = EventBus()
    service = TrainingService(event_bus=bus)
    service.record_metric(step=1, epoch=1, loss=0.5, lr=0.001)
    snapshot = service.get_metrics()
    assert len(snapshot) == 1
    assert snapshot[0]["loss"] == 0.5


@pytest.mark.anyio
async def test_training_service_event_broadcasting():
    bus = EventBus()
    await bus.start()
    subscription = bus.subscribe()
    iterator = subscription.__aiter__()

    service = TrainingService(event_bus=bus)

    # 1. Test metric recording & event broadcasting
    service.record_metric(step=1, epoch=1, loss=0.42, lr=0.0001)
    event1 = await iterator.__anext__()
    assert event1["type"] == EventType.TRAINING_METRIC
    assert event1["loss"] == 0.42
    assert event1["step"] == 1

    # 2. Test state change event broadcasting
    service.start_training({"max_steps": 100, "base_model_name": "mock"})
    event2 = await iterator.__anext__()
    assert event2["type"] == EventType.TRAINING_STATE
    assert event2["state"] == TrainingState.TRAINING
    assert event2["max_steps"] == 100

    # 3. Test sample recording event broadcasting
    service.record_sample(id="sample_1", step=10, url="/api/training/samples/sample_1/image")
    event3 = await iterator.__anext__()
    assert event3["type"] == EventType.TRAINING_SAMPLE
    assert event3["id"] == "sample_1"

    # 4. Test GPU stat broadcasting
    service.emit_gpu_stat(vram_used_mb=4096, vram_total_mb=16384)
    event4 = await iterator.__anext__()
    assert event4["type"] == EventType.GPU_STAT
    assert event4["vram_used_mb"] == 4096

    await subscription.aclose()
    await bus.close()


def test_metric_ring_buffer_limit():
    service = TrainingService()
    # Insert 10,005 metrics
    for i in range(1, 10006):
        service.record_metric(step=i, loss=1.0 / i)

    metrics = service.get_metrics()
    assert len(metrics) == 10000
    assert metrics[0]["step"] == 6
    assert metrics[-1]["step"] == 10005


def test_event_type_gallery_warning():
    assert EventType.GALLERY_WARNING == "gallery_warning"
    assert str(EventType.GALLERY_WARNING) == "gallery_warning"



class _FakeMemInfo:
    def __init__(self, used, total):
        self.used = used
        self.total = total


class _FakeUtil:
    def __init__(self, gpu):
        self.gpu = gpu


class _FakeNvml:
    """Stands in for pynvml. Two devices, distinct readings per device."""

    NVML_TEMPERATURE_GPU = 0

    def __init__(self, names, *, name_as_bytes=False):
        self._names = names
        self._name_as_bytes = name_as_bytes
        self.init_calls = 0
        self.shutdown_calls = 0

    def nvmlInit(self):
        self.init_calls += 1

    def nvmlShutdown(self):
        self.shutdown_calls += 1

    def nvmlDeviceGetCount(self):
        return len(self._names)

    def nvmlDeviceGetHandleByIndex(self, index):
        return index

    def nvmlDeviceGetName(self, handle):
        name = self._names[handle]
        return name.encode("utf-8") if self._name_as_bytes else name

    def nvmlDeviceGetMemoryInfo(self, handle):
        return _FakeMemInfo(used=(handle + 1) * 1000, total=(handle + 1) * 4000)

    def nvmlDeviceGetUtilizationRates(self, handle):
        return _FakeUtil(gpu=(handle + 1) * 10)

    def nvmlDeviceGetTemperature(self, handle, sensor):
        return (handle + 1) * 30


def _install_fake_nvml(monkeypatch, fake):
    import sys

    monkeypatch.setitem(sys.modules, "pynvml", fake)
    # Keep torch out of it so the readings are unambiguously nvml's.
    monkeypatch.setitem(sys.modules, "torch", None)


def test_gpu_stats_lists_every_device_with_its_name(monkeypatch):
    fake = _FakeNvml(["NVIDIA GeForce RTX 5090", "NVIDIA GeForce RTX 4090"])
    _install_fake_nvml(monkeypatch, fake)

    stats = TrainingService(event_bus=EventBus()).get_gpu_stats()

    assert [d["name"] for d in stats["devices"]] == [
        "NVIDIA GeForce RTX 5090",
        "NVIDIA GeForce RTX 4090",
    ]
    assert [d["index"] for d in stats["devices"]] == [0, 1]
    assert stats["devices"][1]["vram_used"] == 2000
    assert stats["devices"][1]["vram_total"] == 8000
    assert stats["devices"][1]["utilization"] == 20.0
    assert stats["devices"][1]["temperature"] == 60.0


def test_gpu_stats_keeps_flat_fields_for_the_first_device(monkeypatch):
    """The flat shape predates `devices`; existing consumers still read it."""
    fake = _FakeNvml(["NVIDIA GeForce RTX 5090", "NVIDIA GeForce RTX 4090"])
    _install_fake_nvml(monkeypatch, fake)

    stats = TrainingService(event_bus=EventBus()).get_gpu_stats()

    assert stats["vram_used"] == 1000
    assert stats["vram_total"] == 4000
    assert stats["utilization"] == 10.0
    assert stats["temperature"] == 30.0
    assert stats["name"] == "NVIDIA GeForce RTX 5090"


def test_gpu_stats_decodes_byte_device_names(monkeypatch):
    """Older pynvml returns bytes from nvmlDeviceGetName; newer returns str."""
    fake = _FakeNvml(["NVIDIA GeForce RTX 5090"], name_as_bytes=True)
    _install_fake_nvml(monkeypatch, fake)

    stats = TrainingService(event_bus=EventBus()).get_gpu_stats()

    assert stats["devices"][0]["name"] == "NVIDIA GeForce RTX 5090"


def test_gpu_stats_releases_nvml_after_each_poll(monkeypatch):
    """Polled once a second for hours; every init needs a matching shutdown."""
    fake = _FakeNvml(["NVIDIA GeForce RTX 5090"])
    _install_fake_nvml(monkeypatch, fake)

    service = TrainingService(event_bus=EventBus())
    service.get_gpu_stats()
    service.get_gpu_stats()

    assert fake.init_calls == 2
    assert fake.shutdown_calls == 2


def test_gpu_stats_without_any_gpu_library(monkeypatch):
    import sys

    monkeypatch.setitem(sys.modules, "pynvml", None)
    monkeypatch.setitem(sys.modules, "torch", None)

    stats = TrainingService(event_bus=EventBus()).get_gpu_stats()

    assert stats["devices"] == []
    assert stats["vram_used"] == 0
    assert stats["vram_total"] == 0
    assert stats.get("name") is None
