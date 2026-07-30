# Web UI Add-On Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the OneTrainer Web UI branch so it modifies no existing Python file, making it a pure add-on suitable for an upstream PR.

**Architecture:** Seven core touches (six modified files plus one added under `modules/util/`) are reverted to `master`. Equivalent behaviour is relocated into three new modules under `modules/webui/`: `config_io.py` (moved verbatim), `settings_store.py` (owns Web-UI-only persisted state), and `runtime_patches.py` (monkey-patches `save_sampler_output` and `SummaryWriter.add_scalar` at app startup instead of editing core). Tests move into `modules/webui/tests/`. Agent tooling, CI config and platform-locked snapshots are removed.

**Tech Stack:** Python 3.12, FastAPI, pytest; SvelteKit 5 (runes), TanStack Query, Playwright, Bun.

## Global Constraints

- Target branch is `feat/web-ui-upstream`, cut from `feat/svelte-web-ui`. Never commit to `master`.
- **No modifications to any pre-existing Python file.** Only `.gitignore`, `README.md` and `LAUNCH-SCRIPTS.md` may be modified; everything else must be a new file.
- Python tests run only in the repo venv: `./venv/bin/pytest`. The system `python3` (`/home/khoifish/GST/gst-venv`) lacks `mgds` and `imagesize` and must not be used.
- No new Python dependencies. Password hashing uses stdlib `hashlib.scrypt` and `secrets`.
- Do not add a `[tool.pytest.ini_options]` section to `pyproject.toml`.
- Ruff config is inherited from `pyproject.toml`: line-length 120, double quotes, `known-first-party = ["modules"]`.
- Reverts must be exact: use `git checkout master -- <path>`, never hand-editing.

---

### Task 1: Cut branch, prepare test environment, remove tooling

**Files:**
- Delete: `.github/workflows/web.yml`, `.superpowers/`, `.github/hooks/`, `docs/superpowers/`
- Delete: `web/e2e/visual.spec.ts`, `web/e2e/visual.spec.ts-snapshots/`
- Modify: `web/playwright.config.ts:25,39`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: branch `feat/web-ui-upstream`; a venv with pytest installed

- [ ] **Step 1: Cut the PR branch**

```bash
cd /home/khoifish/GST/github/OneTrainer
git checkout feat/svelte-web-ui
git checkout -b feat/web-ui-upstream
```

- [ ] **Step 2: Install test dependencies into the repo venv**

```bash
./venv/bin/pip install -r requirements-webui-dev.txt
```

- [ ] **Step 3: Establish a green baseline before changing anything**

Run: `./venv/bin/pytest tests/webui -q`
Expected: PASS. If anything fails here, stop and report — the baseline must be green before restructuring.

- [ ] **Step 4: Preserve this plan outside the working tree before deleting it**

This plan and its spec live under `docs/superpowers/`, which the next step deletes. Copy them somewhere durable first, or you will delete the document you are following:

```bash
mkdir -p /tmp/claude-1000/-home-khoifish-GST-github-OneTrainer/7c3cd4fc-ebb6-4bda-a542-513fbeab1177/scratchpad/plan-backup
cp docs/superpowers/plans/2026-07-30-webui-addon-restructure.md \
   docs/superpowers/specs/2026-07-30-webui-addon-restructure-design.md \
   /tmp/claude-1000/-home-khoifish-GST-github-OneTrainer/7c3cd4fc-ebb6-4bda-a542-513fbeab1177/scratchpad/plan-backup/
```

Both also remain on the `feat/svelte-web-ui` branch, which is never modified — `git show feat/svelte-web-ui:docs/superpowers/plans/2026-07-30-webui-addon-restructure.md` recovers this file at any point.

- [ ] **Step 5: Remove agent tooling and internal planning docs**

```bash
git rm -r --quiet .superpowers
git rm -r --quiet docs/superpowers
rm -rf .github/hooks
```

`.github/hooks/` is untracked, so a plain `rm -rf` is enough for it.

Note: `docs/superpowers/` is preserved on `feat/svelte-web-ui`; this deletion only affects the PR branch.

- [ ] **Step 6: Remove the CI workflow**

```bash
git rm --quiet .github/workflows/web.yml
```

- [ ] **Step 7: Remove the platform-locked visual regression suite**

```bash
git rm --quiet web/e2e/visual.spec.ts
git rm -r --quiet web/e2e/visual.spec.ts-snapshots
```

- [ ] **Step 8: Remove the `visual` token from both Playwright projects**

In `web/playwright.config.ts` line 25, change:

```ts
      testMatch: /phase-a|phase-b|phase-c|console|theme|responsive-workflows|accessibility|visual|paint-states|dialog-width|gallery-viewer|perf-budget|hover-states/,
```

to:

```ts
      testMatch: /phase-a|phase-b|phase-c|console|theme|responsive-workflows|accessibility|paint-states|dialog-width|gallery-viewer|perf-budget|hover-states/,
```

In line 39, change:

```ts
      testMatch: /mobile|mobile-layout|responsive-workflows|accessibility|theme|visual|touch-targets/,
```

to:

```ts
      testMatch: /mobile|mobile-layout|responsive-workflows|accessibility|theme|touch-targets/,
```

- [ ] **Step 9: Clean up `.gitignore`**

Remove these two lines (agent tooling, not relevant upstream):

```
.superpowers
.impeccable
```

Add this line under the `# user data` section, next to `config.json` and `secrets.json`:

```
webui.json
```

- [ ] **Step 10: Verify the frontend still builds and e2e passes**

Run: `cd web && bun run check && bun run test && bun run build`
Expected: PASS

Run: `cd web && bunx playwright test`
Expected: PASS, with no tests named `visual`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: remove agent tooling, CI config and platform-locked snapshots"
```

---

### Task 2: Move the test suite into `modules/webui/tests`

Done early so every later task writes tests in their final location.

**Files:**
- Move: `tests/webui/` → `modules/webui/tests/`

**Interfaces:**
- Consumes: green baseline from Task 1
- Produces: test suite at `modules/webui/tests/`, run via `./venv/bin/pytest modules/webui/tests`

- [ ] **Step 1: Move the directory**

```bash
git mv tests/webui modules/webui/tests
rmdir tests 2>/dev/null || true
```

- [ ] **Step 2: Confirm no test referenced its own path**

Run: `grep -rn "tests/webui" modules/webui/ web/ scripts/ *.md`
Expected: matches only in `web/playwright.config.ts` (the `e2e_server.py` path) and possibly docs.

- [ ] **Step 3: Fix the Playwright webServer path**

In `web/playwright.config.ts` line 17, change:

```ts
    command: "npm run build && python ../tests/webui/e2e_server.py --root .e2e --port 7801",
```

to:

```ts
    command: "npm run build && python ../modules/webui/tests/e2e_server.py --root .e2e --port 7801",
```

- [ ] **Step 4: Run the suite in its new location**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS, same count as the Task 1 baseline.

- [ ] **Step 5: Verify e2e still boots the backend**

Run: `cd web && bunx playwright test --project=firefox-smoke`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: move webui tests into modules/webui/tests"
```

---

### Task 3: Move `config_io` into `modules/webui`, revert `TopBarController`

**Files:**
- Move: `modules/util/config/config_io.py` → `modules/webui/config_io.py`
- Revert: `modules/ui/TopBarController.py`
- Modify: `modules/webui/config_service.py:11`, `modules/webui/presets.py:6`, `modules/webui/routers/config.py:1`, `modules/webui/routers/secrets.py:3`
- Modify: `modules/webui/tests/test_config_io.py:3`, `modules/webui/tests/test_config_codec.py:4`, `modules/webui/tests/e2e_server.py:11`

**Interfaces:**
- Consumes: test suite at `modules/webui/tests/`
- Produces: `modules.webui.config_io` exporting `load_preset_tree(directory, include_user_files=False)`, `load_secrets(path)`, `load_train_config(config_path, secrets_path)`, `save_settings(config, path)`, `save_named_preset(config, name, directory)`, `save_secrets(config, path)` — all signatures unchanged from the current file.

- [ ] **Step 1: Move the file**

```bash
git mv modules/util/config/config_io.py modules/webui/config_io.py
```

Its contents do not change.

- [ ] **Step 2: Revert `TopBarController` to master**

```bash
git checkout master -- modules/ui/TopBarController.py
```

- [ ] **Step 3: Confirm the revert is exact**

Run: `git diff master -- modules/ui/TopBarController.py`
Expected: no output.

- [ ] **Step 4: Update all import sites**

Replace `from modules.util.config.config_io import` with `from modules.webui.config_io import`, and `from modules.util.config import config_io` with `from modules.webui import config_io`, in exactly these files:

```bash
sed -i 's|from modules\.util\.config\.config_io import|from modules.webui.config_io import|' \
  modules/webui/config_service.py \
  modules/webui/presets.py \
  modules/webui/routers/config.py \
  modules/webui/routers/secrets.py \
  modules/webui/tests/test_config_io.py \
  modules/webui/tests/test_config_codec.py \
  modules/webui/tests/e2e_server.py
```

- [ ] **Step 5: Verify no stale references remain**

Run: `grep -rn "modules.util.config.config_io\|modules\.util\.config import config_io" --include='*.py' .`
Expected: no output.

- [ ] **Step 6: Run the suite**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move config_io into modules/webui, revert TopBarController"
```

---

### Task 4: Revert `concept_stats.py`

**Files:**
- Revert: `modules/util/concept_stats.py`

**Interfaces:**
- Consumes: nothing
- Produces: nothing (pure revert)

- [ ] **Step 1: Revert to master**

```bash
git checkout master -- modules/util/concept_stats.py
```

- [ ] **Step 2: Confirm the revert is exact**

Run: `git diff master -- modules/util/concept_stats.py`
Expected: no output.

- [ ] **Step 3: Confirm the real dependencies import in the repo venv**

Run:

```bash
./venv/bin/python -c "from modules.util.concept_stats import folder_scan, init_concept_stats; print('ok')"
```

Expected: `ok`. If this fails with `ModuleNotFoundError`, the wrong interpreter is being used — the repo venv has `mgds`, `cv2` and `imagesize`; the system one does not.

- [ ] **Step 4: Run the suite**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "revert: restore concept_stats.py hard imports"
```

---

### Task 5: Build the `SettingsStore` module

Pure TDD on a new module with no wiring yet.

**Files:**
- Create: `modules/webui/settings_store.py`
- Test: `modules/webui/tests/test_settings_store.py`

**Interfaces:**
- Consumes: `modules.webui.atomic_io.write_json_atomic(path: Path, value: object) -> None`
- Produces: `modules.webui.settings_store.SettingsStore(path: Path)` with methods `get_datasets_dir() -> str`, `set_datasets_dir(path: str) -> None`, `has_password() -> bool`, `set_password(plaintext: str) -> None`, `verify_password(plaintext: str) -> bool`; and the constant `DEFAULT_DATASETS_DIR = "training_datasets"`.

- [ ] **Step 1: Write the failing tests**

Create `modules/webui/tests/test_settings_store.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./venv/bin/pytest modules/webui/tests/test_settings_store.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'modules.webui.settings_store'`

- [ ] **Step 3: Write the implementation**

Create `modules/webui/settings_store.py`:

```python
import contextlib
import hashlib
import json
import os
import secrets
from pathlib import Path
from typing import Any

from modules.webui.atomic_io import write_json_atomic

DEFAULT_DATASETS_DIR = "training_datasets"

_SCRYPT_N = 2 ** 14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32
_SALT_BYTES = 16


def _derive(plaintext: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        plaintext.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )


class SettingsStore:
    # Web-UI-only persisted state. Deliberately separate from TrainConfig and
    # SecretsConfig so the web UI adds no fields to shared core config classes.

    def __init__(self, path: Path):
        self._path = Path(path)

    def _read(self) -> dict[str, Any]:
        try:
            document = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        return document if isinstance(document, dict) else {}

    def _write(self, document: dict[str, Any]) -> None:
        write_json_atomic(self._path, document)
        with contextlib.suppress(OSError):
            os.chmod(self._path, 0o600)

    def get_datasets_dir(self) -> str:
        value = self._read().get("datasets_dir")
        return value if isinstance(value, str) and value else DEFAULT_DATASETS_DIR

    def set_datasets_dir(self, path: str) -> None:
        document = self._read()
        document["datasets_dir"] = path
        self._write(document)

    def has_password(self) -> bool:
        return isinstance(self._read().get("password"), dict)

    def set_password(self, plaintext: str) -> None:
        document = self._read()
        if not plaintext:
            document["password"] = None
        else:
            salt = secrets.token_bytes(_SALT_BYTES)
            document["password"] = {
                "salt": salt.hex(),
                "hash": _derive(plaintext, salt).hex(),
            }
        self._write(document)

    def verify_password(self, plaintext: str) -> bool:
        entry = self._read().get("password")
        if not isinstance(entry, dict):
            return False
        try:
            salt = bytes.fromhex(entry["salt"])
            expected = bytes.fromhex(entry["hash"])
        except (KeyError, TypeError, ValueError):
            return False
        return secrets.compare_digest(_derive(plaintext, salt), expected)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/pytest modules/webui/tests/test_settings_store.py -q`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add modules/webui/settings_store.py modules/webui/tests/test_settings_store.py
git commit -m "feat: add webui SettingsStore for web-UI-only persisted state"
```

---

### Task 6: Wire `SettingsStore` into `AppState`

Small, self-contained wiring task so Tasks 7 and 8 can both assume `app_state.settings_store` exists.

**Files:**
- Modify: `modules/webui/state.py:14,43`
- Modify: `modules/webui/app.py:44,174-189`
- Test: `modules/webui/tests/test_settings_store.py`

**Interfaces:**
- Consumes: `SettingsStore` from Task 5
- Produces: `app_state.settings_store: SettingsStore`, backed by `WebUISettings.root_dir / "webui.json"`

- [ ] **Step 1: Write the failing test**

Append to `modules/webui/tests/test_settings_store.py`:

```python
def test_app_state_exposes_settings_store(tmp_path):
    from fastapi.testclient import TestClient

    from modules.webui.app import create_app
    from modules.webui.state import WebUISettings

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `./venv/bin/pytest modules/webui/tests/test_settings_store.py::test_app_state_exposes_settings_store -q`
Expected: FAIL with `AttributeError: 'AppState' object has no attribute 'settings_store'`

- [ ] **Step 3: Add the field to `AppState`**

In `modules/webui/state.py`, add to the `TYPE_CHECKING` block after line 12:

```python
    from modules.webui.settings_store import SettingsStore
```

and add this field to `AppState` immediately after line 43 (`media_service: "MediaService | None" = None`):

```python
    settings_store: "SettingsStore | None" = None
```

It is optional with a `None` default so the existing keyword-only construction in `modules/webui/tests/test_media_service.py:138` keeps working.

- [ ] **Step 4: Construct it in `create_app`**

In `modules/webui/app.py`, add to the import block after line 43:

```python
from modules.webui.settings_store import SettingsStore
```

Inside `lifespan`, after line 138 (`media_svc = MediaService(root_dir=settings.root_dir)`), add:

```python
        settings_store = SettingsStore(settings.root_dir / "webui.json")
```

and add this keyword argument to the `AppState(...)` call, after `media_service=media_svc,`:

```python
            settings_store=settings_store,
```

- [ ] **Step 5: Run to verify it passes**

Run: `./venv/bin/pytest modules/webui/tests/test_settings_store.py -q`
Expected: PASS, 11 tests.

- [ ] **Step 6: Run the full suite**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: expose SettingsStore on AppState"
```

---

### Task 7: Migrate `datasets_dir` to `SettingsStore`, revert `TrainConfig`

**Files:**
- Revert: `modules/util/config/TrainConfig.py`
- Modify: `modules/webui/routers/datasets.py:18-26,29-54`
- Modify: `modules/webui/config_codec.py:158-159`
- Modify: `modules/webui/tests/test_schema.py:229-233`, `modules/webui/tests/test_schema_coverage.py:5`, `modules/webui/tests/test_datasets_router.py:181-193`
- Modify: `web/src/lib/api/client.ts:224`, `web/src/lib/api/queries.ts:282`
- Modify: `web/src/routes/(app)/datasets/+page.svelte:14-19,42-56,109-112`

**Interfaces:**
- Consumes: `app_state.settings_store` from Task 6
- Produces: HTTP `PUT /api/datasets/base-dir` accepting `{"path": str}` and returning `{"status": "ok", "base_dir": str, "resolved_base_dir": str}`; TypeScript `api.setDatasetsBaseDir(path: string)` and `createSetDatasetsBaseDirMutation()`.

- [ ] **Step 1: Write the failing backend test**

Append to `modules/webui/tests/test_datasets_router.py`:

```python
def test_base_dir_comes_from_settings_store(tmp_path):
    from fastapi.testclient import TestClient

    from modules.webui.app import create_app
    from modules.webui.state import WebUISettings

    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "static",
        dev=True,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        assert client.get("/api/datasets").json()["base_dir"] == "training_datasets"

        resp = client.put("/api/datasets/base-dir", json={"path": "my_sets"})
        assert resp.status_code == 200
        assert resp.json()["base_dir"] == "my_sets"

        assert client.get("/api/datasets").json()["base_dir"] == "my_sets"
        assert (tmp_path / "my_sets").is_dir()
```

- [ ] **Step 2: Run to verify it fails**

Run: `./venv/bin/pytest modules/webui/tests/test_datasets_router.py::test_base_dir_comes_from_settings_store -q`
Expected: FAIL — `PUT /api/datasets/base-dir` returns 405.

- [ ] **Step 3: Revert `TrainConfig`**

```bash
git checkout master -- modules/util/config/TrainConfig.py
git diff master -- modules/util/config/TrainConfig.py
```

Expected: the `git diff` produces no output.

- [ ] **Step 4: Update the datasets router**

In `modules/webui/routers/datasets.py`, add to the imports after line 10:

```python
from pydantic import BaseModel
```

Replace `get_base_datasets_dir` (lines 18–26) with:

```python
def get_base_datasets_dir(app_state: AppState) -> Path:
    raw_dir = app_state.settings_store.get_datasets_dir()
    p = Path(raw_dir)
    if not p.is_absolute():
        p = (app_state.settings.root_dir / p).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


class BaseDirUpdate(BaseModel):
    path: str


@router.put("/datasets/base-dir")
async def set_datasets_base_dir(req: BaseDirUpdate, request: Request):
    app_state: AppState = request.app.state.webui
    app_state.settings_store.set_datasets_dir(req.path.strip())
    return {
        "status": "ok",
        "base_dir": app_state.settings_store.get_datasets_dir(),
        "resolved_base_dir": str(get_base_datasets_dir(app_state)),
    }
```

In `list_datasets`, delete these two now-unused lines:

```python
    config = app_state.config_service.get_config()
    raw_dir = getattr(config, "datasets_dir", "training_datasets") or "training_datasets"
```

and change the return statement to:

```python
    return {
        "datasets": result,
        "base_dir": app_state.settings_store.get_datasets_dir(),
        "resolved_base_dir": str(base_dir),
    }
```

- [ ] **Step 5: Remove the config_codec back-fill**

In `modules/webui/config_codec.py`, delete these two lines from `decode_settings_document` (lines 158–159):

```python
    if isinstance(document, dict) and "datasets_dir" not in document:
        document["datasets_dir"] = getattr(template, "datasets_dir", "training_datasets")
```

- [ ] **Step 6: Update the tests that asserted the core field**

In `modules/webui/tests/test_schema.py`, delete this whole test (lines 229–233):

```python
def test_train_config_has_default_datasets_dir():
    from modules.util.config.TrainConfig import TrainConfig
    config = TrainConfig.default_values()
    assert hasattr(config, "datasets_dir")
    assert config.datasets_dir == "training_datasets"
```

In `modules/webui/tests/test_schema_coverage.py` line 5, remove `"datasets_dir", ` from the `DEPRECATED_OR_INTERNAL` set so the line reads:

```python
    "version", "config_version", "saved_version", "optimizer_defaults", "concept_file_name", "concepts", "cloud",
```

In `modules/webui/tests/test_datasets_router.py`, replace `test_decode_config_with_missing_datasets_dir` with a test that pins the compatibility guarantee instead:

```python
def test_decode_config_ignores_legacy_datasets_dir_key():
    from modules.util.config.SecretsConfig import SecretsConfig
    from modules.util.config.TrainConfig import TrainConfig
    from modules.webui.config_codec import decode_settings_document

    cfg = TrainConfig.default_values()
    doc = cfg.to_settings_dict(secrets=False)
    # Configs saved by earlier web UI builds carry a datasets_dir key that
    # TrainConfig no longer declares. Loading them must not fail.
    doc["datasets_dir"] = "training_datasets"

    decoded = decode_settings_document(doc, SecretsConfig.default_values())
    assert decoded is not None
```

- [ ] **Step 7: Run the backend tests**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS

- [ ] **Step 8: Add the frontend API client method**

In `web/src/lib/api/client.ts`, after line 224 (`getDatasets`), add:

```ts
    setDatasetsBaseDir: (path: string) =>
      request<{ status: string; base_dir: string; resolved_base_dir: string }>(
        `${base}/api/datasets/base-dir`,
        {
          method: 'PUT',
          body: JSON.stringify({ path }),
        }
      ),
```

- [ ] **Step 9: Add the mutation**

In `web/src/lib/api/queries.ts`, after `createCreateDatasetMutation` (ends line 282), add:

```ts
export function createSetDatasetsBaseDirMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: (path: string) => api.setDatasetsBaseDir(path),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: queryKeys.datasets() });
      },
    },
    client
  );
}
```

- [ ] **Step 10: Rewire the datasets page**

`PathInput` fires both `onInput` and `onChange` on every keystroke, so the commit must be debounced — otherwise every character issues a PUT.

In `web/src/routes/(app)/datasets/+page.svelte`, add `createSetDatasetsBaseDirMutation` to the import list from `$lib/api/queries` (lines 14–19).

Replace the `baseDir` derivation (lines 42–44) and `handleBaseDirChange` (lines 51–56) with:

```ts
  const setBaseDirMutation = createSetDatasetsBaseDirMutation();

  let baseDirDraft = $state<string | null>(null);
  let baseDir = $derived(
    baseDirDraft ?? $datasetsQuery.data?.base_dir ?? 'training_datasets'
  );
  let commitTimer: ReturnType<typeof setTimeout> | undefined;

  function handleBaseDirChange(newPath: string) {
    baseDirDraft = newPath;
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      $setBaseDirMutation.mutate(newPath, {
        onSettled: () => {
          baseDirDraft = null;
        },
      });
    }, 600);
  }
```

Once the mutation settles, `baseDirDraft` clears and `baseDir` falls back to the freshly invalidated server value.

At lines 109–112, remove the `onInput` binding so only `onChange` remains:

```svelte
          value={baseDir}
          onChange={handleBaseDirChange}
```

- [ ] **Step 11: Verify no `datasets_dir` references remain**

Run: `grep -rn "datasets_dir" --include='*.py' --include='*.ts' --include='*.svelte' modules/ web/src/`
Expected: no output.

- [ ] **Step 12: Run frontend checks**

Run: `cd web && bun run check && bun run test && bun run build`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: move datasets_dir to SettingsStore, revert TrainConfig"
```

---

### Task 8: Migrate `webui_password` to `SettingsStore`, revert `SecretsConfig`

**Files:**
- Revert: `modules/util/config/SecretsConfig.py`
- Modify: `modules/webui/routers/auth.py:19-23,36-44,47-60`
- Modify: `modules/webui/routers/secrets.py:12-48`
- Modify: `modules/webui/tests/test_secrets_api.py:54-58`

**Interfaces:**
- Consumes: `app_state.settings_store` from Task 6
- Produces: unchanged HTTP contracts — `GET /api/secrets` returns `webui_password_set: bool`; `POST/PUT /api/secrets` accepts `webui_password: str | None`; `/api/auth/*` behaviour unchanged.

- [ ] **Step 1: Update the failing test first**

In `modules/webui/tests/test_secrets_api.py`, replace lines 54–58 (the on-disk assertions) with:

```python
        # Verify secrets.json holds the HF token, and that the web UI password
        # is stored hashed in webui.json rather than in core secrets.
        assert secrets_path.exists()
        saved = json.loads(secrets_path.read_text(encoding="utf-8"))
        assert saved["huggingface_token"] == "hf_test_token_123"
        assert "webui_password" not in saved

        webui_path = secrets_path.parent / "webui.json"
        webui_doc = json.loads(webui_path.read_text(encoding="utf-8"))
        assert "secret_password" not in webui_path.read_text(encoding="utf-8")
        assert set(webui_doc["password"]) == {"salt", "hash"}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./venv/bin/pytest modules/webui/tests/test_secrets_api.py -q`
Expected: FAIL — `webui.json` does not exist yet.

- [ ] **Step 3: Revert `SecretsConfig`**

```bash
git checkout master -- modules/util/config/SecretsConfig.py
git diff master -- modules/util/config/SecretsConfig.py
```

Expected: the `git diff` produces no output.

- [ ] **Step 4: Update the auth router**

In `modules/webui/routers/auth.py`, replace `is_authenticated` (lines 19–33) with:

```python
def is_authenticated(request_or_ws: Any, state: AppState) -> bool:
    if not state.settings_store.has_password():
        return True

    headers = getattr(request_or_ws, "headers", {})
    auth_header = headers.get("Authorization") or headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token in _ACTIVE_TOKENS:
            return True

    cookies = getattr(request_or_ws, "cookies", {})
    cookie_token = cookies.get("onetrainer_session")
    return bool(cookie_token and cookie_token in _ACTIVE_TOKENS)
```

In `get_auth_status`, replace line 39 with:

```python
    password_required = state.settings_store.has_password()
```

In `login`, replace lines 54–60 with:

```python
    if not state.settings_store.has_password():
        return {"status": "ok", "authenticated": True, "token": None}

    if not state.settings_store.verify_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid password")
```

- [ ] **Step 5: Update the secrets router**

In `modules/webui/routers/secrets.py`, replace the bodies of both handlers so the password routes through the store while the HF token still routes through core secrets:

```python
@router.get("/secrets")
async def get_secrets(request: Request) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    secrets = state.config._config.secrets
    return {
        "huggingface_token": secrets.huggingface_token,
        "huggingface_token_set": bool(secrets.huggingface_token),
        "webui_password_set": state.settings_store.has_password(),
    }


@router.api_route("/secrets", methods=["POST", "PUT"])
async def update_secrets(
    req: SecretsUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    secrets = state.config._config.secrets

    if req.huggingface_token is not None:
        secrets.huggingface_token = req.huggingface_token.strip()

    if req.webui_password is not None:
        state.settings_store.set_password(req.webui_password)

    save_secrets(state.config._config, state.settings.secrets_path)

    return {
        "status": "ok",
        "huggingface_token_set": bool(secrets.huggingface_token),
        "webui_password_set": state.settings_store.has_password(),
    }
```

`SecretsUpdateRequest` is unchanged — it keeps the `webui_password` field, since that is the wire contract, not the storage location.

- [ ] **Step 6: Run to verify it passes**

Run: `./venv/bin/pytest modules/webui/tests/test_secrets_api.py -q`
Expected: PASS, 2 tests — including `test_auth_api_flow`, which exercises set-password, wrong password rejected, correct password accepted, and logout.

- [ ] **Step 7: Verify no `webui_password` attribute access remains**

Run: `grep -rn "secrets.webui_password\|\.webui_password" --include='*.py' modules/`
Expected: no output. (`webui_password` still appears as a request-body field name in `secrets.py`, which is correct.)

- [ ] **Step 8: Run the full suite**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: move webui password to hashed SettingsStore entry, revert SecretsConfig"
```

---

### Task 9: Add `runtime_patches`, revert the sampler and trainer

**Files:**
- Create: `modules/webui/runtime_patches.py`
- Test: `modules/webui/tests/test_runtime_patches.py`
- Revert: `modules/modelSampler/BaseModelSampler.py`, `modules/trainer/GenericTrainer.py`
- Modify: `modules/webui/training.py:20-51,399-428`
- Modify: `modules/webui/app.py`

**Interfaces:**
- Consumes: `modules.webui.training._active_training_service`
- Produces: `modules.webui.runtime_patches.install_runtime_patches() -> None`, idempotent; after it runs, `ModelSamplerOutput.filepath` is set by `BaseModelSampler.save_sampler_output` for image and video output.

- [ ] **Step 1: Write the failing tests**

Create `modules/webui/tests/test_runtime_patches.py`:

```python
from modules.util.enum.FileType import FileType
from modules.util.enum.ImageFormat import ImageFormat
from modules.util.enum.VideoFormat import VideoFormat
from modules.webui.runtime_patches import install_runtime_patches

from PIL import Image


def test_save_sampler_output_signature_is_what_we_patch():
    # Guards against upstream changing the seam the patch depends on.
    import inspect

    from modules.modelSampler.BaseModelSampler import BaseModelSampler

    params = list(inspect.signature(BaseModelSampler.save_sampler_output).parameters)
    assert params == [
        "sampler_output",
        "destination",
        "image_format",
        "video_format",
        "audio_format",
        "fps",
    ]


def test_patch_records_image_filepath(tmp_path):
    from modules.modelSampler.BaseModelSampler import BaseModelSampler, ModelSamplerOutput

    install_runtime_patches()

    output = ModelSamplerOutput(FileType.IMAGE, Image.new("RGB", (4, 4)))
    destination = str(tmp_path / "sample")
    BaseModelSampler.save_sampler_output(
        output, destination, ImageFormat.PNG, VideoFormat.MP4, None
    )

    assert output.filepath == destination + ImageFormat.PNG.extension()
    assert (tmp_path / f"sample{ImageFormat.PNG.extension()}").is_file()


def test_patch_is_idempotent(tmp_path):
    from modules.modelSampler.BaseModelSampler import BaseModelSampler, ModelSamplerOutput

    install_runtime_patches()
    first = BaseModelSampler.save_sampler_output
    install_runtime_patches()
    assert BaseModelSampler.save_sampler_output is first

    output = ModelSamplerOutput(FileType.IMAGE, Image.new("RGB", (4, 4)))
    destination = str(tmp_path / "again")
    BaseModelSampler.save_sampler_output(
        output, destination, ImageFormat.PNG, VideoFormat.MP4, None
    )
    assert output.filepath == destination + ImageFormat.PNG.extension()


def test_metrics_are_recorded_exactly_once_per_scalar():
    # Regression test: training.py previously patched SummaryWriter.add_scalar
    # twice (module level plus once per run), so run N recorded N+1 points.
    from torch.utils.tensorboard import SummaryWriter

    from modules.webui import training as training_module

    install_runtime_patches()

    recorded = []

    class FakeService:
        _step = 7
        _epoch = 2

        def record_metric(self, payload):
            recorded.append(payload)

    previous = training_module._active_training_service
    training_module._active_training_service = FakeService()
    try:
        SummaryWriter.add_scalar(object(), "loss/train", 0.5, 7)
    finally:
        training_module._active_training_service = previous

    assert len(recorded) == 1
    assert recorded[0]["loss"] == 0.5
    assert recorded[0]["step"] == 7
    assert recorded[0]["epoch"] == 2
```

- [ ] **Step 2: Run to verify they fail**

Run: `./venv/bin/pytest modules/webui/tests/test_runtime_patches.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'modules.webui.runtime_patches'`

- [ ] **Step 3: Revert the two core files**

```bash
git checkout master -- modules/modelSampler/BaseModelSampler.py modules/trainer/GenericTrainer.py
git diff master -- modules/modelSampler/BaseModelSampler.py modules/trainer/GenericTrainer.py
```

Expected: the `git diff` produces no output.

- [ ] **Step 4: Write the implementation**

Create `modules/webui/runtime_patches.py`:

```python
import contextlib

# The web UI needs two behaviours that core OneTrainer does not provide:
#   1. the on-disk path of each written sample, for the gallery
#   2. real-time loss/lr metrics, for the training chart
# Both are installed here as runtime patches so no core file is modified.

_installed = False


def install_runtime_patches() -> None:
    global _installed
    if _installed:
        return
    _patch_sampler_output()
    _patch_summary_writer()
    _installed = True


def _patch_sampler_output() -> None:
    # save_sampler_output is the single point every concrete sampler writes
    # through, and each one calls it before invoking on_sample, so filepath is
    # populated by the time the web UI callback runs.
    from modules.modelSampler.BaseModelSampler import BaseModelSampler
    from modules.util.enum.FileType import FileType

    original = BaseModelSampler.__dict__["save_sampler_output"].__func__

    def patched(
        sampler_output,
        destination,
        image_format,
        video_format,
        audio_format,
        fps: int = 24,
    ):
        result = original(
            sampler_output, destination, image_format, video_format, audio_format, fps
        )
        with contextlib.suppress(Exception):
            if sampler_output.file_type == FileType.IMAGE and image_format is not None:
                sampler_output.filepath = destination + image_format.extension()
            elif sampler_output.file_type == FileType.VIDEO and video_format is not None:
                sampler_output.filepath = destination + video_format.extension()
        return result

    BaseModelSampler.save_sampler_output = staticmethod(patched)


def _patch_summary_writer() -> None:
    try:
        from torch.utils.tensorboard import SummaryWriter
    except Exception:
        return

    original = SummaryWriter.add_scalar

    def patched(writer_self, tag, scalar_value, global_step=None, walltime=None):
        with contextlib.suppress(Exception):
            original(writer_self, tag, scalar_value, global_step, walltime)

        from modules.webui import training as training_module

        service = training_module._active_training_service
        if service is None:
            return

        try:
            tag_lower = tag.lower()
            value = float(scalar_value)
            payload = {
                "step": global_step if global_step is not None else service._step,
                "epoch": service._epoch,
                tag.replace("/", "_"): value,
            }
            if "loss" in tag_lower:
                payload["loss"] = value
            if "lr" in tag_lower or "learning_rate" in tag_lower:
                payload["lr"] = value
            service.record_metric(payload)
        except Exception:
            pass

    SummaryWriter.add_scalar = patched
```

- [ ] **Step 5: Delete both existing SummaryWriter patches**

Delete the **later** block first, so the earlier deletion does not shift its line numbers.

First, in `modules/webui/training.py`, delete the per-run patch inside `_run_training_worker` — lines 399–428, starting at the comment `# Patch SummaryWriter to record real-time loss/learning rate metrics`, through `SummaryWriter.add_scalar = custom_add_scalar` and its trailing `except Exception:` / `pass`.

Then delete the module-level patch block — lines 20–51, from `try:` through the `except Exception:` / `pass` that follows `SummaryWriter.add_scalar = _global_add_scalar`.

Keep line 18 (`_active_training_service: Optional["TrainingService"] = None`) — `runtime_patches` reads it.

Verify both are gone:

Run: `grep -n "add_scalar\|SummaryWriter" modules/webui/training.py`
Expected: no output.

- [ ] **Step 6: Install the patches in `create_app`**

In `modules/webui/app.py`, add to the import block after the `SettingsStore` import added in Task 6:

```python
from modules.webui.runtime_patches import install_runtime_patches
```

As the first statement inside `create_app`, before the `lifespan` definition on line 113, add:

```python
    install_runtime_patches()
```

- [ ] **Step 7: Run to verify tests pass**

Run: `./venv/bin/pytest modules/webui/tests/test_runtime_patches.py -q`
Expected: PASS, 4 tests.

- [ ] **Step 8: Confirm no unused imports remain in training.py**

Run: `./venv/bin/python -m ruff check modules/webui/training.py`
Expected: no errors. If `contextlib` or `Optional` became unused, remove the import; if `contextlib` is still used elsewhere in the file, leave it.

- [ ] **Step 9: Run the full suite**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add runtime_patches, revert BaseModelSampler and GenericTrainer"
```

---

### Task 10: Documentation

**Files:**
- Create: `docs/WebUi.md`
- Create: `modules/webui/README.md`
- Delete: `docs/WebUiDesign.md`
- Modify: `README.md:97-105`

**Interfaces:**
- Consumes: everything above
- Produces: no code interfaces

- [ ] **Step 1: Write the user guide**

Create `docs/WebUi.md`:

```markdown
# Web UI

OneTrainer includes an optional browser-based interface alongside the desktop UI.
It offers the same training configuration, concept and dataset management, live
console output, and a sample gallery, and works on both desktop and mobile
browsers.

## Requirements

- The standard OneTrainer installation.
- Python dependencies: `pip install -r requirements-webui.txt`
- [Bun](https://bun.sh) on your PATH, used to install frontend dependencies and
  build the static bundle.

## Launching

- **Windows**: `start-web-ui.bat`
- **Linux / macOS**: `./start-web-ui.sh`

The UI is served at `http://127.0.0.1:7801`.

On first launch, and whenever frontend sources change, the launcher installs
frontend dependencies and builds the production bundle into `web/build`.

## Options

| Option | Effect |
| --- | --- |
| `--port 8080` | Serve on a different port |
| `--host 0.0.0.0` | Bind to all interfaces |
| `--dev` | Run the API without serving the built bundle |

**Network exposure.** Binding to a non-loopback address exposes training
control and file-system browsing to your network. Set a password under
Secrets before doing so. The password is stored as a salted scrypt hash in
`webui.json`.

## Development

Run the API and the Vite dev server in two terminals:

```
./start-web-ui.sh --dev
cd web && bun run dev
```

See `modules/webui/README.md` for architecture and testing.
```

- [ ] **Step 2: Write the developer README**

Create `modules/webui/README.md`:

```markdown
# Web UI backend

FastAPI application serving the SvelteKit frontend in `web/`. This is an
add-on: it modifies no core OneTrainer file.

## Layout

| Path | Responsibility |
| --- | --- |
| `app.py` | App factory, middleware, router registration |
| `state.py` | `WebUISettings` and `AppState` |
| `routers/` | HTTP endpoints, one module per resource |
| `schema/` | Generates the form schema from `TrainConfig` |
| `config_io.py` | Load/save train configs, presets and secrets |
| `settings_store.py` | Web-UI-only persisted state (`webui.json`) |
| `runtime_patches.py` | Startup monkey-patches, see below |
| `gallery.py`, `media.py`, `training.py` | Sample gallery, media serving, training lifecycle |

## Why `settings_store.py` exists

`datasets_dir` and the Web UI password are needed only by this add-on. Rather
than adding fields to the shared `TrainConfig` and `SecretsConfig` classes,
they live in `webui.json` next to `config.json`. The password is stored as a
salted scrypt hash. The file is written atomically with mode `0600`.

## Why `runtime_patches.py` exists

Two behaviours are needed that core does not provide, and both are installed
as runtime patches from `create_app()` rather than by editing core files:

- **`save_sampler_output`** — records the written file's path on the sampler
  output so the gallery can find it. This is the single method every concrete
  sampler writes through, and each calls it before `on_sample`, so the path is
  set before the callback runs.
- **`SummaryWriter.add_scalar`** — forwards loss and learning-rate scalars to
  the live training chart.

`install_runtime_patches()` is idempotent. Both patches are inert when no
training run is active, so neither is ever removed.

Known limitation: `ModelSamplerOutput.__reduce__` reconstructs with only
`(file_type, data)`, so the recorded path does not survive pickling to a cloud
worker. Cloud runs do not populate the gallery.

## Testing

Tests must run in the OneTrainer venv — `TrainConfig` pulls in `torch`, and
concept statistics need `mgds`, `opencv-python` and `imagesize`.

```
./venv/bin/pip install -r requirements-webui-dev.txt
./venv/bin/pytest modules/webui/tests
```

Frontend and end-to-end:

```
cd web
bun run check && bun run test && bun run build
bunx playwright test
```
```

- [ ] **Step 3: Remove the superseded design document**

```bash
git rm --quiet docs/WebUiDesign.md
```

- [ ] **Step 4: Update the root README**

In `README.md`, replace this exact block:

```markdown
### Web UI Mode

OneTrainer includes an optional browser-based Web UI (Phase A implementation).

-   **Windows**: Run `start-web-ui.bat`
-   **Linux / Mac**: Run `./start-web-ui.sh`

By default, the Web UI listens at `http://127.0.0.1:7801`. See [LAUNCH-SCRIPTS.md](LAUNCH-SCRIPTS.md) for launch options, port overrides, and system setup details.
```

with:

```markdown
### Web UI Mode

OneTrainer also includes an optional browser-based interface, usable from
desktop and mobile browsers.

-   **Windows**: Run `start-web-ui.bat`
-   **Linux / Mac**: Run `./start-web-ui.sh`

By default the Web UI listens at `http://127.0.0.1:7801`. See [Web UI](docs/WebUi.md)
for requirements, launch options and development setup.
```

- [ ] **Step 5: Verify no stale references**

Run: `grep -rn "WebUiDesign\|Phase A" README.md LAUNCH-SCRIPTS.md docs/ modules/webui/README.md`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: add Web UI user guide and backend README"
```

---

### Task 11: Final verification

**Files:** none modified

**Interfaces:**
- Consumes: all previous tasks
- Produces: a verified PR-ready branch

- [ ] **Step 1: Assert no pre-existing Python file was modified**

```bash
git diff master...HEAD --name-status -- '*.py' | grep -v '^A' || echo "CLEAN: python additions only"
```

Expected: `CLEAN: python additions only`. Any `M` or `D` line other than the intentionally moved `modules/util/config/config_io.py` is a failure — investigate before proceeding.

- [ ] **Step 2: Assert exactly three pre-existing files are modified**

```bash
git diff master...HEAD --name-status | grep '^M'
```

Expected: exactly `.gitignore`, `README.md`, `LAUNCH-SCRIPTS.md`.

- [ ] **Step 3: Confirm each reverted file matches master byte-for-byte**

```bash
git diff master -- \
  modules/util/concept_stats.py \
  modules/util/config/TrainConfig.py \
  modules/util/config/SecretsConfig.py \
  modules/ui/TopBarController.py \
  modules/modelSampler/BaseModelSampler.py \
  modules/trainer/GenericTrainer.py \
  && echo "CLEAN: all reverts exact"
```

Expected: `CLEAN: all reverts exact` with no diff output above it.

- [ ] **Step 4: Run the full Python suite**

Run: `./venv/bin/pytest modules/webui/tests -q`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `./venv/bin/python -m ruff check modules/webui scripts/train_ui_web.py scripts/webui_build.py`
Expected: no errors.

- [ ] **Step 6: Run the frontend suite**

Run: `cd web && bun run check && bun run test && bun run build`
Expected: PASS

- [ ] **Step 7: Run end-to-end tests**

Run: `cd web && bunx playwright test`
Expected: PASS, with no `visual` tests present.

- [ ] **Step 8: Verify backward compatibility with old configs**

```bash
./venv/bin/python -c "
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_codec import decode_settings_document
doc = TrainConfig.default_values().to_settings_dict(secrets=False)
doc['datasets_dir'] = 'training_datasets'
decode_settings_document(doc, SecretsConfig.default_values())
print('legacy config with datasets_dir loads OK')
"
```

Expected: `legacy config with datasets_dir loads OK`

- [ ] **Step 9: Manual smoke test**

Start the Web UI, then confirm each of the following:

1. Configure and start a short training run.
2. A generated sample appears in the gallery — this exercises the `save_sampler_output` patch.
3. The training chart plots each metric point exactly once.
4. Stop the run and start a second one in the same session; confirm metric points are still plotted once each, not twice. This is the regression the duplicate-patch removal fixes.
5. On the Datasets page, change the base directory; confirm it persists across a page reload and that `webui.json` contains the new value.
6. Under Secrets, set a password; log out and back in; confirm `webui.json` contains a `salt`/`hash` pair and not the plaintext.

- [ ] **Step 10: Review the full diff stat**

```bash
git diff master...HEAD --stat | tail -20
```

Confirm no unexpected files, and that `docs/superpowers/`, `.superpowers/`, `.github/workflows/web.yml` and the visual snapshots are absent.

---

### Task 12: Separate upstream bug-fix branch

Independent of the Web UI. A one-line fix, submitted on its own branch off `master` so it does not complicate the add-on PR.

**Files:**
- Modify: `modules/util/concept_stats.py:188`

**Interfaces:**
- Consumes: nothing
- Produces: branch `fix/concept-stats-video-direntry`

- [ ] **Step 1: Cut a branch from master**

```bash
git checkout master
git checkout -b fix/concept-stats-video-direntry
```

- [ ] **Step 2: Confirm the defect**

Run: `sed -n '104p;110p;185,190p' modules/util/concept_stats.py`

Confirm that `file_list` is built from `os.scandir` (line 104), that the loop variable `path` is therefore an `os.DirEntry` (line 110), that `imagesize.get(path.path)` correctly unwraps it, and that `cv2.VideoCapture(path)` does not.

- [ ] **Step 3: Apply the fix**

Change:

```python
                vid = cv2.VideoCapture(path)
```

to:

```python
                vid = cv2.VideoCapture(path.path)
```

- [ ] **Step 4: Verify the diff is exactly one line**

```bash
git diff --stat
```

Expected: `1 file changed, 1 insertion(+), 1 deletion(-)`

- [ ] **Step 5: Verify it imports and the call accepts the argument type**

```bash
./venv/bin/python -c "
import os, cv2
from modules.util.concept_stats import folder_scan
entry = next(iter(os.scandir('modules/util')))
print('DirEntry.path is str:', isinstance(entry.path, str))
print('cv2.VideoCapture accepts str:', cv2.VideoCapture(entry.path) is not None)
"
```

Expected: both lines print `True`.

- [ ] **Step 6: Commit**

```bash
git add modules/util/concept_stats.py
git commit -m "fix: pass DirEntry path string to cv2.VideoCapture in concept stats

folder_scan iterates os.scandir entries, so \`path\` is an os.DirEntry.
The neighbouring imagesize call already uses path.path; this one did not,
so advanced concept checks failed on any concept containing video."
```

- [ ] **Step 7: Return to the PR branch**

```bash
git checkout feat/web-ui-upstream
```
