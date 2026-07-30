# Web UI as a Pure Add-On — Restructure Design

Date: 2026-07-30
Status: Approved
Scope: Restructure the `feat/svelte-web-ui` branch so the Web UI is a pure add-on, then open an upstream PR against `Nerogar/OneTrainer`.

---

## 1. Goal

Present the browser-based Web UI to OneTrainer maintainers as an additive feature that modifies **no existing Python file**. The current branch changes six core Python files and adds a seventh under `modules/util/`; all seven are removed here, with equivalent behaviour relocated into `modules/webui/`.

Success criteria:

1. `git diff master...<pr-branch> -- '*.py'` contains **only additions of new files**. No modified Python.
2. Exactly three pre-existing files are modified, all additively: `.gitignore`, `README.md`, `LAUNCH-SCRIPTS.md`.
3. `pytest modules/webui/tests` passes in the repo's OneTrainer venv.
4. `bun run check && bun run test && bun run build` passes.
5. `playwright test` passes on a clean checkout on any platform.
6. No agent tooling, internal planning docs, or CI config ships in the PR.

## 2. Branch strategy

`feat/svelte-web-ui` is retained unchanged as the working record — it keeps `docs/superpowers/`, `.github/workflows/web.yml`, and the visual-regression snapshots.

A new branch `feat/web-ui-upstream` is cut from it. All restructuring happens there, and the PR is opened from it. Nothing is lost; the PR branch contains only the add-on.

## 3. Core reverts

Seven core touches are removed. Each has a designated replacement.

| File | Action | Replacement |
|---|---|---|
| `modules/util/concept_stats.py` | full revert to master | none required |
| `modules/util/config/TrainConfig.py` | full revert (drops `datasets_dir`) | `modules/webui/settings_store.py` |
| `modules/util/config/SecretsConfig.py` | full revert (drops `webui_password`) | `modules/webui/settings_store.py` |
| `modules/ui/TopBarController.py` | full revert to master | `modules/webui/config_io.py` |
| `modules/modelSampler/BaseModelSampler.py` | full revert to master | `modules/webui/runtime_patches.py` |
| `modules/trainer/GenericTrainer.py` | full revert to master | `modules/webui/runtime_patches.py` |
| `modules/util/config/config_io.py` | delete (moved) | `modules/webui/config_io.py` |

### 3.1 Rationale: `concept_stats.py`

The branch made `mgds`, `cv2`, and `imagesize` optional imports with a hardcoded `ALL_ASPECTS` fallback. All three are pinned hard dependencies in upstream `requirements-global.txt` (`opencv-python==4.11.0.86`, `imagesize==1.4.1`, `mgds` from git), so they are never absent in a real install.

Root cause: the change was authored from `/home/khoifish/GST/gst-venv`, which lacks `mgds` and `imagesize`. The repo's own `./venv` has all three. The change papered over a wrong-venv mistake by degrading shared core code.

The fallback is also incorrect, not merely redundant: it lists 11 aspect ratios where `AspectBucketing.all_possible_input_aspects` has 9, silently altering concept statistics.

Full revert. No conftest stubs and no lazy import: a light test environment is impossible anyway, because `TrainConfig` transitively imports `torch` via `accelerate`, and it is unnecessary, because the real test environment is a normal OneTrainer install.

### 3.2 Rationale: `datasets_dir` and `webui_password`

Both are Web-UI-only values living in shared core config classes. `datasets_dir` additionally changes the serialized config schema shared with the native UI.

`webui_password` cannot ride along in `secrets.json` as an undeclared key: the native UI's `save_secrets` writes `config.secrets.to_dict()`, which would silently drop it on the next native save.

Both move to a single Web-UI-owned store.

**Compatibility (verified):** `TrainConfig.from_dict` tolerates unknown keys. Existing web-saved `config.json` files containing `datasets_dir` load without error after the revert. No migration is required.

## 4. New modules

### 4.1 `modules/webui/config_io.py`

The existing `modules/util/config/config_io.py` moved verbatim (`git mv`). Contents unchanged. Only the import path changes.

Call sites to update (6 source + 1 harness):

- `modules/webui/config_service.py`
- `modules/webui/presets.py`
- `modules/webui/routers/config.py`
- `modules/webui/routers/secrets.py`
- `modules/webui/tests/test_config_io.py`
- `modules/webui/tests/test_config_codec.py`
- `modules/webui/tests/e2e_server.py`

`modules/ui/TopBarController.py` reverts to its master implementation, reintroducing ~40 lines that `config_io` had deduplicated. This duplication is accepted deliberately. The PR description offers the dedup refactor as a follow-up if maintainers want it.

### 4.2 `modules/webui/settings_store.py`

Owns `webui.json`, resolved as `WebUISettings.root_dir / "webui.json"` — in normal operation the repo root, alongside the already-gitignored `config.json` and `secrets.json`.

```json
{
  "datasets_dir": "training_datasets",
  "password": { "salt": "<hex>", "hash": "<scrypt hex>" }
}
```

`password` is `null` when unset.

Exposed as a **`SettingsStore` class constructed with its file path**, instantiated in `create_app()` and held on `AppState` as `app_state.settings_store` — matching the existing service pattern (`config_service`, `media_service`, …). Module-level functions with a global path are explicitly rejected: tests construct `WebUISettings(root_dir=tmp_path)`, and a global path would break that isolation.

Public API:

- `get_datasets_dir() -> str`
- `set_datasets_dir(path: str) -> None`
- `has_password() -> bool`
- `set_password(plaintext: str) -> None` — empty string clears
- `verify_password(plaintext: str) -> bool`

Implementation constraints:

- Hashing via `hashlib.scrypt`; comparison via `secrets.compare_digest`. Stdlib only, no new dependency.
- Writes are atomic via the existing `modules/webui/atomic_io.write_json_atomic`.
- The file is `chmod 600` on write, since it holds a credential hash.
- A missing or malformed file yields defaults rather than raising.

### 4.3 `modules/webui/runtime_patches.py`

A single idempotent entry point, called from `create_app()`:

```python
_installed = False

def install_runtime_patches() -> None:
    global _installed
    if _installed:
        return
    _patch_sampler_output()
    _patch_summary_writer()
    _installed = True
```

**`_patch_sampler_output()`** wraps `BaseModelSampler.save_sampler_output`. Verified properties that make this seam safe:

- It is the single point through which all 18 concrete samplers write output.
- Every sampler calls it *before* `on_sample(sampler_output)`, so `filepath` is populated by the time the Web UI callback runs.
- It is a `@staticmethod`; the replacement must be re-wrapped with `staticmethod()` when assigned.

The wrapper calls the original, then recomputes `destination + <format>.extension()` and assigns `sampler_output.filepath` for `FileType.IMAGE` and `FileType.VIDEO`. No `hasattr` guards: `image_format` and `video_format` are always the corresponding enums.

**`_patch_summary_writer()`** installs one metrics patch keyed off the module-level `_active_training_service`, replacing both existing patches.

**Bug fixed by this consolidation.** `modules/webui/training.py` currently patches `SummaryWriter.add_scalar` twice with functionally identical wrappers: once at module level (`_global_add_scalar`, line 49) and once per training run (`custom_add_scalar`, line 428). Both call `record_metric`, and neither is restored. The per-run patch captures the previous wrapper as its original, so run N produces N+1 recorded points per scalar — duplicate points on the training chart, growing per session. Both are deleted and replaced by the single idempotent patch.

Neither patch needs restoration: both are inert when no training run is active.

## 5. Wiring changes

| Location | Change |
|---|---|
| `modules/webui/routers/datasets.py` | Read the base directory from `app_state.settings_store` instead of `getattr(config, "datasets_dir", …)`. Fold the duplicated read in `list_datasets` into `get_base_datasets_dir`. Add `PUT /api/datasets/base-dir`. |
| `modules/webui/config_codec.py` | Delete the `datasets_dir` back-fill (lines 158–159). |
| `modules/webui/routers/auth.py` | Use `app_state.settings_store.has_password()` / `.verify_password()`. Replace the `!=` comparison. |
| `modules/webui/routers/secrets.py` | Route password read/write through `app_state.settings_store`. The response shape (`webui_password_set`) is unchanged. |
| `modules/webui/state.py` | Add the `settings_store` field to `AppState`. |
| `modules/webui/app.py` | Construct `SettingsStore(settings.root_dir / "webui.json")` and call `install_runtime_patches()` in `create_app()`. |
| `modules/webui/training.py` | Delete both `SummaryWriter` patches. |
| `web/src/routes/(app)/datasets/+page.svelte` | Read `base_dir` from the datasets query (already the current fallback). Replace `ctx.workspace.setRaw('datasets_dir', …)` + `flush()` with a call to `PUT /api/datasets/base-dir` followed by query invalidation. |
| `modules/webui/schema/registry.py` | **Unchanged.** |

### 5.1 Rationale: keeping the `TopBarController` import

`registry.py` imports `TopBarController` for `get_model_types()` and `get_training_methods()`. This import is retained deliberately:

- It is PySide-free, and `modules/ui` has no `__init__.py`, so there are no package import side effects.
- `get_model_types()` is a **curated subset** — 26 of 33 `ModelType` members; the 7 excluded include `LORA`, `LOHA`, `OFT_2`, `LOKR`, which are not model types. Generating the list from the enum would surface invalid entries.
- A local copy would drift **silently** whenever upstream adds a model: the Web UI would quietly lack it.
- Keeping the import means new upstream models appear in the Web UI automatically, at zero maintainer cost, and an upstream rename fails **loudly** at startup.

Importing a module changes nothing in it, so this does not violate the no-core-changes constraint.

## 6. Tests

`tests/webui/` moves to `modules/webui/tests/`, making the add-on removable as a single directory. Upstream has no test files, so either location is conflict-free; the in-package location avoids implying a repo-wide testing convention.

No `conftest.py` and no dependency stubs.

Changes required:

- Update `config_io` import paths (§4.1).
- Remove `datasets_dir` assertions: `test_schema.py:229`, `test_schema_coverage.py:5`, `test_datasets_router.py:181–193`.
- Rewrite `test_secrets_api.py:58`, which asserts the plaintext password is readable from disk, to assert hash verification instead.
- Update `e2e_server.py`'s import.

New tests:

- `settings_store`: round-trip, defaults on missing/malformed file, password set/verify/clear, file permissions.
- `runtime_patches`: `filepath` is set for image and video; `install_runtime_patches()` is idempotent; metrics register exactly once across two simulated runs (regression test for the duplicate-metrics bug); the `save_sampler_output` signature matches what the patch expects.

Running the suite requires the OneTrainer venv, since `TrainConfig` pulls `torch`:

```
./venv/bin/pip install -r requirements-webui-dev.txt
./venv/bin/pytest modules/webui/tests
```

`pyproject.toml` is **not** modified. The command is documented in `modules/webui/README.md`.

## 7. Removals

| Path | Reason |
|---|---|
| `.github/workflows/web.yml` | Never ran pytest; its Playwright `webServer` needs torch that CI never installed. No CI config ships. |
| `.superpowers/` | Agent tooling. |
| `.github/hooks/` | Agent tooling (currently untracked). |
| `docs/superpowers/` | 52 internal planning docs, 1.2 MB. Retained on `feat/svelte-web-ui`. |
| `docs/WebUiDesign.md` | Superseded by §8. |
| `web/e2e/visual.spec.ts` + `visual.spec.ts-snapshots/` | 17 chromium-on-Linux PNGs (456 KB) that fail on other platforms. Retained on `feat/svelte-web-ui`. |

Removing the visual spec also requires deleting the `visual` token from **both** `testMatch` regexes in `web/playwright.config.ts` (lines 25 and 39).

`.gitignore`: drop `.superpowers` and `.impeccable`; add `webui.json`; keep the web build/test entries.

## 8. Documentation

- **`docs/WebUi.md`** (new) — user-facing: what the Web UI is, launching on each platform, port and host options, the network-exposure warning. Matches the style of upstream's nine topic-named docs.
- **`modules/webui/README.md`** (new) — developer-facing: architecture, the schema layer, the runtime patches and why they exist, the settings store, and how to run the Python and Playwright suites locally.
- **`README.md`** — the existing Web UI section links `docs/WebUi.md`. Remove the "Phase A implementation" wording.
- **`LAUNCH-SCRIPTS.md`** — existing Web UI section retained.

## 9. Separate upstream bug-fix PR

Independent of the Web UI, on its own branch off `master`:

`modules/util/concept_stats.py` line 188 calls `cv2.VideoCapture(path)` where `path` is an `os.DirEntry` from `os.scandir` (line 104). Two lines above, the same loop correctly uses `imagesize.get(path.path)`. The fix is `cv2.VideoCapture(path.path)`. It fires whenever advanced checks run over a concept containing video.

Submitted as a standalone one-line fix so it does not complicate the Web UI PR.

## 10. Known limitations

- **Cloud training gallery.** `ModelSamplerOutput.__reduce__` reconstructs with only `(file_type, data)`, so a dynamically-set `filepath` does not survive pickling to a cloud worker. The gallery will not receive sample paths for cloud runs. This is not a regression: the original core-diff approach, which set `filepath` in `__init__`, had the identical gap.
- **Patch coupling.** `_patch_sampler_output` depends on the signature of `save_sampler_output`. If upstream changes it, the patch breaks. Mitigated by the signature test in §6.
- **Accepted duplication.** ~40 lines of config I/O exist in both `TopBarController` and `modules/webui/config_io.py`.

## 11. Verification

1. `git diff master...feat/web-ui-upstream --stat -- '*.py'` shows only new files.
2. `git diff master...feat/web-ui-upstream --name-status` lists exactly three modified pre-existing files: `.gitignore`, `README.md`, `LAUNCH-SCRIPTS.md`.
3. `./venv/bin/pytest modules/webui/tests` passes.
4. `cd web && bun run check && bun run test && bun run build` passes.
5. `cd web && bunx playwright test` passes on a clean checkout.
6. Manual smoke test: start a training run; confirm a sample appears in the gallery, and that each metric point is plotted exactly once. Repeat with a second run in the same session to confirm the duplicate-metrics fix.
7. Load a `config.json` saved by the pre-restructure Web UI (containing `datasets_dir`) and confirm it loads without error.

## 12. Out of scope

- Auth hardening beyond password hashing (`_ACTIVE_TOKENS` remains an unbounded module-level set with no expiry).
- Any refactor of core OneTrainer code, including the `TopBarController` dedup.
- Frontend feature work.
