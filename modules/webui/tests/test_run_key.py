from pathlib import Path

from modules.webui.run_key import RunKeyResolver, file_signature

import pytest


@pytest.fixture
def config_dir(tmp_path: Path) -> Path:
    d = tmp_path / "config"
    d.mkdir()
    return d


def test_resolves_the_single_new_config_written_after_the_snapshot(config_dir):
    (config_dir / "old.json").write_text("{}", encoding="utf-8")

    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    # GenericTrainer writes this timestamped file at run start, after we snapshot.
    (config_dir / "myrun-20260802-091500.json").write_text("{}", encoding="utf-8")

    result = resolver.resolve(config_dir, prefix="")

    assert result.key == "myrun-20260802-091500"
    assert result.config_filename == "myrun-20260802-091500.json"
    assert result.reason is None


def test_honours_the_save_filename_prefix(config_dir):
    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    (config_dir / "portrait-20260802.json").write_text("{}", encoding="utf-8")
    (config_dir / "other-20260802.json").write_text("{}", encoding="utf-8")

    result = resolver.resolve(config_dir, prefix="portrait-")

    assert result.key == "portrait-20260802"


def test_detects_a_changed_file_that_kept_its_name(config_dir):
    target = config_dir / "same-name.json"
    target.write_text("{}", encoding="utf-8")

    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    target.write_text('{"changed": true}', encoding="utf-8")

    result = resolver.resolve(config_dir, prefix="")

    assert result.key == "same-name"


def test_reports_missing_when_no_candidate_appeared(config_dir):
    (config_dir / "old.json").write_text("{}", encoding="utf-8")

    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    result = resolver.resolve(config_dir, prefix="")

    assert result.key is None
    assert result.reason == "missing"


def test_reports_ambiguous_when_several_candidates_appeared(config_dir):
    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    (config_dir / "a.json").write_text("{}", encoding="utf-8")
    (config_dir / "b.json").write_text("{}", encoding="utf-8")

    result = resolver.resolve(config_dir, prefix="")

    assert result.key is None
    assert result.reason == "ambiguous"


def test_reports_no_config_dir_when_the_directory_is_absent(tmp_path):
    resolver = RunKeyResolver()
    resolver.snapshot(tmp_path / "nope")

    result = resolver.resolve(tmp_path / "nope", prefix="")

    assert result.key is None
    assert result.reason == "no_config_dir"


def test_ignores_non_json_files(config_dir):
    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    (config_dir / "notes.txt").write_text("hi", encoding="utf-8")
    (config_dir / "real.json").write_text("{}", encoding="utf-8")

    assert resolver.resolve(config_dir, prefix="").key == "real"


def test_snapshot_of_a_missing_directory_does_not_raise(tmp_path):
    RunKeyResolver().snapshot(tmp_path / "absent")


def test_file_signature_changes_with_content(tmp_path):
    path = tmp_path / "f.json"
    path.write_text("{}", encoding="utf-8")
    first = file_signature(path)

    path.write_text('{"x": 1}', encoding="utf-8")
    second = file_signature(path)

    assert first.sha256 != second.sha256
    assert first.size != second.size


def test_candidates_lists_every_new_or_changed_config(config_dir):
    (config_dir / "old.json").write_text("{}", encoding="utf-8")

    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    (config_dir / "a.json").write_text("{}", encoding="utf-8")
    (config_dir / "b.json").write_text("{}", encoding="utf-8")

    names = sorted(p.name for p in resolver.candidates(config_dir, ""))

    assert names == ["a.json", "b.json"]


def test_candidates_is_empty_when_nothing_appeared(config_dir):
    (config_dir / "old.json").write_text("{}", encoding="utf-8")
    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    assert resolver.candidates(config_dir, "") == []


def test_candidates_returns_empty_for_a_missing_directory(tmp_path):
    resolver = RunKeyResolver()
    resolver.snapshot(tmp_path / "absent")

    assert resolver.candidates(tmp_path / "absent", "") == []


def test_candidates_does_not_rehash_untouched_configs(config_dir, monkeypatch):
    # candidates() runs on the metrics hot path until the run resolves. Hashing
    # every saved config on every call cost megabytes of sha256 per second in a
    # run that never resolves, so an unchanged mtime and size must short-circuit.
    import modules.webui.run_key as rk

    for index in range(3):
        (config_dir / f"saved-{index}.json").write_text("{}", encoding="utf-8")

    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    hashed = []
    original = rk.file_signature
    monkeypatch.setattr(
        rk, "file_signature", lambda path: (hashed.append(path.name), original(path))[1]
    )

    assert resolver.candidates(config_dir, "") == []
    assert hashed == []


def test_candidates_still_sees_a_config_rewritten_in_place(config_dir):
    config = config_dir / "run.json"
    config.write_text('{"before": true}', encoding="utf-8")

    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    config.write_text('{"after": true}', encoding="utf-8")

    assert [p.name for p in resolver.candidates(config_dir, "")] == ["run.json"]


def test_candidates_ignores_a_config_that_was_touched_but_not_changed(config_dir):
    # The content hash is what distinguishes a rewrite from a bare mtime bump,
    # so it must still run when the cheap metadata disagrees.
    import os

    config = config_dir / "run.json"
    config.write_text('{"same": true}', encoding="utf-8")

    resolver = RunKeyResolver()
    resolver.snapshot(config_dir)

    stat = config.stat()
    os.utime(config, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000_000))

    assert resolver.candidates(config_dir, "") == []
