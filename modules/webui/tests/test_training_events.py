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

