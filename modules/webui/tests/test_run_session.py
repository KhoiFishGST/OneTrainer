import os
from pathlib import Path

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.run_session import RunSession

import pytest


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    (ws / "config").mkdir(parents=True)
    return ws


@pytest.fixture
def warnings() -> list[tuple[str, dict]]:
    return []


@pytest.fixture
def session(tmp_path: Path, workspace: Path, warnings: list) -> RunSession:
    return RunSession(
        root_dir=tmp_path,
        workspace_provider=lambda: workspace,
        warning_sink=lambda message, payload: warnings.append((message, payload)),
    )


@pytest.fixture
def train_config() -> TrainConfig:
    config = TrainConfig.default_values()
    config.save_filename_prefix = ""
    return config


def _write_config(workspace: Path, name: str, *, mtime: float | None = None) -> Path:
    path = workspace / "config" / f"{name}.json"
    path.write_text("{}", encoding="utf-8")
    if mtime is not None:
        os.utime(path, (mtime, mtime))
    return path


def test_resolves_the_single_new_config(session, workspace, train_config):
    session.begin(train_config)
    _write_config(workspace, "run-a")

    assert session.run_key() == "run-a"
    assert session.run_info()["config_filename"] == "run-a.json"


def test_a_concurrent_second_trainer_no_longer_defeats_resolution(
    session, workspace, train_config, warnings
):
    # The incident: a second OneTrainer wrote into the same workspace 21s later,
    # producing two candidates, and every consumer disabled itself.
    session.begin(train_config)
    session.note_writer("/ws/tensorboard/2026-08-03_11-30-13")

    _write_config(workspace, "2026-08-03_11-30-13")
    _write_config(workspace, "2026-08-03_11-30-34")

    assert session.run_key() == "2026-08-03_11-30-13"
    assert warnings == []


def test_a_one_second_timestamp_skew_resolves_by_closest_mtime(
    session, workspace, train_config, warnings
):
    # The tensorboard directory name and the run key come from separate
    # get_string_timestamp() calls, so they disagree across a second boundary.
    # An exact stem match fails here; closest config mtime must win.
    session.begin(train_config)
    session.note_writer("/ws/tensorboard/2026-08-03_11-30-13")
    seen_at = session.hint_seen_at

    _write_config(workspace, "2026-08-03_11-30-14", mtime=seen_at + 1.0)
    _write_config(workspace, "2026-08-03_11-30-40", mtime=seen_at + 27.0)

    assert session.run_key() == "2026-08-03_11-30-14"
    assert warnings == []


def test_ambiguity_without_a_hint_fails_loudly(session, workspace, train_config, warnings):
    session.begin(train_config)
    _write_config(workspace, "a")
    _write_config(workspace, "b")

    assert session.run_key() is None
    assert len(warnings) == 1
    assert "another OneTrainer instance" in warnings[0][0]
    assert warnings[0][1]["reason"] == "ambiguous"


def test_no_candidate_fails_loudly(session, workspace, train_config, warnings):
    session.begin(train_config)

    assert session.run_key() is None
    assert len(warnings) == 1
    assert warnings[0][1]["reason"] == "missing"


def test_resolution_runs_at_most_once_even_when_it_fails(
    session, workspace, train_config, warnings, monkeypatch
):
    # resolve() hashes every json in the directory and callers sit on hot paths,
    # so a retried failure would hash once per metric row.
    session.begin(train_config)

    calls = []
    original = session._resolver.candidates
    monkeypatch.setattr(
        session._resolver, "candidates", lambda *a, **k: (calls.append(1), original(*a, **k))[1]
    )

    for _ in range(5):
        assert session.run_key() is None

    assert len(calls) == 1
    assert len(warnings) == 1


def test_a_successful_resolution_is_cached(session, workspace, train_config, monkeypatch):
    session.begin(train_config)
    _write_config(workspace, "run-a")

    assert session.run_key() == "run-a"

    calls = []
    monkeypatch.setattr(session._resolver, "candidates", lambda *a, **k: calls.append(1) or [])

    assert session.run_key() == "run-a"
    assert calls == []


def test_note_writer_never_triggers_resolution(session, workspace, train_config, warnings):
    # It fires at writer construction, before the config is written. Resolving
    # there would cache a permanent failure for every run.
    session.begin(train_config)
    session.note_writer("/ws/tensorboard/run-a")

    assert warnings == []

    _write_config(workspace, "run-a")

    assert session.run_key() == "run-a"


def test_note_writer_records_only_the_directory_name(session, workspace, train_config):
    session.begin(train_config)
    session.note_writer("/somewhere/else/tensorboard/run-a")
    _write_config(workspace, "run-a")

    assert session.run_key() == "run-a"
    assert session.run_info()["tensorboard_dirname"] == "run-a"


def test_note_writer_tolerates_a_missing_log_dir(session, workspace, train_config):
    session.begin(train_config)
    session.note_writer(None)
    _write_config(workspace, "run-a")

    assert session.run_key() == "run-a"
    assert session.run_info()["tensorboard_dirname"] is None


def test_begin_resets_a_previous_runs_result(session, workspace, train_config):
    session.begin(train_config)
    _write_config(workspace, "run-a")
    assert session.run_key() == "run-a"

    session.begin(train_config)
    _write_config(workspace, "run-b")

    assert session.run_key() == "run-b"


def test_run_info_is_none_before_resolution_succeeds(session, workspace, train_config):
    session.begin(train_config)

    assert session.run_info() is None


def test_honours_the_save_filename_prefix(session, workspace, train_config):
    train_config.save_filename_prefix = "portrait-"
    session.begin(train_config)
    _write_config(workspace, "portrait-run-a")
    _write_config(workspace, "other-run-a")

    assert session.run_key() == "portrait-run-a"


def test_workspace_dir_is_resolved_and_absolute(session, workspace, train_config):
    assert session.workspace_dir == workspace.resolve()
