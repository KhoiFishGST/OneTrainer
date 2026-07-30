import json
import stat

from modules.webui.settings_store import DEFAULT_DATASETS_DIR, SettingsStore


def test_defaults_when_file_missing(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    assert store.get_datasets_dir() == DEFAULT_DATASETS_DIR
    assert store.has_password() is False
    assert store.verify_password("anything") is False


def test_defaults_when_file_malformed(tmp_path):
    path = tmp_path / "webui.json"
    path.write_text("{not valid json", encoding="utf-8")
    store = SettingsStore(path)
    assert store.get_datasets_dir() == DEFAULT_DATASETS_DIR
    assert store.has_password() is False


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
