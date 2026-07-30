import json
import stat
from pathlib import Path

from modules.webui.settings_store import DEFAULT_DATASETS_DIR, SettingsStore, SettingsStoreUnreadableError

import pytest


def test_defaults_when_file_missing(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    assert store.get_datasets_dir() == DEFAULT_DATASETS_DIR
    assert store.has_password() is False
    assert store.verify_password("anything") is False


def test_malformed_file_falls_back_for_datasets_dir_but_fails_closed_for_auth(tmp_path):
    path = tmp_path / "webui.json"
    path.write_text("{not valid json", encoding="utf-8")
    store = SettingsStore(path)
    assert store.get_datasets_dir() == DEFAULT_DATASETS_DIR
    # A file we cannot parse must not read as "no password configured".
    assert store.has_password() is True
    assert store.verify_password("anything") is False


def test_unreadable_file_fails_closed(tmp_path, monkeypatch):
    path = tmp_path / "webui.json"
    path.write_text(json.dumps({"datasets_dir": "/data"}), encoding="utf-8")

    def boom(*args, **kwargs):
        raise OSError("permission denied")

    monkeypatch.setattr(Path, "read_text", boom)
    store = SettingsStore(path)
    assert store.has_password() is True
    assert store.verify_password("anything") is False
    assert store.get_datasets_dir() == DEFAULT_DATASETS_DIR


@pytest.mark.parametrize("body", ["[1, 2, 3]", '"just a string"', "null", "42"])
def test_non_object_top_level_json_fails_closed(tmp_path, body):
    path = tmp_path / "webui.json"
    path.write_text(body, encoding="utf-8")
    store = SettingsStore(path)
    assert store.has_password() is True
    assert store.verify_password("anything") is False
    assert store.get_datasets_dir() == DEFAULT_DATASETS_DIR


def test_setter_does_not_clobber_malformed_file(tmp_path):
    path = tmp_path / "webui.json"
    original = b"{not valid json"
    path.write_bytes(original)
    store = SettingsStore(path)
    with pytest.raises(SettingsStoreUnreadableError):
        store.set_datasets_dir("/data/sets")
    with pytest.raises(SettingsStoreUnreadableError):
        store.set_password("pw")
    assert path.read_bytes() == original


def test_setter_does_not_clobber_unreadable_file(tmp_path, monkeypatch):
    path = tmp_path / "webui.json"
    original = json.dumps({"password": {"salt": "00", "hash": "11"}}).encode("utf-8")
    path.write_bytes(original)
    store = SettingsStore(path)

    def boom(*args, **kwargs):
        raise OSError("permission denied")

    monkeypatch.setattr(Path, "read_text", boom)
    with pytest.raises(SettingsStoreUnreadableError):
        store.set_password("pw")
    with pytest.raises(SettingsStoreUnreadableError):
        store.set_datasets_dir("/data/sets")
    monkeypatch.undo()
    assert path.read_bytes() == original


def test_absent_file_is_distinct_from_broken_file(tmp_path):
    absent = SettingsStore(tmp_path / "absent.json")
    assert absent.has_password() is False

    broken = tmp_path / "broken.json"
    broken.write_text("{", encoding="utf-8")
    assert SettingsStore(broken).has_password() is True


def test_datasets_dir_round_trip(tmp_path):
    path = tmp_path / "webui.json"
    store = SettingsStore(path)
    store.set_datasets_dir("/srv/my datasets")
    assert store.get_datasets_dir() == "/srv/my datasets"
    assert SettingsStore(path).get_datasets_dir() == "/srv/my datasets"


def test_empty_datasets_dir_falls_back_to_default(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    store.set_datasets_dir("")
    assert store.get_datasets_dir() == DEFAULT_DATASETS_DIR


def test_password_set_and_verify(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    store.set_password("correct horse")
    assert store.has_password() is True
    assert store.verify_password("correct horse") is True
    assert store.verify_password("wrong horse") is False


def test_password_is_not_stored_in_plaintext(tmp_path):
    path = tmp_path / "webui.json"
    store = SettingsStore(path)
    store.set_password("hunter2")
    raw = path.read_text(encoding="utf-8")
    assert "hunter2" not in raw
    doc = json.loads(raw)
    assert set(doc["password"]) == {"salt", "hash"}


def test_password_salt_is_unique_per_set(tmp_path):
    store_a = SettingsStore(tmp_path / "a.json")
    store_b = SettingsStore(tmp_path / "b.json")
    store_a.set_password("same")
    store_b.set_password("same")
    hash_a = json.loads((tmp_path / "a.json").read_text(encoding="utf-8"))["password"]["hash"]
    hash_b = json.loads((tmp_path / "b.json").read_text(encoding="utf-8"))["password"]["hash"]
    assert hash_a != hash_b


def test_empty_password_clears(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    store.set_password("something")
    store.set_password("")
    assert store.has_password() is False
    assert store.verify_password("") is False


def test_setting_password_preserves_datasets_dir(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    store.set_datasets_dir("/data/sets")
    store.set_password("pw")
    assert store.get_datasets_dir() == "/data/sets"


def test_file_permissions_are_owner_only(tmp_path):
    path = tmp_path / "webui.json"
    SettingsStore(path).set_password("pw")
    mode = stat.S_IMODE(path.stat().st_mode)
    assert mode == 0o600


def test_app_state_exposes_settings_store(tmp_path):
    from modules.webui.app import create_app
    from modules.webui.state import WebUISettings

    from fastapi.testclient import TestClient

    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "static",
        dev=True,
    )
    app = create_app(settings)
    with TestClient(app):
        store = app.state.webui.settings_store
        assert isinstance(store, SettingsStore)
        store.set_datasets_dir("/from/app")
        assert (tmp_path / "webui.json").exists()
