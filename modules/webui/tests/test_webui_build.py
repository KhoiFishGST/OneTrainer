from pathlib import Path

from scripts.webui_build import build_digest, build_is_current


def test_build_digest_changes_only_for_build_inputs(tmp_path: Path) -> None:
    web = tmp_path / "web"
    (web / "src").mkdir(parents=True)
    (web / "src" / "app.ts").write_text("one", encoding="utf-8")
    (web / "package.json").write_text("{}", encoding="utf-8")
    first = build_digest(web)
    (web / "ignored.log").write_text("noise", encoding="utf-8")
    assert build_digest(web) == first
    (web / "src" / "app.ts").write_text("two", encoding="utf-8")
    assert build_digest(web) != first


def test_build_requires_index_and_matching_stamp(tmp_path: Path) -> None:
    web = tmp_path / "web"
    (web / "src").mkdir(parents=True)
    (web / "src" / "app.ts").write_text("one", encoding="utf-8")
    (web / "package.json").write_text("{}", encoding="utf-8")
    assert build_is_current(web) is False
    (web / "build").mkdir()
    (web / "build" / "index.html").write_text("ok", encoding="utf-8")
    (web / ".build-source").write_text(build_digest(web), encoding="utf-8")
    assert build_is_current(web) is True
