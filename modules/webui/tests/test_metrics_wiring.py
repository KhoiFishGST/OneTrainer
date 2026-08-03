from pathlib import Path

from modules.webui.metrics_store import METRICS_FILENAME, read_rows
from modules.webui.training import TrainingService


class RecordingStore:
    def __init__(self):
        self.rows = []
        self.began = 0
        self.ended = 0

    def begin_training(self):
        self.began += 1

    def record(self, row):
        self.rows.append(row)

    def end_training(self):
        self.ended += 1


def test_record_metric_forwards_to_the_store():
    store = RecordingStore()
    service = TrainingService(metrics_store=store)

    service.record_metric({"step": 1, "loss_train_step": 0.5})

    assert len(store.rows) == 1
    assert store.rows[0]["loss_train_step"] == 0.5
    # The live deque still receives it too.
    assert len(service.get_metrics()) == 1


def test_record_metric_survives_a_broken_store():
    class Exploding:
        def record(self, row):
            raise RuntimeError("disk on fire")

    service = TrainingService(metrics_store=Exploding())

    service.record_metric({"step": 1})  # must not raise

    assert len(service.get_metrics()) == 1


def test_record_metric_works_without_a_store():
    service = TrainingService()
    service.record_metric({"step": 1})
    assert len(service.get_metrics()) == 1


def test_buffered_rows_land_on_disk_once_the_run_is_identified(tmp_path):
    from modules.util.config.TrainConfig import TrainConfig
    from modules.webui.metrics_store import MetricsStore
    from modules.webui.run_session import RunSession

    workspace = tmp_path / "ws"
    (workspace / "config").mkdir(parents=True)
    session = RunSession(root_dir=tmp_path, workspace_provider=lambda: workspace)
    config = TrainConfig.default_values()
    config.save_filename_prefix = ""
    session.begin(config)

    store = MetricsStore(run_session=session, flush_rows=1)
    service = TrainingService(metrics_store=store)

    store.begin_training()
    service.record_metric({"step": 1, "loss_train_step": 0.5})
    service.record_metric({"step": 2, "loss_train_step": 0.4})

    (workspace / "config" / "run-a.json").write_text("{}", encoding="utf-8")
    run_dir = workspace / "web" / "samples" / "run-a"

    service.record_metric({"step": 3, "loss_train_step": 0.3})

    assert [r["step"] for r in read_rows(run_dir / METRICS_FILENAME)] == [1, 2, 3]