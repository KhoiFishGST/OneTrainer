import json
from pathlib import Path

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.metrics_store import METRICS_FILENAME, MetricsStore, read_rows
from modules.webui.run_session import RunSession

import pytest


@pytest.fixture
def run_dir(tmp_path):
    d = tmp_path / "run"
    d.mkdir()
    return d



@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    (ws / "config").mkdir(parents=True)
    return ws


@pytest.fixture
def train_config() -> TrainConfig:
    config = TrainConfig.default_values()
    config.save_filename_prefix = ""
    return config


@pytest.fixture
def session(tmp_path: Path, workspace: Path) -> RunSession:
    return RunSession(root_dir=tmp_path, workspace_provider=lambda: workspace)


def _identify_run(session, workspace, train_config, run_key="run-a") -> Path:
    """Make the session resolvable, and return the directory metrics will use."""
    (workspace / "config" / f"{run_key}.json").write_text("{}", encoding="utf-8")
    return workspace / "web" / "samples" / run_key


def _rows(run_dir):
    return read_rows(run_dir / METRICS_FILENAME)


def test_rows_recorded_before_binding_are_flushed_in_order(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()

    store.record({"step": 1, "loss_train_step": 0.5})
    store.record({"step": 2, "loss_train_step": 0.4})

    run_dir = _identify_run(session, workspace, train_config)
    assert not (run_dir / METRICS_FILENAME).exists()

    store.record({"step": 3, "loss_train_step": 0.3})

    assert [r["step"] for r in _rows(run_dir)] == [1, 2, 3]


def test_rows_recorded_after_binding_append_after_buffered_rows(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()
    store.record({"step": 1, "loss_train_step": 0.5})
    run_dir = _identify_run(session, workspace, train_config)
    store.record({"step": 2, "loss_train_step": 0.4})
    store.end_training()

    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_buffer_cap_drops_oldest_rows(session, workspace, train_config):
    store = MetricsStore(run_session=session, buffer_limit=3, flush_rows=1)
    session.begin(train_config)
    store.begin_training()
    for step in range(6):
        store.record({"step": step})

    run_dir = _identify_run(session, workspace, train_config)
    store.record({"step": 6})

    assert [r["step"] for r in _rows(run_dir)] == [4, 5, 6]


def test_flush_triggers_on_row_count(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=2, flush_seconds=10_000)
    session.begin(train_config)
    store.begin_training()
    run_dir = _identify_run(session, workspace, train_config)

    store.record({"step": 1})
    assert _rows(run_dir) == []

    store.record({"step": 2})
    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_flush_triggers_on_elapsed_time(session, workspace, train_config):
    clock = {"now": 0.0}
    store = MetricsStore(run_session=session, flush_rows=10_000, flush_seconds=5.0, time_source=lambda: clock["now"])
    session.begin(train_config)
    store.begin_training()
    run_dir = _identify_run(session, workspace, train_config)

    store.record({"step": 1})
    assert _rows(run_dir) == []

    clock["now"] = 6.0
    store.record({"step": 2})
    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_end_training_flushes_remaining_rows(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=10_000, flush_seconds=10_000)
    session.begin(train_config)
    store.begin_training()
    run_dir = _identify_run(session, workspace, train_config)
    store.record({"step": 1})

    assert _rows(run_dir) == []

    store.end_training()
    assert [r["step"] for r in _rows(run_dir)] == [1]


def test_begin_training_discards_a_previous_runs_buffer(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()
    store.record({"step": 99})

    session.begin(train_config)
    store.begin_training()
    run_dir = _identify_run(session, workspace, train_config)
    store.record({"step": 1})
    store.record({"step": 2})

    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_read_rows_skips_a_torn_final_line(run_dir):
    # Appends are not atomic, so a kill mid-write leaves a partial last line.
    path = run_dir / METRICS_FILENAME
    path.write_text('{"step": 1}\n{"step": 2}\n{"step": 3, "loss', encoding="utf-8")

    assert [r["step"] for r in read_rows(path)] == [1, 2]


def test_read_rows_skips_non_object_lines(run_dir):
    path = run_dir / METRICS_FILENAME
    path.write_text('{"step": 1}\n[1,2,3]\n"scalar"\n{"step": 2}\n', encoding="utf-8")

    assert [r["step"] for r in read_rows(path)] == [1, 2]


def test_read_rows_returns_empty_for_missing_file(run_dir):
    assert read_rows(run_dir / METRICS_FILENAME) == []


def test_write_failure_disables_persistence_without_raising(session, workspace, train_config):
    # A full disk must never take down a six-hour training run.
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()
    run_dir = _identify_run(session, workspace, train_config)
    store.record({"step": 1})

    # Replace the file with a directory so subsequent appends fail.
    path = run_dir / METRICS_FILENAME
    path.unlink()
    path.mkdir()

    store.record({"step": 2})   # must not raise
    store.record({"step": 3})   # must not raise
    store.end_training()        # must not raise


def test_record_before_begin_training_does_not_raise():
    store = MetricsStore()
    store.record({"step": 1})  # must not raise


def test_rows_are_written_as_one_compact_json_object_per_line(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()
    run_dir = _identify_run(session, workspace, train_config)
    store.record({"step": 1, "loss_train_step": 0.5})
    store.end_training()

    text = (run_dir / METRICS_FILENAME).read_text(encoding="utf-8")
    assert text == '{"step":1,"loss_train_step":0.5}\n'
    assert json.loads(text.strip())["step"] == 1


def _write_run(run_dir, steps, scalars_per_step=1):
    """Write a metrics file the way the store does: one row per scalar."""
    lines = [
        json.dumps({"step": step, f"metric_{scalar}": float(step)})
        for step in range(steps)
        for scalar in range(scalars_per_step)
    ]
    (run_dir / METRICS_FILENAME).write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_read_rows_returns_everything_when_under_the_limit(run_dir):
    _write_run(run_dir, steps=10)

    rows = read_rows(run_dir / METRICS_FILENAME, limit=100)

    assert [r["step"] for r in rows] == list(range(10))


def test_read_rows_downsamples_instead_of_truncating(run_dir):
    # The whole curve at lower resolution beats a truncated prefix: the last
    # step must survive, or the chart would appear to stop early.
    _write_run(run_dir, steps=1000)

    rows = read_rows(run_dir / METRICS_FILENAME, limit=100)

    assert len(rows) <= 100
    assert rows[0]["step"] == 0
    assert rows[-1]["step"] >= 990


def test_read_rows_downsampling_keeps_every_series(run_dir):
    # Regression: sampling by row rather than by step meant a stride that
    # matched the number of scalars per step kept one series and dropped the
    # rest, blanking a whole chart.
    _write_run(run_dir, steps=400, scalars_per_step=4)

    rows = read_rows(run_dir / METRICS_FILENAME, limit=100)

    present = {key for row in rows for key in row if key != "step"}
    assert present == {"metric_0", "metric_1", "metric_2", "metric_3"}


def test_read_rows_without_a_limit_returns_every_row(run_dir):
    _write_run(run_dir, steps=50, scalars_per_step=2)

    rows = read_rows(run_dir / METRICS_FILENAME)

    assert len(rows) == 100


def test_read_rows_skips_a_torn_final_line_when_downsampling(run_dir):
    _write_run(run_dir, steps=200)
    with (run_dir / METRICS_FILENAME).open("a", encoding="utf-8") as handle:
        handle.write('{"step": 999, "loss')

    rows = read_rows(run_dir / METRICS_FILENAME, limit=20)

    assert all(r["step"] < 200 for r in rows)

def test_metrics_persist_for_a_run_that_never_samples(session, workspace, train_config):
    # Previously metrics rode the gallery's run_resolved_sink, which only fires
    # on the first sample batch, so a run with sampling disabled saved nothing.
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()

    run_dir = _identify_run(session, workspace, train_config)

    store.record({"step": 1, "loss_train_step": 0.5})
    store.end_training()

    assert [r["step"] for r in read_rows(run_dir / METRICS_FILENAME)] == [1]


def test_buffered_rows_survive_until_the_run_is_identifiable(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()

    # Recorded before any config exists -- the session cannot resolve yet.
    store.record({"step": 1})
    store.record({"step": 2})

    run_dir = _identify_run(session, workspace, train_config)
    store.record({"step": 3})
    store.end_training()

    assert [r["step"] for r in read_rows(run_dir / METRICS_FILENAME)] == [1, 2, 3]


def test_an_unidentifiable_run_persists_nothing_and_does_not_raise(session, workspace, train_config):
    store = MetricsStore(run_session=session, flush_rows=1)
    session.begin(train_config)
    store.begin_training()

    (workspace / "config" / "a.json").write_text("{}", encoding="utf-8")
    (workspace / "config" / "b.json").write_text("{}", encoding="utf-8")

    store.record({"step": 1})
    store.end_training()

    assert not (workspace / "web" / "samples").exists()

