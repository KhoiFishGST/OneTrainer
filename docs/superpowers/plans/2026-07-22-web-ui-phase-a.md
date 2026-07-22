# OneTrainer Web UI Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase A browser UI for revision-safe remote configuration, server directory selection, and nonblocking console streaming on desktop and phone.

**Architecture:** A FastAPI application owns a strict, revisioned `TrainConfig` service and serves a static SvelteKit SPA. Standard forms are generated from a Python schema, while console capture and delivery use a bounded file-descriptor tee, sequenced event hub, REST backlog, and one WebSocket. The live editable config is isolated from all trainer code.

**Tech Stack:** Python 3.10-3.13, FastAPI, Uvicorn, pytest, Svelte 5, SvelteKit SPA mode, TypeScript, TanStack Svelte Query, plain CSS, Vitest, Testing Library, and Playwright.

## Global Constraints

- Implement only Phase A from `docs/superpowers/specs/2026-07-22-web-ui-phase-a-design.md`; do not add trainer lifecycle endpoints or touch trainer/model/data-loader modules.
- Bind production to `127.0.0.1:7801` by default; non-loopback binding must print the no-auth warning.
- Runtime Python web dependencies remain exactly `fastapi` and `uvicorn[standard]` in `requirements-webui.txt`.
- Use Svelte 5 with SvelteKit `adapter-static`, Bun, TanStack Svelte Query, Lucide, and plain CSS; do not add Tailwind, a component framework, charts, an ANSI HTML package, or a virtualization package.
- Keep `web/build` and `web/node_modules` untracked; require Bun to create or refresh a production build.
- Ship Graphite and Ember dark mode only, implemented through semantic CSS custom properties.
- Desktop uses a 48 px compact rail and approximately 176 px pinned expanded rail; phone uses an off-canvas expanded drawer with complete editing flows.
- Client config payloads never contain secrets. Config mutations preserve server-side secrets and atomically persist `training_presets/#.json` before swapping memory.
- Config revisions are opaque `<instance-id>:<counter>` strings. No stale write may silently overwrite a newer document.
- JSON request bodies are limited to 1 MiB.
- Console retention is bounded by 10,000 committed lines and 4 MiB text, with a 64 KiB batch cap, 30 Hz maximum broadcast rate, 2,048 ingress batches, and 256 batches per client.
- The rotating console log is one active 10 MiB file plus one 10 MiB backup under the canonical workspace.
- Use TDD for every behavior: observe the focused test fail for the intended reason, implement the minimum behavior, then run focused and neighboring tests.
- Use `ruff` conventions from `pyproject.toml`, 120-column Python lines, double quotes, and existing import ordering.
- Do not introduce GitHub Actions; document deterministic local commands instead.

---

## File And Interface Map

### Shared Python

- `modules/util/config/config_io.py`: pure last-session, secret, and preset I/O reused by native and web UIs.
- `modules/ui/TopBarController.py`: delegates existing I/O behavior to `config_io.py`; public controller behavior remains unchanged.
- `requirements-webui.txt`: optional runtime dependencies.
- `requirements-webui-dev.txt`: optional Python web test dependencies.

### Web Backend

- `modules/webui/app.py`: FastAPI factory, middleware, lifespan, router registration, and static SPA mount.
- `modules/webui/state.py`: immutable startup settings plus focused service composition.
- `modules/webui/config_codec.py`: recursive strict wire validation and fresh `TrainConfig` decode.
- `modules/webui/config_service.py`: revisioned config transaction and startup warnings.
- `modules/webui/schema.py`: metadata generation and the complete Phase A field registry.
- `modules/webui/presets.py`: opaque preset IDs and constrained preset load/save.
- `modules/webui/directories.py`: normalized, read-only directory listing.
- `modules/webui/console.py`: SGR parser, CR/LF parser, bounded buffer, rotating sink, and descriptor capture.
- `modules/webui/events.py`: stream sequencing, thread ingress, backlog, and bounded client subscriptions.
- `modules/webui/routers/*.py`: thin HTTP/WS adapters over the services.
- `scripts/train_ui_web.py`: argument parsing, capture installation, warning output, app creation, and Uvicorn execution.

Public backend data records locked by this plan:

```python
@dataclass(frozen=True)
class WebUISettings:
    root_dir: Path
    config_path: Path
    secrets_path: Path
    presets_dir: Path
    static_dir: Path
    dev: bool = False
    allowed_dev_origin: str = "http://localhost:5173"

@dataclass(frozen=True)
class FieldIssue:
    path: str
    message: str

@dataclass(frozen=True)
class ConfigSnapshot:
    config: dict[str, object]
    revision: str
```

Public backend call signatures locked by this plan:

- `decode_settings_document(document: object, secrets: SecretsConfig) -> TrainConfig`
- `ConfigService.load(settings: WebUISettings) -> ConfigService`
- `ConfigService.snapshot() -> ConfigSnapshot`
- `ConfigService.replace(document: object, base_revision: str, overwrite: bool = False) -> ConfigSnapshot`
- `ConfigService.replace_config(config: TrainConfig, base_revision: str, overwrite: bool = False) -> ConfigSnapshot`
- `SchemaRegistry.build(model_type: str, training_method: str) -> dict[str, object]`
- `SchemaRegistry.meta() -> dict[str, object]`
- `PresetService.tree() -> list[dict[str, object]]`
- `PresetService.load(preset_id: str) -> TrainConfig`
- `PresetService.save(name: str, snapshot: ConfigSnapshot) -> str`
- `DirectoryService.list(raw_path: str) -> dict[str, object]`
- `EventHub.publish_from_thread(event_type: str, payload: dict[str, object]) -> None`
- `EventHub.publish(event_type: str, payload: dict[str, object]) -> dict[str, object]`
- `EventHub.backlog() -> dict[str, object]`
- `EventHub.subscribe() -> AsyncIterator[dict[str, object]]`
- `ConsoleCapture.install() -> None`
- `ConsoleCapture.attach(loop: asyncio.AbstractEventLoop, hub: EventHub, workspace_dir: str) -> None`
- `ConsoleCapture.set_workspace(workspace_dir: str) -> None`
- `ConsoleCapture.close() -> None`
- `create_app(settings: WebUISettings, capture: ConsoleCapture | None = None) -> FastAPI`

### Web Frontend

- `web/src/lib/api/types.ts`: exact API and schema types.
- `web/src/lib/api/client.ts`: same-origin typed fetch helpers and normalized errors.
- `web/src/lib/api/queries.ts`: TanStack query keys and document operations.
- `web/src/lib/config/workspace.svelte.ts`: raw draft, validation, debounce, conflict, retry, and preset flush.
- `web/src/lib/events/client.ts`: WebSocket-first handshake and reconnect.
- `web/src/lib/events/console-store.svelte.ts`: deduplicated bounded rows and overwrite reduction.
- `web/src/lib/components/form/*`: schema renderer and focused controls.
- `web/src/lib/components/shell/*`: desktop rail, mobile drawer, header, status, and console drawer.
- `web/src/lib/components/directory/*`: desktop dialog and phone sheet.
- `web/src/lib/components/console/*`: fixed-row terminal viewport and controls.
- `web/src/routes/{general,data,backup,console}`: implemented routes; `/` redirects to `/general`.

Public frontend types locked by this plan:

```typescript
export type Revision = string;
export type ConfigDocument = Record<string, unknown>;
export type ConfigEnvelope = { config: ConfigDocument; revision: Revision };
export type FieldIssue = { path: string; message: string };
export type SaveState = "saved" | "saving" | "unsaved" | "failed" | "conflict";
export type ControlType = "toggle" | "text" | "number" | "select" | "directory" | "time";
export type FieldSchema = {
  id: string;
  keys: string[];
  label: string;
  tooltip: string;
  control: ControlType;
  required: boolean;
  nullable: boolean;
  visible: boolean;
  options?: { label: string; value: string }[];
  path_mode?: "directory";
};
export type GroupSchema = { id: string; title: string; fields: FieldSchema[] };
export type TabSchema = { id: "general" | "data" | "backup"; label: string; groups: GroupSchema[] };
export type ConfigSchema = { model_type: string; training_method: string; tabs: TabSchema[] };
export type ConsoleSpan = { text: string; classes: string[] };
export type ConsoleLine = { id: number; spans: ConsoleSpan[]; overwrite: boolean };
export type StreamEvent = {
  type: "console" | "config_changed";
  stream_id: string;
  seq: number;
  t: number;
  lines?: ConsoleLine[];
  revision?: Revision;
};
```

---

### Task 1: Extract Shared Config And Preset I/O

**Files:**
- Create: `requirements-webui.txt`
- Create: `requirements-webui-dev.txt`
- Create: `modules/util/config/config_io.py`
- Modify: `modules/ui/TopBarController.py:1-115`
- Create: `tests/webui/test_config_io.py`

**Interfaces:**
- Consumes: `TrainConfig`, `SecretsConfig`, `path_util.safe_filename`, `path_util.canonical_join`, and `write_json_atomic`.
- Produces: `load_train_config`, `load_preset_tree`, `save_settings`, `save_named_preset`, and `save_secrets` for Tasks 3 and 5.

- [ ] **Step 1: Add isolated runtime and test requirements**

```text
# requirements-webui.txt
fastapi
uvicorn[standard]
```

```text
# requirements-webui-dev.txt
-r requirements-webui.txt
httpx
pytest
pytest-asyncio
ruff==0.15.21
```

- [ ] **Step 2: Write failing config I/O tests**

```python
import json

from modules.util.config.TrainConfig import TrainConfig
from modules.util.config.config_io import load_preset_tree, load_train_config, save_named_preset, save_settings


def test_save_and_load_settings_preserves_external_secrets(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = TrainConfig.default_values()
    config.workspace_dir = "workspace/custom"
    config.secrets.huggingface_token = "server-token"
    save_settings(config, tmp_path / "training_presets" / "#.json")
    (tmp_path / "secrets.json").write_text(json.dumps({"huggingface_token": "loaded-token"}), encoding="utf-8")

    loaded = load_train_config(tmp_path / "training_presets" / "#.json", tmp_path / "secrets.json")

    assert loaded is not None
    assert loaded.workspace_dir == "workspace/custom"
    assert loaded.secrets.huggingface_token == "loaded-token"
    assert "secrets" not in json.loads((tmp_path / "training_presets" / "#.json").read_text(encoding="utf-8"))


def test_preset_tree_excludes_last_session_and_user_files(tmp_path):
    presets = tmp_path / "training_presets"
    (presets / "sdxl").mkdir(parents=True)
    (presets / "#.json").write_text("{}", encoding="utf-8")
    (presets / "#base.json").write_text("{}", encoding="utf-8")
    (presets / "user.json").write_text("{}", encoding="utf-8")
    (presets / "sdxl" / "#lora.json").write_text("{}", encoding="utf-8")

    assert load_preset_tree(presets) == [
        ("#base", str(presets / "#base.json").replace("\\", "/")),
        ("sdxl", [("#lora", str(presets / "sdxl" / "#lora.json").replace("\\", "/"))]),
    ]


def test_named_preset_sanitizes_name(tmp_path):
    path = save_named_preset(TrainConfig.default_values(), "unsafe:/ name", tmp_path)
    assert path.name == "unsafe name.json"
    assert path.parent == tmp_path
```

- [ ] **Step 3: Run the tests and verify the missing module failure**

Run: `python -m pytest tests/webui/test_config_io.py -v`

Expected: collection fails with `ModuleNotFoundError: No module named 'modules.util.config.config_io'`.

- [ ] **Step 4: Implement pure config I/O helpers**

Create `modules/util/config/config_io.py` with these exact behaviors:

```python
import json
from contextlib import suppress
from pathlib import Path

from modules.util import path_util
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.path_util import write_json_atomic


def load_preset_tree(directory: str | Path = "training_presets") -> list[tuple[str, str | list]]:
    directory = Path(directory)
    nodes: list[tuple[str, str | list]] = []
    if not directory.is_dir():
        return nodes
    for entry in sorted(directory.iterdir(), key=lambda item: item.name.lower()):
        if entry.is_dir():
            children = load_preset_tree(entry)
            if children:
                nodes.append((entry.name, children))
        elif entry.name.startswith("#") and entry.name != "#.json" and entry.suffix == ".json":
            nodes.append((entry.stem, str(entry).replace("\\", "/")))
    return nodes


def load_train_config(config_path: str | Path, secrets_path: str | Path = "secrets.json") -> TrainConfig | None:
    config_path = Path(config_path)
    try:
        loaded_dict = json.loads(config_path.read_text(encoding="utf-8"))
        is_builtin = config_path.name.startswith("#") and config_path.name != "#.json"
        loaded = TrainConfig.default_values().from_dict(loaded_dict, migrate=not is_builtin).to_unpacked_config()
        with suppress(FileNotFoundError):
            secret_dict = json.loads(Path(secrets_path).read_text(encoding="utf-8"))
            loaded.secrets = SecretsConfig.default_values().from_dict(secret_dict)
        return loaded
    except FileNotFoundError:
        return None


def save_settings(config: TrainConfig, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json_atomic(str(path), config.to_settings_dict(secrets=False))
    return path


def save_named_preset(config: TrainConfig, name: str, directory: str | Path = "training_presets") -> Path:
    safe_name = path_util.safe_filename(name)
    if not safe_name:
        raise ValueError("Preset name is empty after sanitization")
    return save_settings(config, Path(directory) / f"{safe_name}.json")


def save_secrets(config: TrainConfig, path: str | Path = "secrets.json") -> Path:
    path = Path(path)
    write_json_atomic(str(path), config.secrets.to_dict())
    return path
```

Also retain traceback printing in `TopBarController.load_config_from_file`: catch exceptions in the controller wrapper, print `traceback.format_exc()`, and return `None`. Delegate its successful I/O, tree, and save methods to the new helpers without changing public method names.

- [ ] **Step 5: Run focused tests and native import checks**

Run: `python -m pytest tests/webui/test_config_io.py -v`

Expected: all tests pass.

Run: `python -c "from modules.ui.TopBarController import TopBarController; from modules.util.config.TrainConfig import TrainConfig; TopBarController(TrainConfig.default_values()).load_preset_tree()"`

Expected: exit 0 with no output.

- [ ] **Step 6: Commit the shared extraction**

```bash
git add requirements-webui.txt requirements-webui-dev.txt modules/util/config/config_io.py modules/ui/TopBarController.py tests/webui/test_config_io.py
git commit -m "refactor(config): share preset IO"
```

---

### Task 2: Add Strict Settings Document Decoding

**Files:**
- Create: `modules/webui/__init__.py`
- Create: `modules/webui/config_codec.py`
- Create: `tests/webui/test_config_codec.py`

**Interfaces:**
- Consumes: `BaseConfig` metadata, `TrainConfig.default_values()`, and `SecretsConfig`.
- Produces: `FieldIssue`, `SettingsDocumentError`, and `decode_settings_document(document, secrets)` for Task 3 and API error mapping in Task 9.

- [ ] **Step 1: Write failing recursive validation tests**

```python
from copy import deepcopy

import pytest

from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_codec import SettingsDocumentError, decode_settings_document


def valid_document() -> dict:
    return TrainConfig.default_values().to_settings_dict(secrets=False)


def test_decode_rejects_unknown_nested_field():
    document = valid_document()
    document["optimizer"]["unknown"] = 1
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert error.value.issues == [("optimizer.unknown", "Unknown field")]


@pytest.mark.parametrize(
    ("path", "value", "message"),
    [
        ("tensorboard_port", True, "Expected integer"),
        ("workspace_dir", None, "Value is not nullable"),
        ("training_method", "NOT_A_METHOD", "Unknown enum value"),
        ("learning_rate", float("nan"), "Expected finite number"),
    ],
)
def test_decode_rejects_invalid_scalars(path, value, message):
    document = valid_document()
    document[path] = value
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert error.value.issues == [(path, message)]


def test_decode_requires_complete_current_document():
    document = valid_document()
    del document["workspace_dir"]
    with pytest.raises(SettingsDocumentError) as error:
        decode_settings_document(document, SecretsConfig.default_values())
    assert error.value.issues == [("workspace_dir", "Missing field")]


def test_decode_preserves_server_secrets_without_mutating_input():
    document = valid_document()
    original = deepcopy(document)
    secrets = SecretsConfig.default_values()
    secrets.huggingface_token = "server-only"
    decoded = decode_settings_document(document, secrets)
    assert decoded.secrets.huggingface_token == "server-only"
    assert document == original
```

- [ ] **Step 2: Verify strict decoder tests fail**

Run: `python -m pytest tests/webui/test_config_codec.py -v`

Expected: collection fails because `modules.webui.config_codec` does not exist.

- [ ] **Step 3: Implement recursive metadata validation and fresh decode**

Use immutable issues and collect all field errors in deterministic config-field order:

```python
import math
from copy import deepcopy
from dataclasses import dataclass
from enum import Enum
from typing import get_args, get_origin

from modules.util.config.BaseConfig import BaseConfig
from modules.util.config.SecretsConfig import SecretsConfig
from modules.util.config.TrainConfig import TrainConfig
from modules.util.type_util import issubclass_safe


@dataclass(frozen=True)
class FieldIssue:
    path: str
    message: str


class SettingsDocumentError(ValueError):
    def __init__(self, issues: list[FieldIssue]):
        super().__init__("Invalid settings document")
        self.field_issues = issues
        self.issues = [(issue.path, issue.message) for issue in issues]


def _join(path: str, name: str) -> str:
    return f"{path}.{name}" if path else name


def _validate_scalar(value: object, expected: type, nullable: bool, path: str, issues: list[FieldIssue]) -> None:
    if value is None:
        if not nullable:
            issues.append(FieldIssue(path, "Value is not nullable"))
        return
    if expected is bool and type(value) is not bool:
        issues.append(FieldIssue(path, "Expected boolean"))
    elif expected is int and (type(value) is not int):
        issues.append(FieldIssue(path, "Expected integer"))
    elif expected is float:
        if type(value) not in (int, float):
            if value not in ("inf", "-inf"):
                issues.append(FieldIssue(path, "Expected number"))
        elif not math.isfinite(float(value)):
            issues.append(FieldIssue(path, "Expected finite number"))
    elif expected is str and not isinstance(value, str):
        issues.append(FieldIssue(path, "Expected string"))
    elif issubclass_safe(expected, Enum) and (not isinstance(value, str) or value not in expected.__members__):
        issues.append(FieldIssue(path, "Unknown enum value"))


def _validate_config(document: object, template: BaseConfig, path: str, issues: list[FieldIssue], include_secrets: bool) -> None:
    if not isinstance(document, dict):
        issues.append(FieldIssue(path or "$", "Expected object"))
        return
    allowed = set(template.types)
    if not include_secrets:
        allowed.discard("secrets")
    allowed.add("__version")
    for unknown in sorted(set(document) - allowed):
        issues.append(FieldIssue(_join(path, unknown), "Unknown field"))
    for name, expected in template.types.items():
        if name == "secrets" and not include_secrets:
            continue
        field_path = _join(path, name)
        if name not in document:
            issues.append(FieldIssue(field_path, "Missing field"))
            continue
        value = document[name]
        nullable = template.nullables[name]
        current = getattr(template, name)
        origin = get_origin(expected)
        if issubclass_safe(expected, BaseConfig):
            if value is None and nullable:
                continue
            _validate_config(value, current, field_path, issues, include_secrets=True)
        elif origin is list or expected is list:
            if value is None and nullable:
                continue
            if not isinstance(value, list):
                issues.append(FieldIssue(field_path, "Expected list"))
                continue
            args = get_args(expected)
            if args and issubclass_safe(args[0], BaseConfig):
                for index, item in enumerate(value):
                    _validate_config(item, args[0].default_values(), f"{field_path}.{index}", issues, include_secrets=True)
        elif origin is dict or expected is dict:
            if value is None and nullable:
                continue
            if not isinstance(value, dict):
                issues.append(FieldIssue(field_path, "Expected object"))
        else:
            _validate_scalar(value, expected, nullable, field_path, issues)


def decode_settings_document(document: object, secrets: SecretsConfig) -> TrainConfig:
    issues: list[FieldIssue] = []
    template = TrainConfig.default_values()
    _validate_config(document, template, "", issues, include_secrets=False)
    if issues:
        raise SettingsDocumentError(issues)
    assert isinstance(document, dict)
    decoded = TrainConfig.default_values().from_dict(deepcopy(document), migrate=False).to_unpacked_config()
    decoded.secrets = deepcopy(secrets)
    return decoded
```

Also validate `__version` as an integer whenever it is present and require it because current `to_settings_dict` documents include it. Extend list validation for scalar element types and typed dictionaries using `get_args`, preserving deterministic indexed paths.

- [ ] **Step 4: Run codec tests and add list/dictionary edge cases**

Run: `python -m pytest tests/webui/test_config_codec.py -v`

Expected: all tests pass, including new cases for malformed `additional_embeddings`, `optimizer_defaults`, and `scheduler_params`.

- [ ] **Step 5: Run Ruff on the new module**

Run: `ruff check modules/webui/config_codec.py tests/webui/test_config_codec.py`

Expected: `All checks passed!`

- [ ] **Step 6: Commit the strict codec**

```bash
git add modules/webui/__init__.py modules/webui/config_codec.py tests/webui/test_config_codec.py
git commit -m "feat(webui): validate config documents"
```

---

### Task 3: Implement Revisioned Config Transactions

**Files:**
- Create: `modules/webui/state.py`
- Create: `modules/webui/config_service.py`
- Create: `tests/webui/test_config_service.py`

**Interfaces:**
- Consumes: Task 1 config I/O and Task 2 `decode_settings_document`.
- Produces: `WebUISettings`, `ConfigSnapshot`, `RevisionConflict`, `ConfigPersistenceError`, and `ConfigService` for Tasks 5, 7, 9, and 10.

- [ ] **Step 1: Write failing transaction tests**

```python
import asyncio
from pathlib import Path

import pytest

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_service import ConfigPersistenceError, ConfigService, RevisionConflict
from modules.webui.state import WebUISettings


def settings(tmp_path: Path) -> WebUISettings:
    return WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "training_presets" / "#.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "training_presets",
        static_dir=tmp_path / "web" / "build",
    )


@pytest.mark.asyncio
async def test_malformed_startup_config_falls_back_with_warning(tmp_path):
    app_settings = settings(tmp_path)
    app_settings.config_path.parent.mkdir(parents=True)
    app_settings.config_path.write_text("not json", encoding="utf-8")
    service = ConfigService.load(app_settings)
    assert service.warnings and "Could not load last-session config" in service.warnings[0]
    assert (await service.snapshot()).config["workspace_dir"] == "workspace/run"


@pytest.mark.asyncio
async def test_replace_persists_before_swapping_and_increments_revision(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    before = await service.snapshot()
    document = dict(before.config)
    document["workspace_dir"] = "workspace/new"
    after = await service.replace(document, before.revision)
    assert after.config["workspace_dir"] == "workspace/new"
    assert after.revision != before.revision
    reloaded = ConfigService.load(settings(tmp_path))
    assert (await reloaded.snapshot()).config["workspace_dir"] == "workspace/new"


@pytest.mark.asyncio
async def test_stale_revision_never_overwrites(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    first = await service.snapshot()
    one = dict(first.config)
    one["workspace_dir"] = "workspace/one"
    await service.replace(one, first.revision)
    stale = dict(first.config)
    stale["workspace_dir"] = "workspace/stale"
    with pytest.raises(RevisionConflict) as conflict:
        await service.replace(stale, first.revision)
    assert conflict.value.current.revision != first.revision
    assert (await service.snapshot()).config["workspace_dir"] == "workspace/one"


@pytest.mark.asyncio
async def test_concurrent_writers_accept_exactly_one(tmp_path):
    service = ConfigService.load(settings(tmp_path))
    baseline = await service.snapshot()
    documents = []
    for suffix in ("a", "b"):
        document = dict(baseline.config)
        document["workspace_dir"] = f"workspace/{suffix}"
        documents.append(document)
    results = await asyncio.gather(
        service.replace(documents[0], baseline.revision),
        service.replace(documents[1], baseline.revision),
        return_exceptions=True,
    )
    assert sum(isinstance(result, RevisionConflict) for result in results) == 1


@pytest.mark.asyncio
async def test_write_failure_keeps_memory_and_revision(tmp_path, monkeypatch):
    service = ConfigService.load(settings(tmp_path))
    before = await service.snapshot()
    document = dict(before.config)
    document["workspace_dir"] = "workspace/new"
    monkeypatch.setattr("modules.webui.config_service.save_settings", lambda config, path: (_ for _ in ()).throw(OSError("disk full")))
    with pytest.raises(ConfigPersistenceError):
        await service.replace(document, before.revision)
    assert await service.snapshot() == before
```

- [ ] **Step 2: Verify transaction tests fail**

Run: `python -m pytest tests/webui/test_config_service.py -v`

Expected: collection fails because `modules.webui.config_service` and `state` do not exist.

- [ ] **Step 3: Implement settings and transaction types**

```python
# modules/webui/state.py
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class WebUISettings:
    root_dir: Path
    config_path: Path
    secrets_path: Path
    presets_dir: Path
    static_dir: Path
    dev: bool = False
    allowed_dev_origin: str = "http://localhost:5173"
```

```python
# public portion of modules/webui/config_service.py
import asyncio
import uuid
from copy import deepcopy
from dataclasses import dataclass

from modules.util.config.TrainConfig import TrainConfig
from modules.util.config.config_io import load_train_config, save_settings
from modules.webui.config_codec import decode_settings_document
from modules.webui.state import WebUISettings


@dataclass(frozen=True)
class ConfigSnapshot:
    config: dict[str, object]
    revision: str


class RevisionConflict(Exception):
    def __init__(self, current: ConfigSnapshot):
        super().__init__("Config revision is stale")
        self.current = current


class ConfigPersistenceError(Exception):
    pass


class ConfigService:
    def __init__(self, settings: WebUISettings, config: TrainConfig, warnings: list[str]):
        self.settings = settings
        self._config = config
        self._warnings = warnings
        self._instance_id = uuid.uuid4().hex
        self._counter = 0
        self._lock = asyncio.Lock()
        self._change_listeners = []

    @classmethod
    def load(cls, settings: WebUISettings) -> "ConfigService":
        warnings: list[str] = []
        try:
            config = load_train_config(settings.config_path, settings.secrets_path)
        except Exception as error:
            warnings.append(f"Could not load last-session config: {error}")
            config = None
        return cls(settings, config or TrainConfig.default_values(), warnings)

    def _revision(self) -> str:
        return f"{self._instance_id}:{self._counter}"

    def _snapshot_unlocked(self) -> ConfigSnapshot:
        return ConfigSnapshot(deepcopy(self._config.to_settings_dict(secrets=False)), self._revision())

    async def snapshot(self) -> ConfigSnapshot:
        async with self._lock:
            return self._snapshot_unlocked()
```

Implement `replace` by decoding with current secrets and forwarding to `replace_config`. Under the same lock, `replace_config` compares the exact revision, copies current secrets, calls `save_settings`, swaps `_config`, increments `_counter`, snapshots, releases the lock, then awaits registered async listeners. `overwrite` records explicit intent but never bypasses the exact revision comparison. Wrap `OSError` from persistence as `ConfigPersistenceError`.

Expose read-only `warnings`, `current_workspace`, `add_change_listener`, and `remove_change_listener`. Listener failures are logged and do not roll back an already persisted transaction.

- [ ] **Step 4: Run transaction tests**

Run: `python -m pytest tests/webui/test_config_service.py -v`

Expected: all tests pass.

- [ ] **Step 5: Run config regression tests together**

Run: `python -m pytest tests/webui/test_config_io.py tests/webui/test_config_codec.py tests/webui/test_config_service.py -v`

Expected: all tests pass.

- [ ] **Step 6: Commit revisioned config state**

```bash
git add modules/webui/state.py modules/webui/config_service.py tests/webui/test_config_service.py
git commit -m "feat(webui): add revisioned config state"
```

---

### Task 4: Build The Phase A Schema And Metadata Registry

**Files:**
- Create: `modules/webui/schema.py`
- Create: `tests/webui/test_schema.py`

**Interfaces:**
- Consumes: `TrainConfig` metadata, `ModelType`, `TrainingMethod`, `TimeUnit`, `GradientReducePrecision`, and existing TopBar model/method labels.
- Produces: `SchemaRegistry.build(model_type, training_method)` and `SchemaRegistry.meta()` for Tasks 9, 12, and 13.

- [ ] **Step 1: Write failing schema coverage tests**

```python
import pytest

from modules.webui.schema import PHASE_A_KEYS, SchemaRegistry


EXPECTED_KEYS = {
    "workspace_dir", "cache_dir", "continue_last_backup", "only_cache", "prevent_overwrites",
    "debug_mode", "debug_dir", "tensorboard", "tensorboard_always_on", "tensorboard_expose",
    "tensorboard_port", "validation", "validate_after", "validate_after_unit", "dataloader_threads",
    "train_device", "async_offloading", "multi_gpu", "device_indexes", "gradient_reduce_precision",
    "fused_gradient_reduce", "async_gradient_reduce", "async_gradient_reduce_buffer", "temp_device",
    "aspect_ratio_bucketing", "latent_caching", "clear_cache_before_training", "backup_after",
    "backup_after_unit", "rolling_backup", "rolling_backup_count", "backup_before_save", "save_every",
    "save_every_unit", "save_skip_first", "save_filename_prefix",
}


def test_phase_a_schema_has_exact_native_field_keys():
    assert PHASE_A_KEYS == EXPECTED_KEYS
    schema = SchemaRegistry().build("STABLE_DIFFUSION_15", "FINE_TUNE")
    actual = {key for tab in schema["tabs"] for group in tab["groups"] for field in group["fields"] for key in field["keys"]}
    assert actual == EXPECTED_KEYS


def test_schema_paths_are_unique_and_have_tooltips():
    schema = SchemaRegistry().build("STABLE_DIFFUSION_15", "FINE_TUNE")
    fields = [field for tab in schema["tabs"] for group in tab["groups"] for field in group["fields"]]
    ids = [field["id"] for field in fields]
    assert len(ids) == len(set(ids))
    assert all(field["label"] and field["tooltip"] for field in fields)


def test_schema_rejects_unsupported_model_method_pair():
    with pytest.raises(ValueError, match="Training method is not supported"):
        SchemaRegistry().build("STABLE_DIFFUSION_15", "FINE_TUNE_VAE")


def test_meta_serializes_model_method_and_enum_values():
    meta = SchemaRegistry().meta()
    sd15 = next(model for model in meta["model_types"] if model["value"] == "STABLE_DIFFUSION_15")
    assert sd15["label"] == "SD1.5"
    assert {method["value"] for method in sd15["training_methods"]} >= {"FINE_TUNE", "LORA", "EMBEDDING"}
    assert "MINUTE" in meta["enums"]["TimeUnit"]
```

- [ ] **Step 2: Verify schema tests fail**

Run: `python -m pytest tests/webui/test_schema.py -v`

Expected: collection fails because `modules.webui.schema` does not exist.

- [ ] **Step 3: Implement metadata extraction and the complete field registry**

Create frozen Python metadata records `Option`, `Field`, `Group`, and `Tab`. `Field.to_dict(config_template)` must derive `nullable`, default, and enum options from the config path. `TimeInput` fields expose two keys in value/unit order.

Define groups and fields in this order:

```python
PHASE_A_KEYS = {
    "workspace_dir", "cache_dir", "continue_last_backup", "only_cache", "prevent_overwrites",
    "debug_mode", "debug_dir", "tensorboard", "tensorboard_always_on", "tensorboard_expose",
    "tensorboard_port", "validation", "validate_after", "validate_after_unit", "dataloader_threads",
    "train_device", "async_offloading", "multi_gpu", "device_indexes", "gradient_reduce_precision",
    "fused_gradient_reduce", "async_gradient_reduce", "async_gradient_reduce_buffer", "temp_device",
    "aspect_ratio_bucketing", "latent_caching", "clear_cache_before_training", "backup_after",
    "backup_after_unit", "rolling_backup", "rolling_backup_count", "backup_before_save", "save_every",
    "save_every_unit", "save_skip_first", "save_filename_prefix",
}

TABS = (
    Tab("general", "General", (
        Group("workspace", "Workspace", (
            Field("workspace-dir", ("workspace_dir",), "Workspace Directory", "The directory where all files of this training run are saved", "directory", path_mode="directory"),
            Field("cache-dir", ("cache_dir",), "Cache Directory", "The directory where cached data is saved", "directory", path_mode="directory"),
            Field("continue-backup", ("continue_last_backup",), "Continue from last backup", "Automatically continues training from the last backup saved in <workspace>/backup", "toggle"),
            Field("only-cache", ("only_cache",), "Only Cache", "Only populate the cache, without any training", "toggle"),
            Field("prevent-overwrites", ("prevent_overwrites",), "Prevent Overwrites", "When enabled, output paths that already exist on disk will be flagged as invalid to avoid accidental overwrites", "toggle"),
        )),
        Group("debug", "Debug", (
            Field("debug-mode", ("debug_mode",), "Debug mode", "Save debug information during the training into the debug directory", "toggle"),
            Field("debug-dir", ("debug_dir",), "Debug Directory", "The directory where debug data is saved", "directory", path_mode="directory"),
        )),
        Group("tensorboard", "TensorBoard", (
            Field("tensorboard", ("tensorboard",), "Tensorboard", "Starts the Tensorboard Web UI during training", "toggle"),
            Field("tensorboard-always", ("tensorboard_always_on",), "Always-On Tensorboard", "Keep Tensorboard accessible even when not training. Useful for monitoring completed training sessions.", "toggle"),
            Field("tensorboard-expose", ("tensorboard_expose",), "Expose Tensorboard", "Exposes Tensorboard Web UI to all network interfaces (makes it accessible from the network)", "toggle"),
            Field("tensorboard-port", ("tensorboard_port",), "Tensorboard Port", "Port to use for Tensorboard link", "number"),
        )),
        Group("validation", "Validation", (
            Field("validation", ("validation",), "Validation", "Enable validation steps and add new graph in tensorboard", "toggle"),
            Field("validate-after", ("validate_after", "validate_after_unit"), "Validate after", "The interval used when validate training", "time"),
        )),
        Group("devices", "Devices", (
            Field("dataloader-threads", ("dataloader_threads",), "Dataloader Threads", "Number of threads used for the data loader. Increase if your GPU has room during caching, decrease if it's going out of memory during caching.", "number", required=True),
            Field("train-device", ("train_device",), "Train Device", "The device used for training. Can be \"cuda\", \"cuda:0\", \"cuda:1\" etc. Default:\"cuda\". Must be \"cuda\" for multi-GPU training.", "text", required=True),
            Field("async-offloading", ("async_offloading",), "Async Offloading", "Overlaps CPU<->GPU transfers with computation using CUDA streams. Applies to every offloaded component", "toggle"),
            Field("multi-gpu", ("multi_gpu",), "Multi-GPU", "Enable multi-GPU training", "toggle"),
            Field("device-indexes", ("device_indexes",), "Device Indexes", "Multi-GPU: A comma-separated list of device indexes. If empty, all your GPUs are used. With a list such as \"0,1,3,4\" you can omit a GPU, for example an on-board graphics GPU.", "text"),
            Field("gradient-reduce-precision", ("gradient_reduce_precision",), "Gradient Reduce Precision", "WEIGHT_DTYPE: Reduce gradients between GPUs in your weight data type; can be imprecise, but more efficient than float32\nWEIGHT_DTYPE_STOCHASTIC: Sum up the gradients in your weight data type, but average them in float32 and stochastically round if your weight data type is bfloat16\nFLOAT_32: Reduce gradients in float32\nFLOAT_32_STOCHASTIC: Reduce gradients in float32; use stochastic rounding to bfloat16 if your weight data type is bfloat16", "select"),
            Field("fused-gradient-reduce", ("fused_gradient_reduce",), "Fused Gradient Reduce", "Multi-GPU: Gradient synchronisation during the backward pass. Can be more efficient, especially with Async Gradient Reduce", "toggle"),
            Field("async-gradient-reduce", ("async_gradient_reduce",), "Async Gradient Reduce", "Multi-GPU: Asynchroniously start the gradient reduce operations during the backward pass. Can be more efficient, but requires some VRAM.", "toggle"),
            Field("async-gradient-buffer", ("async_gradient_reduce_buffer",), "Buffer size (MB)", "Multi-GPU: Maximum VRAM for \"Async Gradient Reduce\", in megabytes. A multiple of this value can be needed if combined with \"Fused Back Pass\" and/or \"Layer offload fraction\"", "number"),
            Field("temp-device", ("temp_device",), "Temp Device", "The device used to temporarily offload models while they are not used. Default:\"cpu\"", "text"),
        )),
    )),
    Tab("data", "Data", (Group("caching", "Data and caching", (
        Field("aspect-ratio", ("aspect_ratio_bucketing",), "Aspect Ratio Bucketing", "Aspect ratio bucketing enables training on images with different aspect ratios", "toggle"),
        Field("latent-caching", ("latent_caching",), "Latent Caching", "Caching of intermediate training data that can be re-used between epochs", "toggle"),
        Field("clear-cache", ("clear_cache_before_training",), "Clear cache before training", "Clears the cache directory before starting to train. Only disable this if you want to continue using the same cached data. Disabling this can lead to errors, if other settings are changed during a restart", "toggle"),
    )),)),
    Tab("backup", "Backup", (Group("backup", "Backup and save", (
        Field("backup-after", ("backup_after", "backup_after_unit"), "Backup After", "The interval used when automatically creating model backups during training", "time"),
        Field("rolling-backup", ("rolling_backup",), "Rolling Backup", "If rolling backups are enabled, older backups are deleted automatically", "toggle"),
        Field("rolling-count", ("rolling_backup_count",), "Rolling Backup Count", "Defines the number of backups to keep if rolling backups are enabled", "number"),
        Field("backup-before-save", ("backup_before_save",), "Backup Before Save", "Create a full backup before saving the final model", "toggle"),
        Field("save-every", ("save_every", "save_every_unit"), "Save Every", "The interval used when automatically saving the model during training", "time"),
        Field("save-skip-first", ("save_skip_first",), "Skip First", "Start saving automatically after this interval has elapsed", "number"),
        Field("save-prefix", ("save_filename_prefix",), "Save Filename Prefix", "The prefix for filenames used when saving the model during training", "text"),
    )),)),
)
```

Tests must compare every registry label and tooltip against an explicit expected mapping copied from the three native builder methods, not only representative fields.

- [ ] **Step 4: Run schema tests and inspect serialized JSON**

Run: `python -m pytest tests/webui/test_schema.py -v`

Expected: all tests pass.

Run: `python -c "import json; from modules.webui.schema import SchemaRegistry; print(json.dumps(SchemaRegistry().build('STABLE_DIFFUSION_15', 'FINE_TUNE'))[:80])"`

Expected: output starts with a JSON object containing `model_type`, `training_method`, and `tabs`.

- [ ] **Step 5: Commit schema metadata**

```bash
git add modules/webui/schema.py tests/webui/test_schema.py
git commit -m "feat(webui): define Phase A schema"
```

---

### Task 5: Add Preset And Directory Services

**Files:**
- Create: `modules/webui/presets.py`
- Create: `modules/webui/directories.py`
- Create: `tests/webui/test_presets.py`
- Create: `tests/webui/test_directories.py`

**Interfaces:**
- Consumes: Task 1 shared I/O, Task 3 snapshots, `path_util.safe_filename`, and platform `Path` behavior.
- Produces: `PresetService`, `UnknownPreset`, `DirectoryService`, `DirectoryMissing`, and `DirectoryDenied` for Task 9.

- [ ] **Step 1: Write failing opaque-preset tests**

```python
import json

import pytest

from modules.util.config.TrainConfig import TrainConfig
from modules.webui.config_service import ConfigSnapshot
from modules.webui.presets import PresetService, UnknownPreset


def test_tree_returns_opaque_ids_and_loads_only_listed_entries(tmp_path):
    presets = tmp_path / "training_presets"
    presets.mkdir()
    document = TrainConfig.default_values().to_settings_dict(secrets=False)
    (presets / "#base.json").write_text(json.dumps(document), encoding="utf-8")
    service = PresetService(presets, tmp_path / "secrets.json")
    tree = service.tree()
    preset_id = tree[0]["id"]
    assert "/" not in preset_id and "\\" not in preset_id
    assert service.load(preset_id).workspace_dir == "workspace/run"
    with pytest.raises(UnknownPreset):
        service.load("Li4vc2VjcmV0cy5qc29u")


def test_save_uses_canonical_snapshot_and_refreshes_tree(tmp_path):
    service = PresetService(tmp_path / "training_presets", tmp_path / "secrets.json")
    document = TrainConfig.default_values().to_settings_dict(secrets=False)
    path = service.save("my preset", ConfigSnapshot(document, "instance:1"))
    assert path == "my preset.json"
    assert service.tree()[0]["label"] == "my preset"
```

- [ ] **Step 2: Write failing directory-service tests**

```python
from pathlib import Path

import pytest

from modules.webui.directories import DirectoryMissing, DirectoryService


def test_directory_listing_is_sorted_resolved_and_directory_only(tmp_path):
    (tmp_path / "z-dir").mkdir()
    (tmp_path / "a-dir").mkdir()
    (tmp_path / "file.txt").write_text("not listed", encoding="utf-8")
    result = DirectoryService(max_entries=5000).list(str(tmp_path))
    assert result["path"] == str(tmp_path.resolve())
    assert [entry["name"] for entry in result["directories"]] == ["a-dir", "z-dir"]
    assert result["truncated"] is False


def test_directory_listing_caps_results(tmp_path):
    for index in range(4):
        (tmp_path / f"dir-{index}").mkdir()
    result = DirectoryService(max_entries=3).list(str(tmp_path))
    assert len(result["directories"]) == 3
    assert result["truncated"] is True


def test_missing_directory_has_typed_error(tmp_path):
    with pytest.raises(DirectoryMissing):
        DirectoryService().list(str(tmp_path / "missing"))
```

- [ ] **Step 3: Verify both service tests fail**

Run: `python -m pytest tests/webui/test_presets.py tests/webui/test_directories.py -v`

Expected: collection fails because both service modules are absent.

- [ ] **Step 4: Implement constrained services**

`PresetService.tree()` rebuilds an internal ID-to-path map on every call. IDs are URL-safe base64 of a random per-service nonce plus the canonical relative preset path; only IDs present in the current map are loadable. Tree nodes use `{label, id}` leaves and `{label, children}` groups. Exclude `#.json`, include built-in `#*.json` and web-saved user `*.json`, and sort case-insensitively.

`PresetService.load()` resolves only through the map, calls `load_train_config`, and raises `UnknownPreset` for stale/unknown IDs. `save()` decodes the snapshot with default secrets, saves through `save_named_preset`, refreshes the tree, and returns the filename.

`DirectoryService.list()` uses `Path(raw_path).expanduser().resolve(strict=True)`, maps `FileNotFoundError` to `DirectoryMissing` and `PermissionError` to `DirectoryDenied`, rejects non-directories, sorts child directories by lowercase name, returns canonical string paths, parent availability, platform roots, and the 5,000-entry cap.

- [ ] **Step 5: Run service tests**

Run: `python -m pytest tests/webui/test_presets.py tests/webui/test_directories.py -v`

Expected: all tests pass.

- [ ] **Step 6: Commit filesystem-facing services**

```bash
git add modules/webui/presets.py modules/webui/directories.py tests/webui/test_presets.py tests/webui/test_directories.py
git commit -m "feat(webui): add preset and directory services"
```

---

### Task 6: Implement Terminal Parsing, Retention, And Log Rotation

**Files:**
- Create: `modules/webui/console.py`
- Create: `tests/webui/test_console_parser.py`
- Create: `tests/webui/test_console_buffer.py`

**Interfaces:**
- Consumes: raw byte chunks.
- Produces: `ConsoleSpan`, `ConsoleLine`, `TerminalParser`, `ConsoleBuffer`, and `RotatingLogSink` for Tasks 7, 8, and 10.

- [ ] **Step 1: Write failing parser tests for arbitrary chunks**

```python
from modules.webui.console import TerminalParser


def plain(line):
    return "".join(span.text for span in line.spans)


def test_parser_handles_split_utf8_and_crlf():
    parser = TerminalParser()
    encoded = "caf\u00e9\r\n".encode()
    assert parser.feed(encoded[:4]) == []
    lines = parser.feed(encoded[4:])
    assert [plain(line) for line in lines] == ["caf\u00e9"]
    assert lines[0].overwrite is False


def test_parser_turns_tqdm_carriage_returns_into_overwrites():
    parser = TerminalParser()
    parser.feed(b"\r10%")
    first = parser.snapshot_transient()
    parser.feed(b"\r20%")
    second = parser.snapshot_transient()
    assert plain(first) == "10%" and first.overwrite is True
    assert plain(second) == "20%" and second.overwrite is True


def test_parser_keeps_sgr_as_classes_and_strips_osc():
    parser = TerminalParser()
    lines = parser.feed(b"\x1b[31;1merror\x1b[0m \x1b]8;;https://bad\x07link\n")
    assert lines[0].spans[0].text == "error"
    assert lines[0].spans[0].classes == ("fg-red", "bold")
    assert "https://bad" not in plain(lines[0])
    assert plain(lines[0]).endswith(" link")
```

- [ ] **Step 2: Write failing retention and rotation tests**

```python
from modules.webui.console import ConsoleBuffer, ConsoleLine, ConsoleSpan, RotatingLogSink


def line(identifier: int, text: str, overwrite: bool = False) -> ConsoleLine:
    return ConsoleLine(identifier, (ConsoleSpan(text, ()),), overwrite)


def test_buffer_enforces_line_and_byte_limits():
    buffer = ConsoleBuffer(max_lines=2, max_bytes=7)
    buffer.apply([line(1, "one"), line(2, "two"), line(3, "three")])
    assert [item.id for item in buffer.snapshot()["lines"]] == [3]


def test_transient_line_is_replaced_not_committed():
    buffer = ConsoleBuffer()
    buffer.apply([line(1, "10%", True), line(2, "20%", True)])
    snapshot = buffer.snapshot()
    assert snapshot["lines"] == []
    assert snapshot["transient"].id == 2


def test_rotating_log_keeps_active_and_one_backup(tmp_path):
    sink = RotatingLogSink(tmp_path / "webui.log", max_bytes=8)
    sink.write(b"12345678")
    sink.write(b"9")
    sink.close()
    assert (tmp_path / "webui.log").read_bytes() == b"9"
    assert (tmp_path / "webui.log.1").read_bytes() == b"12345678"
```

- [ ] **Step 3: Verify parser and buffer tests fail**

Run: `python -m pytest tests/webui/test_console_parser.py tests/webui/test_console_buffer.py -v`

Expected: collection fails because `modules.webui.console` does not exist.

- [ ] **Step 4: Implement immutable console records and parser state machine**

Use these records:

```python
from collections.abc import Sequence


@dataclass(frozen=True)
class ConsoleSpan:
    text: str
    classes: Sequence[str]


@dataclass(frozen=True)
class ConsoleLine:
    id: int
    spans: Sequence[ConsoleSpan]
    overwrite: bool

    @property
    def text(self) -> str:
        return "".join(span.text for span in self.spans)
```

`TerminalParser` owns an incremental UTF-8 decoder, current style, current spans, pending-CR flag, ANSI state, and line counter. Implement SGR codes 0, 1, 2, 3, 4, 22, 23, 24, 30-37, 39, 40-47, and 49 as CSS class names. Strip complete unsupported CSI/OSC sequences. `feed()` commits on LF, treats CRLF as one commit, and treats standalone CR as the start of an overwrite row. `snapshot_transient()` returns the current row without clearing it.

`ConsoleBuffer.apply()` stores committed rows in a `deque`, keeps one transient row separately, and evicts oldest committed rows until both line and UTF-8 byte limits pass. `snapshot()` returns copied serializable records.

`RotatingLogSink` writes bytes under a lock. Before a write that exceeds the cap, close active, replace `.1`, reopen active, then write. `reopen(path)` atomically changes workspace sinks without raising into console capture; expose the last sink error for health/download behavior.

- [ ] **Step 5: Run focused console tests**

Run: `python -m pytest tests/webui/test_console_parser.py tests/webui/test_console_buffer.py -v`

Expected: all tests pass.

- [ ] **Step 6: Commit pure console internals**

```bash
git add modules/webui/console.py tests/webui/test_console_parser.py tests/webui/test_console_buffer.py
git commit -m "feat(webui): parse and retain console output"
```

---

### Task 7: Add Sequenced Event Hub And Race-Free Backlog

**Files:**
- Create: `modules/webui/events.py`
- Create: `tests/webui/test_events.py`

**Interfaces:**
- Consumes: Task 6 `ConsoleBuffer` and thread-published console records.
- Produces: `EventHub.start`, `close`, `publish`, `publish_from_thread`, `backlog`, and `subscribe` for Tasks 8, 10, and 16.

- [ ] **Step 1: Write failing sequence, gap, and coalescing tests**

```python
import asyncio

import pytest

from modules.webui.console import ConsoleBuffer
from modules.webui.events import EventHub


@pytest.mark.asyncio
async def test_events_have_one_stream_and_monotonic_sequences():
    hub = EventHub(ConsoleBuffer(), ingress_size=8, client_size=8)
    await hub.start()
    first = await hub.publish("config_changed", {"revision": "i:1"})
    second = await hub.publish("config_changed", {"revision": "i:2"})
    assert first["stream_id"] == second["stream_id"]
    assert second["seq"] == first["seq"] + 1
    await hub.close()


@pytest.mark.asyncio
async def test_slow_client_drops_console_but_keeps_latest_revision():
    hub = EventHub(ConsoleBuffer(), ingress_size=8, client_size=2)
    await hub.start()
    subscription = hub.subscribe()
    iterator = subscription.__aiter__()
    await hub.publish("console", {"lines": [{"id": 1, "spans": [], "overwrite": False}]})
    await hub.publish("console", {"lines": [{"id": 2, "spans": [], "overwrite": False}]})
    await hub.publish("config_changed", {"revision": "i:3"})
    received = [await asyncio.wait_for(iterator.__anext__(), 1) for _ in range(2)]
    assert received[-1]["type"] == "config_changed"
    assert received[-1]["revision"] == "i:3"
    assert any(event.get("gap") for event in received)
    await subscription.aclose()
    await hub.close()


@pytest.mark.asyncio
async def test_backlog_returns_snapshot_cursor_and_revision():
    buffer = ConsoleBuffer()
    hub = EventHub(buffer)
    await hub.start()
    event = await hub.publish("config_changed", {"revision": "i:1"})
    backlog = await hub.backlog()
    assert backlog["stream_id"] == event["stream_id"]
    assert backlog["cursor"] == event["seq"]
    assert backlog["revision"] == "i:1"
    await hub.close()
```

- [ ] **Step 2: Verify event tests fail**

Run: `python -m pytest tests/webui/test_events.py -v`

Expected: collection fails because `modules.webui.events` does not exist.

- [ ] **Step 3: Implement bounded hub lifecycle**

`EventHub(console: ConsoleBuffer | None = None, ingress_size: int = 2048, client_size: int = 256)` creates a default `ConsoleBuffer` when none is supplied and stores the configured limits. `start()` stores the running loop and starts one drain task over a bounded `queue.Queue(maxsize=ingress_size)`. `publish_from_thread()` uses `put_nowait`; if full, it drops the oldest console ingress batch, never waits, and records a gap. `publish()` serializes event creation under an `asyncio.Lock`, increments `seq`, updates latest revision, applies console lines to `ConsoleBuffer`, and offers the event to every subscriber.

Each subscriber owns an `asyncio.Queue(maxsize=256)`. When full, remove oldest console entries first; replace older `config_changed` entries with the latest revision; set `gap: true` on the next deliverable event. After repeated inability to enqueue a control event, close that subscriber.

`backlog()` reads console snapshot and current sequence under the event lock and returns `{stream_id, cursor, revision, lines, transient}`. `subscribe()` registers before yielding and always unregisters in `finally`.

- [ ] **Step 4: Run event tests, including thread ingress**

Run: `python -m pytest tests/webui/test_events.py -v`

Expected: all tests pass, including an added test that publishes 10 events from a real `threading.Thread` without blocking.

- [ ] **Step 5: Commit the event hub**

```bash
git add modules/webui/events.py tests/webui/test_events.py
git commit -m "feat(webui): add sequenced event hub"
```

---

### Task 8: Add File-Descriptor Capture Lifecycle

**Files:**
- Modify: `modules/webui/console.py`
- Create: `tests/webui/fixtures/console_capture_probe.py`
- Create: `tests/webui/test_console_capture.py`

**Interfaces:**
- Consumes: Task 6 parser/buffer/log and Task 7 thread ingress.
- Produces: `ConsoleCapture` for Task 10 and `scripts/train_ui_web.py` in Task 17.

- [ ] **Step 1: Write a subprocess probe that exercises both descriptors**

```python
# tests/webui/fixtures/console_capture_probe.py
import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path

from modules.webui.console import ConsoleCapture
from modules.webui.events import EventHub


async def main():
    result_path = Path(sys.argv[1])
    hub = EventHub()
    await hub.start()
    capture = ConsoleCapture()
    capture.install()
    capture.attach(asyncio.get_running_loop(), hub, tempfile.mkdtemp())
    print("stdout-line", flush=True)
    os.write(2, b"stderr-line\n")
    os.write(1, b"\r10%")
    os.write(1, b"\r20%\n")
    await asyncio.sleep(0.1)
    capture.close()
    await asyncio.sleep(0)
    result_path.write_text(json.dumps(await hub.backlog()), encoding="utf-8")
    await hub.close()


asyncio.run(main())
```

- [ ] **Step 2: Write the failing parent test**

```python
import json
import subprocess
import sys


def test_capture_tees_stdout_stderr_and_restores_descriptors(tmp_path):
    result = tmp_path / "result.json"
    process = subprocess.run(
        [sys.executable, "tests/webui/fixtures/console_capture_probe.py", str(result)],
        capture_output=True,
        text=True,
        check=True,
    )
    backlog = json.loads(result.read_text(encoding="utf-8"))
    browser_text = "\n".join("".join(span["text"] for span in line["spans"]) for line in backlog["lines"])
    assert "stdout-line" in process.stdout
    assert "stderr-line" in process.stdout
    assert "stdout-line" in browser_text
    assert "stderr-line" in browser_text
    assert "20%" in browser_text
```

- [ ] **Step 3: Verify capture test fails for missing class behavior**

Run: `python -m pytest tests/webui/test_console_capture.py -v`

Expected: the probe exits nonzero because `ConsoleCapture` is not defined.

- [ ] **Step 4: Implement install, attach, workspace switch, and safe close**

`ConsoleCapture.install()` duplicates fd 1 and 2, creates one pipe, and `dup2`s its writer onto both descriptors. It starts one daemon reader thread that always tees bytes to the saved original stdout descriptor, feeds `TerminalParser`, writes the active `RotatingLogSink`, and batches parsed/snapshot transient rows by 33 ms or 64 KiB before `hub.publish_from_thread`.

Before `attach`, retain parsed lines in the capture-owned `ConsoleBuffer`. `attach(loop, hub, workspace_dir)` transfers the current snapshot into the hub, configures the sink, and enables publishing. `set_workspace` reopens the sink under `<workspace>/webui.log` and records errors without recursing through redirected stderr.

`close()` implements the spec order exactly: flush `sys.stdout` and `sys.stderr`; restore fd 1 and 2; close extra writer handles; wait for reader EOF; join reader; flush pending parser rows and sink; close saved duplicates. Make it idempotent.

- [ ] **Step 5: Run parser, event, and capture tests together**

Run: `python -m pytest tests/webui/test_console_parser.py tests/webui/test_console_buffer.py tests/webui/test_events.py tests/webui/test_console_capture.py -v`

Expected: all tests pass and the test process's own descriptors remain usable.

- [ ] **Step 6: Commit descriptor capture**

```bash
git add modules/webui/console.py tests/webui/fixtures/console_capture_probe.py tests/webui/test_console_capture.py
git commit -m "feat(webui): capture process console output"
```

---

### Task 9: Expose Config, Schema, Preset, And Directory APIs

**Files:**
- Create: `modules/webui/routers/__init__.py`
- Create: `modules/webui/routers/config.py`
- Create: `modules/webui/routers/meta.py`
- Create: `modules/webui/routers/presets.py`
- Create: `modules/webui/routers/directories.py`
- Create: `modules/webui/app.py`
- Modify: `modules/webui/state.py`
- Create: `tests/webui/test_api_documents.py`

**Interfaces:**
- Consumes: Tasks 3-5 services.
- Produces: `create_app(settings, capture=None)` plus document APIs for Tasks 11-15.

- [ ] **Step 1: Write failing API transaction tests**

```python
import json

from fastapi.testclient import TestClient

from modules.webui.app import create_app
from modules.webui.state import WebUISettings


def make_client(tmp_path):
    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "training_presets" / "#.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "training_presets",
        static_dir=tmp_path / "web" / "build",
        dev=True,
    )
    return TestClient(create_app(settings))


def test_config_put_returns_normalized_revision_and_broadcast_ready_state(tmp_path):
    with make_client(tmp_path) as client:
        before = client.get("/api/config").json()
        before["config"]["tensorboard_port"] = 7000
        response = client.put("/api/config", json={"config": before["config"], "base_revision": before["revision"], "overwrite": False})
        assert response.status_code == 200
        assert response.json()["config"]["tensorboard_port"] == 7000
        assert response.json()["revision"] != before["revision"]


def test_stale_put_returns_current_revision(tmp_path):
    with make_client(tmp_path) as client:
        baseline = client.get("/api/config").json()
        first = dict(baseline["config"])
        first["workspace_dir"] = "workspace/one"
        assert client.put("/api/config", json={"config": first, "base_revision": baseline["revision"]}).status_code == 200
        stale = client.put("/api/config", json={"config": baseline["config"], "base_revision": baseline["revision"]})
        assert stale.status_code == 409
        assert stale.json()["detail"]["current_revision"] != baseline["revision"]


def test_invalid_config_returns_structured_422_without_secrets(tmp_path):
    with make_client(tmp_path) as client:
        baseline = client.get("/api/config").json()
        baseline["config"]["tensorboard_port"] = True
        response = client.put("/api/config", json={"config": baseline["config"], "base_revision": baseline["revision"]})
        assert response.status_code == 422
        assert response.json()["detail"] == [{"path": "tensorboard_port", "message": "Expected integer"}]
        assert "secrets" not in str(response.json())


def test_client_secret_field_is_rejected(tmp_path):
    with make_client(tmp_path) as client:
        baseline = client.get("/api/config").json()
        baseline["config"]["secrets"] = {"huggingface_token": "client-value"}
        response = client.put("/api/config", json={
            "config": baseline["config"],
            "base_revision": baseline["revision"],
        })
        assert response.status_code == 422
        assert response.json()["detail"] == [{"path": "secrets", "message": "Unknown field"}]
```

- [ ] **Step 2: Add failing schema, preset, and directory endpoint tests**

Test exact routes and errors:

```python
def test_schema_requires_supported_pair(tmp_path):
    with make_client(tmp_path) as client:
        response = client.get("/api/config/schema", params={"model_type": "STABLE_DIFFUSION_15", "training_method": "FINE_TUNE"})
        assert response.status_code == 200
        assert [tab["id"] for tab in response.json()["tabs"]] == ["general", "data", "backup"]


def test_directory_errors_are_mapped(tmp_path):
    with make_client(tmp_path) as client:
        response = client.get("/api/fs/directories", params={"path": str(tmp_path / "missing")})
        assert response.status_code == 404
        assert response.json()["detail"] == "Directory does not exist"


def test_preset_round_trip_uses_opaque_ids_and_current_revision(tmp_path):
    client = make_client(tmp_path)
    with client:
        baseline = client.get("/api/config").json()
        built_in = dict(baseline["config"])
        built_in["workspace_dir"] = "workspace/preset"
        presets_dir = tmp_path / "training_presets"
        presets_dir.mkdir(parents=True, exist_ok=True)
        (presets_dir / "#base.json").write_text(json.dumps(built_in), encoding="utf-8")
        tree = client.get("/api/presets").json()
        preset_id = tree[0]["id"]
        loaded = client.post("/api/presets/load", json={
            "preset_id": preset_id,
            "base_revision": baseline["revision"],
            "overwrite": False,
        })
        assert loaded.status_code == 200
        assert loaded.json()["config"]["workspace_dir"] == "workspace/preset"
        saved = client.post("/api/presets/save", json={"name": "my preset"})
        assert saved.status_code == 200
        assert saved.json() == {"filename": "my preset.json"}
        assert client.post("/api/presets/load", json={
            "preset_id": "Li4vc2VjcmV0cy5qc29u",
            "base_revision": loaded.json()["revision"],
            "overwrite": False,
        }).status_code == 404
```

- [ ] **Step 3: Verify API tests fail**

Run: `python -m pytest tests/webui/test_api_documents.py -v`

Expected: collection fails because `modules.webui.app` and routers are absent.

- [ ] **Step 4: Implement application service composition**

Extend `state.py` with `AppState` containing `settings`, `config`, `schema`, `presets`, `directories`, and later `events`. `create_app` constructs these services in an async lifespan, stores `AppState` on `app.state.webui`, and includes thin routers.

Use Pydantic request models:

```python
class ConfigPutRequest(BaseModel):
    config: dict[str, object]
    base_revision: str
    overwrite: bool = False


class PresetLoadRequest(BaseModel):
    preset_id: str
    base_revision: str
    overwrite: bool = False


class PresetSaveRequest(BaseModel):
    name: str
```

Map `SettingsDocumentError` to 422 field details, `RevisionConflict` to 409 current revision, persistence errors to 500, unknown presets to 404, and directory typed errors to 403/404. The preset-save router snapshots `ConfigService` at request time. The preset-load router obtains a `TrainConfig` from `PresetService` and calls `replace_config`.

- [ ] **Step 5: Add 1 MiB JSON body middleware**

Reject a numeric `Content-Length` above 1,048,576 before reading the body. Also count streamed request bytes when length is absent; return 413 and do not call the endpoint. Add tests for both cases.

- [ ] **Step 6: Run all document API tests**

Run: `python -m pytest tests/webui/test_api_documents.py -v`

Expected: all tests pass.

- [ ] **Step 7: Commit document APIs**

```bash
git add modules/webui/app.py modules/webui/state.py modules/webui/routers tests/webui/test_api_documents.py
git commit -m "feat(webui): expose config document APIs"
```

---

### Task 10: Expose Health, Console Backlog, WebSocket, Log, And Static SPA

**Files:**
- Create: `modules/webui/routers/events.py`
- Create: `modules/webui/routers/console.py`
- Create: `modules/webui/routers/health.py`
- Modify: `modules/webui/app.py`
- Modify: `modules/webui/state.py`
- Create: `tests/webui/test_api_events.py`
- Create: `tests/webui/test_api_security.py`

**Interfaces:**
- Consumes: Tasks 3, 7, 8, and 9 app composition.
- Produces: complete Phase A backend contract for frontend and E2E tasks.

- [ ] **Step 1: Write failing backlog and WebSocket tests**

```python
def test_backlog_and_socket_share_stream_cursor(tmp_path):
    with make_client(tmp_path) as client:
        state = client.app.state.webui
        state.events.publish_from_thread("console", {"lines": [{"id": 1, "spans": [{"text": "hello", "classes": []}], "overwrite": False}]})
        with client.websocket_connect("/api/events", headers={"origin": "http://testserver"}) as socket:
            backlog = client.get("/api/events/backlog").json()
            state.events.publish_from_thread("config_changed", {"revision": "instance:2"})
            live = socket.receive_json()
        assert backlog["stream_id"] == live["stream_id"]
        assert live["seq"] > backlog["cursor"]


def test_wrong_websocket_origin_is_rejected(tmp_path):
    with make_client(tmp_path) as client:
        with pytest.raises(WebSocketDisconnect) as disconnect:
            with client.websocket_connect("/api/events", headers={"origin": "https://evil.example"}):
                pass
        assert disconnect.value.code == 1008
```

- [ ] **Step 2: Write failing health, log, and static tests**

Cover these exact cases:

```python
def test_health_reports_build_and_startup_warnings(tmp_path):
    with make_client(tmp_path) as client:
        body = client.get("/api/health").json()
        assert body["status"] == "ok"
        assert body["frontend_built"] is False
        assert isinstance(body["warnings"], list)


def test_log_download_is_404_without_active_sink(tmp_path):
    with make_client(tmp_path) as client:
        assert client.get("/api/console/log").status_code == 404


def test_dev_cors_allows_only_configured_vite_origin(tmp_path):
    with make_client(tmp_path) as client:
        allowed = client.options("/api/config", headers={
            "origin": "http://localhost:5173",
            "access-control-request-method": "GET",
        })
        denied = client.options("/api/config", headers={
            "origin": "https://evil.example",
            "access-control-request-method": "GET",
        })
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert "access-control-allow-origin" not in denied.headers
```

Add a production static fixture containing `index.html`, assert `/general` returns it, and assert traversal requests cannot escape `static_dir`.

- [ ] **Step 3: Verify event/security tests fail**

Run: `python -m pytest tests/webui/test_api_events.py tests/webui/test_api_security.py -v`

Expected: missing routes and app state cause failures.

- [ ] **Step 4: Wire event lifecycle and config broadcasts**

`AppState` owns one `EventHub`. Lifespan starts it, attaches optional `ConsoleCapture`, prints each config startup warning to stderr after capture attachment so it enters the terminal and backlog, registers an async `ConfigService` listener that publishes `config_changed` and calls `capture.set_workspace`, and closes services in reverse order.

The backlog router returns `await events.backlog()`. The WebSocket router validates `Origin`: production browser origins must have the same hostname and effective port as `Host`; dev additionally accepts exactly `allowed_dev_origin`. After acceptance, iterate `events.subscribe()` and send JSON until disconnect. Add `CORSMiddleware` only when `settings.dev`, with `allow_origins=[settings.allowed_dev_origin]`, all API methods, JSON/content headers, and credentials disabled. Production installs no CORS middleware.

- [ ] **Step 5: Add health, safe log response, and static fallback**

Health returns `{status, version, frontend_built, revision, warnings}`. Resolve `version` once at startup with `git rev-parse --short HEAD` executed in `settings.root_dir`, falling back to `"unknown"` on any failure; use the same value in `/api/meta`. Console log returns `FileResponse` only for the active sink's exact resolved path. Mount `/api` routers before static handling. In production, verify `static_dir/index.html` exists; serve assets normally and return `index.html` only for extensionless non-API routes. In dev, do not mount static files.

- [ ] **Step 6: Run complete backend API suite**

Run: `python -m pytest tests/webui/test_api_documents.py tests/webui/test_api_events.py tests/webui/test_api_security.py -v`

Expected: all tests pass.

Run: `ruff check modules/webui tests/webui`

Expected: `All checks passed!`

- [ ] **Step 7: Commit backend integration**

```bash
git add modules/webui tests/webui/test_api_events.py tests/webui/test_api_security.py
git commit -m "feat(webui): serve events and static app"
```

---

### Task 11: Create The SvelteKit SPA And Typed API Layer

**Files:**
- Modify: `.gitignore`
- Create: `web/package.json`
- Create: `web/bun.lock`
- Create: `web/svelte.config.js`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/src/app.html`
- Create: `web/src/app.css`
- Create: `web/src/routes/+layout.ts`
- Create: `web/src/routes/+layout.svelte`
- Create: `web/src/routes/+page.ts`
- Create: `web/src/lib/api/types.ts`
- Create: `web/src/lib/api/client.ts`
- Create: `web/src/lib/api/client.test.ts`
- Create: `web/src/lib/api/queries.ts`
- Create: `web/vitest-setup.ts`

**Interfaces:**
- Consumes: Task 9-10 JSON contracts.
- Produces: typed `api`, `queryClient`, query keys, and API types for all remaining frontend tasks.

- [ ] **Step 1: Add ignored frontend artifacts and package scripts**

Append these root ignores:

```gitignore
/web/build/
/web/node_modules/
/web/.build-source
/web/.e2e/
/web/test-results/
/web/playwright-report/
```

Create this package manifest, then let `bun install` resolve exact transitive versions into `bun.lock`:

```json
{
  "name": "onetrainer-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@tanstack/svelte-query": "^5.0.0",
    "lucide-svelte": "^0.468.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@sveltejs/adapter-static": "^3.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/svelte": "^5.0.0",
    "@types/node": "^22.0.0",
    "jsdom": "^25.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

Use Svelte 5, SvelteKit, `adapter-static`, `@tanstack/svelte-query`, and `lucide-svelte`; add Vitest, jsdom, Testing Library, `svelte-check`, and Playwright as dev dependencies. Generate and commit `bun.lock` with `bun --cwd web install`.

- [ ] **Step 2: Write failing typed client tests**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApi } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("returns typed JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ config: {}, revision: "i:0" }), { status: 200 }));
    const api = createApi("");
    await expect(api.getConfig()).resolves.toEqual({ config: {}, revision: "i:0" });
  });

  it("normalizes FastAPI field errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ detail: [{ path: "x", message: "bad" }] }), { status: 422 }));
    await expect(createApi("").getConfig()).rejects.toEqual(new ApiError(422, [{ path: "x", message: "bad" }]));
  });
});
```

- [ ] **Step 3: Verify frontend tests fail**

Run: `bun --cwd web run test`

Expected: test compilation fails because `createApi` and `ApiError` do not exist.

- [ ] **Step 4: Implement the static SPA and API client**

Set `adapter-static({ fallback: "index.html" })`, `ssr = false`, and Vite `/api` HTTP/WS proxy to `http://127.0.0.1:7801`. Configure Vitest with `environment: "jsdom"`, `setupFiles: ["./vitest-setup.ts"]`, and Svelte component inclusion; `vitest-setup.ts` imports `@testing-library/jest-dom/vitest`, clears DOM state, and clears `localStorage` after each test. `+page.ts` redirects `/` to `/general` with SvelteKit `redirect(307, "/general")`.

`createApi(base)` exposes `getHealth`, `getConfig`, `putConfig`, `getSchema`, `getMeta`, `getPresets`, `loadPreset`, `savePreset`, `listDirectories`, and `getBacklog`. Every request sends/accepts JSON, uses same-origin credentials, and throws `ApiError(status, detail)` without flattening structured field errors.

Initialize one `QueryClient` in `+layout.svelte` through `QueryClientProvider`. Define stable query keys in `queries.ts`, including model type and training method in the schema key.

- [ ] **Step 5: Run type, unit, and production build checks**

Run: `bun --cwd web run test && bun --cwd web run check && bun --cwd web run build`

Expected: Vitest passes, `svelte-check found 0 errors and 0 warnings`, and Vite writes `web/build/index.html`.

- [ ] **Step 6: Commit frontend foundation**

```bash
git add .gitignore web
git commit -m "feat(webui): scaffold SvelteKit client"
```

---

### Task 12: Implement Config Workspace, Validation, Autosave, And Conflicts

**Files:**
- Create: `web/src/lib/config/path.ts`
- Create: `web/src/lib/config/validation.ts`
- Create: `web/src/lib/config/workspace.svelte.ts`
- Create: `web/src/lib/config/workspace.test.ts`

**Interfaces:**
- Consumes: Task 11 `api`, `ConfigEnvelope`, `ConfigSchema`, and field issues.
- Produces: `ConfigWorkspace` with `setRaw`, `flush`, `retry`, `acceptRemote`, `reloadServer`, `overwriteServer`, `beforePresetSave`, and reactive state for Tasks 13-16.

- [ ] **Step 1: Write failing workspace state tests with fake timers**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigWorkspace } from "./workspace.svelte";

const schema = {
  model_type: "STABLE_DIFFUSION_15",
  training_method: "FINE_TUNE",
  tabs: [{ id: "general", label: "General", groups: [{ id: "g", title: "G", fields: [
    { id: "port", keys: ["tensorboard_port"], label: "Port", tooltip: "Port", control: "number", required: true, nullable: false, visible: true },
  ] }] }],
} as const;

beforeEach(() => vi.useFakeTimers());

it("keeps invalid raw input local and unsaved", async () => {
  const put = vi.fn();
  const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema, put);
  workspace.setRaw("tensorboard_port", "bad");
  await vi.advanceTimersByTimeAsync(600);
  expect(workspace.state).toBe("unsaved");
  expect(workspace.errors).toEqual([{ path: "tensorboard_port", message: "Expected integer" }]);
  expect(put).not.toHaveBeenCalled();
});

it("debounces a valid full-document save", async () => {
  const put = vi.fn().mockResolvedValue({ config: { tensorboard_port: 7000 }, revision: "i:1" });
  const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema, put);
  workspace.setRaw("tensorboard_port", "7000");
  await vi.advanceTimersByTimeAsync(499);
  expect(put).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(put).toHaveBeenCalledWith({ config: { tensorboard_port: 7000 }, base_revision: "i:0", overwrite: false });
  expect(workspace.state).toBe("saved");
});

it("preserves draft through conflict and explicit overwrite", async () => {
  const put = vi.fn()
    .mockRejectedValueOnce({ status: 409, detail: { current_revision: "i:1" } })
    .mockResolvedValueOnce({ config: { tensorboard_port: 7000 }, revision: "i:2" });
  const workspace = new ConfigWorkspace({ config: { tensorboard_port: 6006 }, revision: "i:0" }, schema, put);
  workspace.setRaw("tensorboard_port", "7000");
  await workspace.flush();
  expect(workspace.state).toBe("conflict");
  await workspace.overwriteServer();
  expect(put).toHaveBeenLastCalledWith({ config: { tensorboard_port: 7000 }, base_revision: "i:1", overwrite: true });
});
```

- [ ] **Step 2: Verify workspace tests fail**

Run: `bun --cwd web run test -- src/lib/config/workspace.test.ts`

Expected: module resolution fails for the workspace implementation.

- [ ] **Step 3: Implement immutable path helpers and schema-driven validation**

`getPath`, `setPath`, and `cloneDocument` must never mutate TanStack cached objects. Validation preserves raw strings for text/number/time controls; converts valid integer/float strings to numbers; permits `null` only for nullable fields; validates enum options; validates every visible or hidden schema field represented in Phase A; and returns both normalized full document and field issues.

- [ ] **Step 4: Implement ConfigWorkspace state transitions**

Use Svelte 5 runes inside the class. Constructor inputs are baseline envelope, schema, and a `putConfig` function. `setRaw` updates draft/dirty paths, validates, sets `unsaved`, and resets one 500 ms timer only when valid. `flush` cancels the timer, sends the full normalized document, and handles:

- Success: replace baseline and draft, clear dirty/errors/conflict, set `saved`.
- 409: preserve draft, remember current revision, set `conflict`.
- Network/5xx: preserve draft, set `failed`.
- 422: merge server field issues, set `unsaved`.

`retry()` calls `flush()` only from `failed` or valid `unsaved` state. `acceptRemote(envelope)` ignores matching revisions, replaces a clean workspace, and marks a dirty workspace conflicted. `reloadServer` requires a caller confirmation flag and replaces local state. `overwriteServer` retries with remembered conflict revision and `overwrite: true`. `beforePresetSave` rejects invalid/conflicted state and awaits `flush` when dirty.

- [ ] **Step 5: Run workspace and type checks**

Run: `bun --cwd web run test -- src/lib/config/workspace.test.ts && bun --cwd web run check`

Expected: tests pass and Svelte check reports zero errors.

- [ ] **Step 6: Commit config workspace behavior**

```bash
git add web/src/lib/config
git commit -m "feat(webui): add autosaving config workspace"
```

---

### Task 13: Render Schema Forms And Implement General, Data, Backup Routes

**Files:**
- Create: `web/src/lib/components/form/Field.svelte`
- Create: `web/src/lib/components/form/Toggle.svelte`
- Create: `web/src/lib/components/form/TextInput.svelte`
- Create: `web/src/lib/components/form/NumberInput.svelte`
- Create: `web/src/lib/components/form/Select.svelte`
- Create: `web/src/lib/components/form/DirectoryInput.svelte`
- Create: `web/src/lib/components/form/TimeInput.svelte`
- Create: `web/src/lib/components/form/SchemaForm.svelte`
- Create: `web/src/lib/components/form/SchemaForm.test.ts`
- Create: `web/src/lib/config/context.ts`
- Create: `web/src/routes/general/+page.svelte`
- Create: `web/src/routes/data/+page.svelte`
- Create: `web/src/routes/backup/+page.svelte`

**Interfaces:**
- Consumes: Task 11 queries/types and Task 12 workspace.
- Produces: schema-driven implemented routes and a directory-open callback for Task 15.

- [ ] **Step 1: Write failing renderer tests**

```typescript
import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import SchemaForm from "./SchemaForm.svelte";

it("renders labels, tooltips, controls, and errors from schema", async () => {
  const setRaw = vi.fn();
  render(SchemaForm, {
    tab: { id: "general", label: "General", groups: [{ id: "workspace", title: "Workspace", fields: [
      { id: "workspace-dir", keys: ["workspace_dir"], label: "Workspace Directory", tooltip: "Server path", control: "directory", required: true, nullable: false, visible: true, path_mode: "directory" },
    ] }] },
    values: { workspace_dir: "/workspace" },
    issues: [{ path: "workspace_dir", message: "Bad path" }],
    setRaw,
  });
  expect(screen.getByLabelText("Workspace Directory")).toHaveValue("/workspace");
  expect(screen.getByText("Bad path")).toBeVisible();
  await fireEvent.input(screen.getByLabelText("Workspace Directory"), { target: { value: "/new" } });
  expect(setRaw).toHaveBeenCalledWith("workspace_dir", "/new");
});

it("does not render invisible fields", () => {
  render(SchemaForm, { tab: { id: "data", label: "Data", groups: [{ id: "g", title: "G", fields: [
    { id: "hidden", keys: ["x"], label: "Hidden", tooltip: "Hidden", control: "text", required: false, nullable: false, visible: false },
  ] }] }, values: { x: "x" }, issues: [], setRaw: vi.fn() });
  expect(screen.queryByLabelText("Hidden")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify renderer tests fail**

Run: `bun --cwd web run test -- src/lib/components/form/SchemaForm.test.ts`

Expected: imports fail because form components do not exist.

- [ ] **Step 3: Implement focused accessible controls**

`Field.svelte` owns `<label>`, tooltip button, help popover, error element, and `aria-describedby`. Each input receives the generated stable ID. `NumberInput` uses `type="text"` plus `inputmode="decimal"` so invalid intermediate text survives. `Toggle` uses a native checkbox. `Select` uses native `<select>`. `TimeInput` binds value and unit keys separately. `DirectoryInput` emits `openDirectory` without changing its text behavior.

`SchemaForm.svelte` maps controls explicitly with a Svelte `{#if}` chain over the closed `ControlType` union; unknown control values throw during development. Do not use dynamic HTML or arbitrary component names from the server.

- [ ] **Step 4: Create route context and implemented pages**

The root layout loads health, meta, config, and schema queries; constructs one `ConfigWorkspace`; and provides `{workspace, schema, openDirectory}` through a typed context. Each page selects its exact tab ID and renders `SchemaForm`. Loading uses skeleton rows; API failure uses the persistent shell banner added in Task 14.

- [ ] **Step 5: Run form and workspace tests**

Run: `bun --cwd web run test -- src/lib/components/form/SchemaForm.test.ts src/lib/config/workspace.test.ts && bun --cwd web run check`

Expected: all tests pass and Svelte check reports zero errors.

- [ ] **Step 6: Commit schema-rendered routes**

```bash
git add web/src/lib/components/form web/src/lib/config/context.ts web/src/routes/general web/src/routes/data web/src/routes/backup web/src/routes/+layout.svelte
git commit -m "feat(webui): render Phase A config forms"
```

---

### Task 14: Build The Graphite And Ember Responsive Shell

**Files:**
- Modify: `web/src/app.css`
- Create: `web/src/lib/components/shell/Rail.svelte`
- Create: `web/src/lib/components/shell/Rail.test.ts`
- Create: `web/src/lib/components/shell/Header.svelte`
- Create: `web/src/lib/components/shell/StatusBar.svelte`
- Create: `web/src/lib/components/shell/ConsoleDrawer.svelte`
- Create: `web/src/lib/components/shell/ErrorBanner.svelte`
- Modify: `web/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: Task 12 workspace, Task 13 route context, meta/preset queries, and future Task 16 console slot.
- Produces: approved desktop/mobile shell, preset actions, autosave status, and disabled future routes.

- [ ] **Step 1: Write failing rail interaction tests**

```typescript
import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it } from "vitest";
import Rail from "./Rail.svelte";

it("persists pinned expansion and keeps future routes disabled", async () => {
  render(Rail, { currentPath: "/general", mobile: false });
  await fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(localStorage.getItem("webui.railExpanded")).toBe("true");
  expect(screen.getByText("General")).toBeVisible();
  expect(screen.getByRole("link", { name: "Model" })).toHaveAttribute("aria-disabled", "true");
});

it("opens phone navigation as a modal drawer", async () => {
  render(Rail, { currentPath: "/general", mobile: true });
  await fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
});
```

- [ ] **Step 2: Verify shell tests fail**

Run: `bun --cwd web run test -- src/lib/components/shell/Rail.test.ts`

Expected: component import fails.

- [ ] **Step 3: Define semantic theme and layout tokens**

Use this token foundation in `app.css`, then add component classes without literal colors:

```css
:root {
  color-scheme: dark;
  --bg: #101419;
  --panel: #181e25;
  --panel-raised: #1d242c;
  --control: #14191f;
  --line: #2d3741;
  --text: #e6ebef;
  --muted: #8995a1;
  --accent: #dd773b;
  --accent-soft: #2a2725;
  --danger: #d97878;
  --success: #65b98d;
  --focus: #f2a16f;
  --rail-compact: 48px;
  --rail-expanded: 176px;
  --status-height: 52px;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
```

Add global focus-visible rings, reduced-motion overrides, 44 px mobile controls, safe-area status padding, two-column form grid above 768 px, and one-column below it.

- [ ] **Step 4: Implement shell components and preset semantics**

`Rail` shows icons in both states, labels only when expanded, reflows desktop content, and uses an off-canvas focus-trapped dialog on phone. Implemented links are General, Data, Backup, Console. Disabled links are Model, Concepts, Training, Sampling, LoRA/Embedding, Cloud, Tools, and Live with concise unavailable tooltips.

`Header` renders model type, valid methods, preset tree, save-name dialog, workspace save state, Retry, Reload, and Overwrite actions. Model/method edits update the config workspace and schema query immediately. Preset save calls `beforePresetSave`; preset load includes current revision and enters normal conflict UI on 409.

`StatusBar` displays server connected state and disabled Start, Sample, Backup, and Save actions with `aria-disabled`. `ConsoleDrawer` provides the slot Task 16 fills. `ErrorBanner` retains API errors until dismissed.

- [ ] **Step 5: Run shell tests and production build**

Run: `bun --cwd web run test -- src/lib/components/shell && bun --cwd web run check && bun --cwd web run build`

Expected: tests pass, Svelte check reports zero errors, and build completes.

- [ ] **Step 6: Commit responsive shell**

```bash
git add web/src/app.css web/src/lib/components/shell web/src/routes/+layout.svelte
git commit -m "feat(webui): add responsive application shell"
```

---

### Task 15: Add Desktop And Phone Directory Picker

**Files:**
- Create: `web/src/lib/components/directory/DirectoryPicker.svelte`
- Create: `web/src/lib/components/directory/DirectoryPicker.test.ts`
- Modify: `web/src/lib/components/form/DirectoryInput.svelte`
- Modify: `web/src/lib/config/context.ts`
- Modify: `web/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: Task 11 `api.listDirectories` and Task 13 `DirectoryInput` event.
- Produces: one picker service used by every directory field.

- [ ] **Step 1: Write failing navigation and error tests**

```typescript
import { fireEvent, render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import DirectoryPicker from "./DirectoryPicker.svelte";

it("navigates server directories and selects the current path", async () => {
  const list = vi.fn()
    .mockResolvedValueOnce({ path: "/", parent: null, directories: [{ name: "workspace", path: "/workspace" }], roots: ["/"], truncated: false })
    .mockResolvedValueOnce({ path: "/workspace", parent: "/", directories: [], roots: ["/"], truncated: false });
  const onSelect = vi.fn();
  render(DirectoryPicker, { initialPath: "/", list, onSelect, open: true });
  await fireEvent.click(await screen.findByRole("button", { name: "workspace" }));
  await fireEvent.click(await screen.findByRole("button", { name: "Select /workspace" }));
  expect(onSelect).toHaveBeenCalledWith("/workspace");
});

it("keeps the current path when listing fails", async () => {
  render(DirectoryPicker, { initialPath: "/denied", list: vi.fn().mockRejectedValue({ status: 403, detail: "Directory is not readable" }), onSelect: vi.fn(), open: true });
  expect(await screen.findByText("Directory is not readable")).toBeVisible();
  expect(screen.getByDisplayValue("/denied")).toBeVisible();
});
```

- [ ] **Step 2: Verify picker tests fail**

Run: `bun --cwd web run test -- src/lib/components/directory/DirectoryPicker.test.ts`

Expected: component import fails.

- [ ] **Step 3: Implement one accessible picker with responsive presentation**

The picker owns current canonical path, editable path text, breadcrumbs, roots, children, loading, truncation warning, and local error. Enter navigates typed paths. Child and parent buttons fetch through the directory query. Select updates the config field only when clicked. Escape/Cancel leaves the original value unchanged.

Use `role="dialog"`, `aria-modal`, initial focus on path input, tab focus containment, and trigger focus restoration. CSS renders a centered desktop dialog and a full-screen phone sheet below 768 px.

- [ ] **Step 4: Connect all DirectoryInput controls through layout context**

`DirectoryInput` requests `{path, onSelect}` from context. The root layout renders exactly one picker, sets the selected raw path through `ConfigWorkspace.setRaw`, and closes it. Directory endpoint errors never alter the config draft.

- [ ] **Step 5: Run picker, form, and accessibility tests**

Run: `bun --cwd web run test -- src/lib/components/directory src/lib/components/form && bun --cwd web run check`

Expected: all tests pass and Svelte check reports zero errors.

- [ ] **Step 6: Commit directory UX**

```bash
git add web/src/lib/components/directory web/src/lib/components/form/DirectoryInput.svelte web/src/lib/config/context.ts web/src/routes/+layout.svelte
git commit -m "feat(webui): add server directory picker"
```

---

### Task 16: Add WebSocket Handshake And Virtual Console UI

**Files:**
- Create: `web/src/lib/events/console-store.svelte.ts`
- Create: `web/src/lib/events/console-store.test.ts`
- Create: `web/src/lib/events/client.ts`
- Create: `web/src/lib/events/client.test.ts`
- Create: `web/src/lib/components/console/ConsoleView.svelte`
- Create: `web/src/lib/components/console/ConsoleView.test.ts`
- Modify: `web/src/lib/components/shell/ConsoleDrawer.svelte`
- Create: `web/src/routes/console/+page.svelte`
- Modify: `web/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: Task 10 event contract and Task 14 console drawer.
- Produces: race-free reconnecting console stream shared by drawer and route.

- [ ] **Step 1: Write failing reducer tests**

```typescript
import { expect, it } from "vitest";
import { ConsoleStore } from "./console-store.svelte";

const line = (id: number, text: string, overwrite = false) => ({ id, spans: [{ text, classes: [] }], overwrite });

it("replaces transient lines and deduplicates sequences", () => {
  const store = new ConsoleStore(10000, 4 * 1024 * 1024);
  store.installBacklog({ stream_id: "s", cursor: 1, revision: "i:0", lines: [line(1, "start")], transient: null });
  store.apply({ type: "console", stream_id: "s", seq: 2, t: 1, lines: [line(2, "10%", true)] });
  store.apply({ type: "console", stream_id: "s", seq: 3, t: 2, lines: [line(3, "20%", true)] });
  store.apply({ type: "console", stream_id: "s", seq: 3, t: 2, lines: [line(3, "20%", true)] });
  expect(store.rows.map((row) => row.id)).toEqual([1, 3]);
});

it("requests resync on sequence gap or stream change", () => {
  const store = new ConsoleStore();
  store.installBacklog({ stream_id: "s", cursor: 4, revision: "i:0", lines: [], transient: null });
  expect(store.apply({ type: "console", stream_id: "s", seq: 6, t: 1, lines: [] })).toBe("resync");
  expect(store.apply({ type: "console", stream_id: "new", seq: 1, t: 1, lines: [] })).toBe("restart");
});
```

- [ ] **Step 2: Write failing WebSocket-first handshake test**

Use a fake socket and deferred backlog promise to prove live events queue before the REST snapshot, events at or below the cursor are discarded, and newer queued events apply afterward. Also test capped reconnect delays of 500, 1000, 2000, 4000, 8000, and 10000 ms.

- [ ] **Step 3: Verify event client tests fail**

Run: `bun --cwd web run test -- src/lib/events`

Expected: event modules do not exist.

- [ ] **Step 4: Implement bounded console store and reconnecting client**

`ConsoleStore` tracks stream ID, sequence, committed rows, one transient row, byte count, connection state, gap state, and latest config revision. It enforces the same 10,000/4 MiB limits as the server. `installBacklog` resets state. `apply` ignores duplicates, returns `resync` for sequence gaps, and `restart` for stream changes.

`EventClient.start()` opens WebSocket before calling `api.getBacklog`, queues messages until backlog installation, merges only newer messages, and then applies live events. `resync` fetches backlog while queuing live events. `restart` also invalidates config queries. Close cancels timers and sockets. Use injected socket/timer factories for deterministic tests.

For every normal `config_changed`, call an injected `onConfigChanged(revision)` callback. The root layout invalidates the config query, fetches the new envelope, and passes it to `ConfigWorkspace.acceptRemote`; the workspace decides whether to replace a clean draft or preserve a dirty draft in conflict.

- [ ] **Step 5: Implement fixed-row terminal viewport**

`ConsoleView` uses no wrapping and a constant row height. Compute `start = floor(scrollTop / rowHeight)` and render a buffered window through one spacer with translated rows. Add filter, pause-on-scroll-up, Jump to latest, connection/gap labels, and `/api/console/log` download. Render spans as text nodes with an allowlisted class array.

The drawer and full route receive the same singleton store. Persist drawer open state and height; provide touch-safe resize behavior and a full-page link.

- [ ] **Step 6: Run event and console component tests**

Run: `bun --cwd web run test -- src/lib/events src/lib/components/console && bun --cwd web run check && bun --cwd web run build`

Expected: all tests pass, zero Svelte errors, and production build completes.

- [ ] **Step 7: Commit console frontend**

```bash
git add web/src/lib/events web/src/lib/components/console web/src/lib/components/shell/ConsoleDrawer.svelte web/src/routes/console web/src/routes/+layout.svelte
git commit -m "feat(webui): stream console to browser"
```

---

### Task 17: Add Web Entry Point, Build Stamps, And Platform Launchers

**Files:**
- Create: `scripts/train_ui_web.py`
- Create: `scripts/webui_build.py`
- Create: `start-web-ui.sh`
- Create: `start-web-ui.bat`
- Modify: `LAUNCH-SCRIPTS.md`
- Create: `tests/webui/test_webui_build.py`
- Create: `tests/webui/test_train_ui_web.py`

**Interfaces:**
- Consumes: Task 8 `ConsoleCapture`, Task 10 `create_app`, and Task 11 Bun project.
- Produces: complete user launch path and deterministic stale-build detection.

- [ ] **Step 1: Write failing deterministic source-digest tests**

```python
from pathlib import Path

from scripts.webui_build import build_digest, build_is_current


def test_build_digest_changes_only_for_build_inputs(tmp_path):
    web = tmp_path / "web"
    (web / "src").mkdir(parents=True)
    (web / "src" / "app.ts").write_text("one", encoding="utf-8")
    (web / "package.json").write_text("{}", encoding="utf-8")
    first = build_digest(web)
    (web / "ignored.log").write_text("noise", encoding="utf-8")
    assert build_digest(web) == first
    (web / "src" / "app.ts").write_text("two", encoding="utf-8")
    assert build_digest(web) != first


def test_build_requires_index_and_matching_stamp(tmp_path):
    web = tmp_path / "web"
    (web / "src").mkdir(parents=True)
    (web / "src" / "app.ts").write_text("one", encoding="utf-8")
    (web / "package.json").write_text("{}", encoding="utf-8")
    assert build_is_current(web) is False
    (web / "build").mkdir()
    (web / "build" / "index.html").write_text("ok", encoding="utf-8")
    (web / ".build-source").write_text(build_digest(web), encoding="utf-8")
    assert build_is_current(web) is True
```

- [ ] **Step 2: Write failing argument and production-build tests**

```python
import pytest

from scripts.train_ui_web import exposure_warning, make_settings, parse_args, validate_static_build


def test_web_entry_defaults_to_loopback_7801():
    args = parse_args([])
    assert (args.host, args.port, args.dev) == ("127.0.0.1", 7801, False)


def test_production_requires_build_but_dev_does_not(tmp_path):
    settings = make_settings(tmp_path, dev=False)
    with pytest.raises(SystemExit, match="Frontend build is missing"):
        validate_static_build(settings)
    validate_static_build(make_settings(tmp_path, dev=True))


def test_network_exposure_warning_is_explicit():
    assert exposure_warning("127.0.0.1") is None
    assert exposure_warning("0.0.0.0") == "Web UI has no authentication and is exposed to the network"
```

- [ ] **Step 3: Verify launcher helper tests fail**

Run: `python -m pytest tests/webui/test_webui_build.py tests/webui/test_train_ui_web.py -v`

Expected: imports fail because both scripts are absent.

- [ ] **Step 4: Implement deterministic build helper and entry point**

`build_digest(web_dir)` hashes relative paths and bytes for `src/**`, `package.json`, `bun.lock`, `svelte.config.js`, `vite.config.ts`, and `tsconfig.json` in sorted order. `build_is_current` requires `build/index.html` and exact `.build-source`. `mark_build_current` writes the digest atomically after a successful build. CLI `--check` exits 0 only for a current build and exits 1 for missing/stale output; `--mark` writes the stamp and exits 0.

`train_ui_web.py` calls `script_imports(allow_zluda=False)`, parses `--host`, `--port`, and `--dev`, refuses missing production build, prints non-loopback warning, installs `ConsoleCapture`, creates `WebUISettings` from the repository root, constructs the app, and calls `uvicorn.run`. Always close capture in `finally`.

- [ ] **Step 5: Implement launchers following existing runtime conventions**

`start-web-ui.sh` sources `lib.include.sh`, calls `prepare_runtime_environment`, checks `python -c "import fastapi, uvicorn"`, checks `bun`, invokes `scripts/webui_build.py --check`, and when stale runs `bun --cwd web install --frozen-lockfile`, `bun --cwd web run build`, and `scripts/webui_build.py --mark`. Then call `run_python_in_active_env scripts/train_ui_web.py "$@"`.

`start-web-ui.bat` follows `start-ui.bat` environment activation and version checks, adds `where bun`, Python import checks, stale build handling, forwards `%*`, and returns the child exit code without hiding it.

Both missing-dependency messages contain these exact commands:

```text
python -m pip install -r requirements-webui.txt
bun --cwd web install --frozen-lockfile
```

- [ ] **Step 6: Document optional installation and usage**

Add a Web UI section to `LAUNCH-SCRIPTS.md` covering optional Python dependencies, Bun requirement, first-build behavior, default URL, `--host 0.0.0.0` warning, `--port`, and two-terminal dev commands.

- [ ] **Step 7: Run launcher-focused verification**

Run: `python -m pytest tests/webui/test_webui_build.py tests/webui/test_train_ui_web.py -v`

Expected: all tests pass.

Run: `bash -n start-web-ui.sh && python scripts/train_ui_web.py --help`

Expected: shell syntax passes and help lists host, port, and dev options.

- [ ] **Step 8: Commit launch path**

```bash
git add scripts/train_ui_web.py scripts/webui_build.py start-web-ui.sh start-web-ui.bat LAUNCH-SCRIPTS.md tests/webui/test_webui_build.py tests/webui/test_train_ui_web.py
git commit -m "feat(webui): add production launchers"
```

---

### Task 18: Add End-To-End Browser Coverage And Final Documentation

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/e2e/phase-a.spec.ts`
- Create: `web/e2e/mobile.spec.ts`
- Create: `web/e2e/console.spec.ts`
- Create: `web/e2e/firefox-smoke.spec.ts`
- Create: `tests/webui/e2e_server.py`
- Modify: `README.md`
- Modify: `docs/WebUiDesign.md`

**Interfaces:**
- Consumes: complete backend, frontend, and launch path from Tasks 1-17.
- Produces: executable Phase A acceptance gate and user-facing entry points.

- [ ] **Step 1: Create isolated E2E server fixture**

`tests/webui/e2e_server.py` accepts `--root`, resolves and changes into that temporary root, builds `WebUISettings` entirely there except for the generated repository `web/build`, seeds a default config and two directories, installs `ConsoleCapture`, prints known CR-progress output after startup, and runs Uvicorn on an injected free port. It never reads or writes the developer's real presets, secrets, or workspace.

- [ ] **Step 2: Configure Playwright projects and backend lifecycle**

Define projects:

```typescript
projects: [
  { name: "chromium-desktop", testMatch: /phase-a|console/, use: Object.assign({}, devices["Desktop Chrome"]) },
  { name: "webkit-phone", testMatch: /mobile/, use: Object.assign({}, devices["iPhone 13"]) },
  { name: "firefox-smoke", testMatch: /firefox-smoke/, use: Object.assign({}, devices["Desktop Firefox"]) },
]
```

Use `webServer.command = "python ../tests/webui/e2e_server.py --root .e2e --port 7801"`, `url = "http://127.0.0.1:7801/api/health"`, and `reuseExistingServer = false`. Capture traces only on first retry; do not commit screenshots, traces, reports, or test results.

- [ ] **Step 3: Write desktop Phase A flows**

In `phase-a.spec.ts`, test:

1. Root redirects to General and loads Graphite and Ember shell.
2. Compact rail expands, persists after reload, and future links remain disabled.
3. Valid workspace edit reaches Saved and survives reload.
4. Invalid numeric text remains visible and Unsaved.
5. Two browser contexts edit from one revision; the second sees conflict, reload works, and a second conflict can occur before explicit overwrite.
6. Pending autosave flushes before named-preset save.
7. General, Data, and Backup are deep-linkable and browser back/forward works.

- [ ] **Step 4: Write complete phone editing flows**

In `mobile.spec.ts`, test the off-canvas rail, one-column forms, model/method/preset header wrapping, full-screen directory picker, directory selection, autosave, conflict controls, console drawer, safe-area status, 44 px target boxes, focus trap, Escape, and trigger focus restoration.

- [ ] **Step 5: Write console connection flows**

In `console.spec.ts`, assert stdout and stderr lines appear, CR progress ends as one `20%` row rather than two committed rows, scrolling pauses follow mode, Jump to latest resumes it, filtering works, full page and drawer share rows, socket interruption shows disconnected state, and reconnect restores backlog without duplicates.

In `firefox-smoke.spec.ts`, assert boot, General/Data/Backup navigation, one saved edit, console visibility, and keyboard focus order.

- [ ] **Step 6: Run the complete automated gate**

Run:

```bash
python -m pytest tests/webui -v
ruff check modules/webui modules/util/config/config_io.py modules/ui/TopBarController.py scripts/train_ui_web.py scripts/webui_build.py tests/webui
bun --cwd web run test
bun --cwd web run check
bun --cwd web run build
bun --cwd web run e2e
git diff --check
```

Expected: all Python tests pass, Ruff reports no errors, all Vitest tests pass, Svelte check reports zero errors and warnings, Vite builds, all three Playwright projects pass their assigned flows, and Git reports no whitespace errors.

- [ ] **Step 7: Perform platform smoke checks**

On Linux, run `./start-web-ui.sh --port 7802`, verify `GET http://127.0.0.1:7802/api/health`, edit one field, observe terminal/browser console tee, and stop cleanly.

On Windows, run `start-web-ui.bat --port 7802` and perform the same health, edit, console, and shutdown checks. Record exact commands and outcomes in the implementation handoff; do not claim Windows verification from a non-Windows run.

- [ ] **Step 8: Update user-facing docs after acceptance passes**

Add a concise README Web UI section linking `LAUNCH-SCRIPTS.md`. Change `docs/WebUiDesign.md` Phase A status from unimplemented roadmap text to a link to the approved Phase A spec and summarize the implemented boundary without changing later phases.

- [ ] **Step 9: Commit acceptance coverage and docs**

```bash
git add web/playwright.config.ts web/e2e tests/webui/e2e_server.py README.md docs/WebUiDesign.md
git commit -m "test(webui): cover Phase A browser flows"
```

---

## Final Acceptance Checklist

- [ ] General, Data, and Backup expose every approved native config-bound field and native tooltip.
- [ ] Valid edits persist atomically; malformed drafts never reach canonical state.
- [ ] Revision conflicts preserve local work and require explicit reload or exact-revision overwrite.
- [ ] Presets cannot escape the preset root and preserve server secrets.
- [ ] Directory browsing returns server directories only and works as a phone sheet.
- [ ] Console capture tees merged fd 1/2 output, handles CR/LF/ANSI safely, and closes without deadlock.
- [ ] Event ordering survives refresh, socket loss, dropped batches, and server restart.
- [ ] All histories, queues, request bodies, directory results, and log files respect documented limits.
- [ ] Production builds are local, ignored, deterministic, and rebuilt only when stale.
- [ ] Production defaults to loopback port 7801 and warns clearly on network exposure.
- [ ] Desktop and phone browser flows pass; Windows status is reported from actual Windows evidence only.
- [ ] No trainer lifecycle endpoint or trainer/model/data-loader modification entered the diff.
