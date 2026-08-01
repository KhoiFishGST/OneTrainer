import json

from modules.webui.metrics_store import METRICS_FILENAME, MetricsStore, read_rows

import pytest


@pytest.fixture
def run_dir(tmp_path):
    d = tmp_path / "run"
    d.mkdir()
    return d


def _rows(run_dir):
    return read_rows(run_dir / METRICS_FILENAME)


def test_rows_recorded_before_binding_are_flushed_in_order(run_dir):
    # The gallery only resolves a run directory on the first sample batch, but
    # metrics start at step 1 -- so early rows must survive in memory.
    store = MetricsStore()
    store.begin_training()
    store.record({"step": 1, "loss_train_step": 0.5})
    store.record({"step": 2, "loss_train_step": 0.4})

    assert not (run_dir / METRICS_FILENAME).exists()

    store.bind_run_dir(run_dir)

    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_rows_recorded_after_binding_append_after_buffered_rows(run_dir):
    store = MetricsStore(flush_rows=1)
    store.begin_training()
    store.record({"step": 1, "loss_train_step": 0.5})
    store.bind_run_dir(run_dir)
    store.record({"step": 2, "loss_train_step": 0.4})
    store.end_training()

    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_buffer_cap_drops_oldest_rows(run_dir):
    store = MetricsStore(buffer_limit=3)
    store.begin_training()
    for step in range(6):
        store.record({"step": step})
    store.bind_run_dir(run_dir)

    assert [r["step"] for r in _rows(run_dir)] == [3, 4, 5]


def test_flush_triggers_on_row_count(run_dir):
    store = MetricsStore(flush_rows=2, flush_seconds=10_000)
    store.begin_training()
    store.bind_run_dir(run_dir)

    store.record({"step": 1})
    assert _rows(run_dir) == []

    store.record({"step": 2})
    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_flush_triggers_on_elapsed_time(run_dir):
    clock = {"now": 0.0}
    store = MetricsStore(flush_rows=10_000, flush_seconds=5.0, time_source=lambda: clock["now"])
    store.begin_training()
    store.bind_run_dir(run_dir)

    store.record({"step": 1})
    assert _rows(run_dir) == []

    clock["now"] = 6.0
    store.record({"step": 2})
    assert [r["step"] for r in _rows(run_dir)] == [1, 2]


def test_end_training_flushes_remaining_rows(run_dir):
    store = MetricsStore(flush_rows=10_000, flush_seconds=10_000)
    store.begin_training()
    store.bind_run_dir(run_dir)
    store.record({"step": 1})

    assert _rows(run_dir) == []

    store.end_training()
    assert [r["step"] for r in _rows(run_dir)] == [1]


def test_begin_training_discards_a_previous_runs_buffer(run_dir):
    store = MetricsStore()
    store.begin_training()
    store.record({"step": 99})

    store.begin_training()
    store.record({"step": 1})
    store.bind_run_dir(run_dir)

    assert [r["step"] for r in _rows(run_dir)] == [1]


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


def test_write_failure_disables_persistence_without_raising(run_dir):
    # A full disk must never take down a six-hour training run.
    store = MetricsStore(flush_rows=1)
    store.begin_training()
    store.bind_run_dir(run_dir)
    store.record({"step": 1})

    # Replace the file with a directory so subsequent appends fail.
    path = run_dir / METRICS_FILENAME
    path.unlink()
    path.mkdir()

    store.record({"step": 2})   # must not raise
    store.record({"step": 3})   # must not raise
    store.end_training()        # must not raise


def test_record_before_begin_training_does_not_raise(run_dir):
    store = MetricsStore()
    store.record({"step": 1})  # must not raise


def test_rows_are_written_as_one_compact_json_object_per_line(run_dir):
    store = MetricsStore(flush_rows=1)
    store.begin_training()
    store.bind_run_dir(run_dir)
    store.record({"step": 1, "loss_train_step": 0.5})
    store.end_training()

    text = (run_dir / METRICS_FILENAME).read_text(encoding="utf-8")
    assert text == '{"step":1,"loss_train_step":0.5}\n'
    assert json.loads(text.strip())["step"] == 1
