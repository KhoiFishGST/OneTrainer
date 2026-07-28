# Web UI Sample Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent Web UI-only sample gallery with exact per-batch prompt revisions, progressive Live updates, historical run browsing, EMA variants, and same-prompt timeline navigation.

**Architecture:** A synchronous `GalleryService` mirrors already-saved core images and persists versioned manifests, while a thread-safe `SamplingCoordinator` freezes prompt revisions at the existing sampling status callback and durably queues mid-batch edits. FastAPI exposes validated gallery models and immutable image files; Svelte Query owns server state, and one shared gallery plus viewer serves both `/gallery` and `/live`.

**Tech Stack:** Python 3.10+, FastAPI, Pillow, pytest, Svelte 5, TypeScript, TanStack Svelte Query 5, Vitest/jsdom, Bun.

## Global Constraints

- Modify only `modules/webui`, `web/src`, `tests/webui`, and Web UI tests; do not modify OneTrainer core source.
- Do not move, rename, rewrite, or delete files under core `<workspace>/samples` or `<workspace>/config`.
- Remove only the Web UI's generated-image writes to `training_samples`; retain `training_samples/samples.json` as a supported prompt-definition source.
- Gallery runs cover only training started through this Web UI; do not import native UI, CLI, cloud, or pre-existing history.
- Persist gallery data at `<workspace>/web/samples/<exact-core-config-stem>` and disable persistence when that exact key is ambiguous or collides with an existing different run.
- Support browser-displayable still images only; leave video and audio output untouched.
- Copy full-size source bytes exactly and create separate bounded WebP thumbnails.
- Treat `webui_id` as stable prompt identity; edits preserve it, while add/clone operations receive new IDs.
- Label a seed `Random` only when the normalized prompt has `random_seed: true`; preserve numeric `-1` as `-1` because core does not randomize on that value alone.
- Gallery persistence is best-effort and must never abort, pause, or fail training.
- Use atomic sibling temporary files and per-run/thread locks for persistent state.
- Keep all new code and edited files ASCII.

---

## File Structure

### Backend Files

- Create `modules/webui/atomic_io.py`: hardened atomic JSON, exact file-copy, and Pillow-save helpers.
- Create `modules/webui/gallery.py`: gallery schemas, active-run lifecycle, revision/batch persistence, mirroring, historical reads, and safe image lookup.
- Create `modules/webui/sampling_coordinator.py`: stable prompt IDs, prompt-file locking, queued edits, pending recovery, and sampling transitions.
- Create `modules/webui/routers/gallery.py`: run-list, current-run, historical-run, and immutable-image endpoints.
- Modify `modules/webui/config_service.py`: expose the resolved current prompt-definition path.
- Modify `modules/webui/training.py`: wire status/sample callbacks, progress snapshots, and cleanup; remove duplicate image saving.
- Modify `modules/webui/events.py`: add `gallery_warning` event type.
- Modify `modules/webui/state.py`: expose gallery and sampling services.
- Modify `modules/webui/app.py`: construct services in dependency order and register the router.
- Modify `modules/webui/routers/samples.py`: validate and delegate prompt reads/writes to the coordinator.

### Backend Tests

- Create `tests/webui/test_atomic_io.py`.
- Create `tests/webui/test_gallery_service.py`.
- Create `tests/webui/test_sampling_coordinator.py`.
- Create `tests/webui/test_gallery_router.py`.
- Modify `tests/webui/test_training_service.py`.
- Modify `tests/webui/test_training_events.py`.
- Modify `tests/webui/test_samples_router.py`.

### Frontend Files

- Modify `web/src/lib/api/types.ts`: typed gallery, prompt-definition, and warning contracts.
- Modify `web/src/lib/api/client.ts`: gallery API methods and image URL builder.
- Modify `web/src/lib/api/queries.ts`: gallery query keys/factories and queued prompt responses.
- Modify `web/src/lib/events/client.ts`: gallery invalidation and warning callbacks.
- Modify `web/src/lib/components/LayoutContent.svelte`: invalidate gallery queries and show global gallery warnings.
- Create `web/src/lib/components/LayoutContent.test.ts`: verify progressive invalidation and warning display.
- Modify `web/src/lib/components/ui/ModalDialog.svelte`: wide/footerless mode and delegated non-modal key handling.
- Create `web/src/lib/components/training/GalleryImageViewer.svelte`: same-prompt/variant timeline modal.
- Replace `web/src/lib/components/training/SampleGallery.svelte`: checkpoint and variant renderer.
- Create `web/src/routes/gallery/+page.svelte`: historical/current gallery route with exact run-key selector.
- Modify `web/src/routes/live/+page.svelte`: use the current gallery query and shared component.
- Modify `web/src/routes/sampling/+page.svelte`: queued feedback and clone-ID removal.
- Modify `web/src/lib/components/shell/Rail.svelte`: add Gallery directly below Live.

### Frontend Tests

- Modify `web/src/lib/api/client.test.ts`.
- Modify `web/src/lib/events/client.test.ts`.
- Modify `web/src/lib/components/ui/ModalDialog.test.ts`.
- Create `web/src/lib/components/training/GalleryImageViewer.test.ts`.
- Replace `web/src/lib/components/training/SampleGallery.test.ts`.
- Create `web/src/routes/gallery/page.test.ts`.
- Modify `web/src/routes/live/page.test.ts`.
- Modify `web/src/routes/sampling/SamplingPage.test.ts`.
- Modify `web/src/lib/components/shell/Rail.test.ts`.

---

### Task 1: Atomic Web UI Persistence

**Files:**
- Create: `modules/webui/atomic_io.py`
- Create: `tests/webui/test_atomic_io.py`

**Interfaces:**
- Produces: `write_json_atomic(path: Path, value: object) -> None`
- Produces: `copy_file_atomic(source: Path, destination: Path) -> str`
- Produces: `save_pil_atomic(image: Image.Image, destination: Path, *, image_format: str, save_kwargs: Mapping[str, Any] | None = None) -> str`
- The returned strings are lowercase SHA-256 hex digests used as immutable ETags in Task 3.

- [ ] **Step 1: Write failing atomic persistence tests**

```python
from pathlib import Path

from PIL import Image

from modules.webui.atomic_io import copy_file_atomic, save_pil_atomic, write_json_atomic


def test_write_json_atomic_replaces_document_without_temp_file(tmp_path: Path):
    target = tmp_path / "manifest.json"
    write_json_atomic(target, {"schema_version": 1, "batches": []})
    assert target.read_text(encoding="utf-8") == '{\n  "schema_version": 1,\n  "batches": []\n}\n'
    assert list(tmp_path.glob(f".{target.name}.*.tmp")) == []


def test_copy_file_atomic_preserves_exact_bytes_and_returns_digest(tmp_path: Path):
    source = tmp_path / "source.png"
    destination = tmp_path / "gallery" / "sample.png"
    payload = b"exact-source-bytes"
    source.write_bytes(payload)
    digest = copy_file_atomic(source, destination)
    assert destination.read_bytes() == payload
    assert digest == "9ff7796a53bf4c7c273a1698c57be23ac81d97653a2421343eb4182f9525c3b1"


def test_save_pil_atomic_writes_webp_and_cleans_temp_file(tmp_path: Path):
    destination = tmp_path / "thumb.webp"
    digest = save_pil_atomic(Image.new("RGB", (16, 8), "red"), destination, image_format="WEBP")
    with Image.open(destination) as saved:
        assert saved.size == (16, 8)
        assert saved.format == "WEBP"
    assert len(digest) == 64
    assert list(tmp_path.glob(f".{destination.name}.*.tmp")) == []
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_atomic_io.py -v`

Expected: collection fails with `ModuleNotFoundError: No module named 'modules.webui.atomic_io'`.

- [ ] **Step 3: Implement hardened atomic helpers**

```python
import hashlib
import json
import os
import shutil
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from PIL import Image


def _temporary_path(destination: Path) -> tuple[int, Path]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    return tempfile.mkstemp(prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent)


def write_json_atomic(path: Path, value: object) -> None:
    fd, temporary = _temporary_path(path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump(value, file, indent=2, ensure_ascii=True)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def copy_file_atomic(source: Path, destination: Path) -> str:
    fd, temporary = _temporary_path(destination)
    digest = hashlib.sha256()
    try:
        with source.open("rb") as source_file, os.fdopen(fd, "wb") as destination_file:
            while chunk := source_file.read(1024 * 1024):
                destination_file.write(chunk)
                digest.update(chunk)
            destination_file.flush()
            os.fsync(destination_file.fileno())
        shutil.copymode(source, temporary)
        os.replace(temporary, destination)
        return digest.hexdigest()
    finally:
        temporary.unlink(missing_ok=True)


def save_pil_atomic(
    image: Image.Image,
    destination: Path,
    *,
    image_format: str,
    save_kwargs: Mapping[str, Any] | None = None,
) -> str:
    fd, temporary = _temporary_path(destination)
    os.close(fd)
    try:
        image.save(temporary, format=image_format, **dict(save_kwargs or {}))
        with temporary.open("rb+") as file:
            file.flush()
            os.fsync(file.fileno())
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        os.replace(temporary, destination)
        return digest
    finally:
        temporary.unlink(missing_ok=True)
```

- [ ] **Step 4: Run focused tests and lint**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_atomic_io.py -v && python -m ruff check modules/webui/atomic_io.py tests/webui/test_atomic_io.py`

Expected: 3 tests pass and Ruff reports no errors.

- [ ] **Step 5: Commit the atomic persistence unit**

```bash
git add modules/webui/atomic_io.py tests/webui/test_atomic_io.py
git commit -m "feat(webui): add atomic gallery persistence helpers"
```

---

### Task 2: Gallery Run, Revision, And Batch Lifecycle

**Files:**
- Create: `modules/webui/gallery.py`
- Create: `tests/webui/test_gallery_service.py`

**Interfaces:**
- Consumes: atomic helpers from Task 1.
- Produces: `TrainingProgressSnapshot(epoch: int, epoch_step: int, global_step: int)`.
- Produces: `GalleryService.begin_training(config: TrainConfig, *, started_at: datetime | None = None) -> None`.
- Produces: `GalleryService.begin_batch(definitions: list[dict[str, Any]], config: TrainConfig, progress: TrainingProgressSnapshot) -> int | None`.
- Produces: `GalleryService.finish_batch() -> None` and `GalleryService.finish_training() -> None`.
- Produces read-only `GalleryService.active_run_key -> str | None` and `GalleryService.active_run_dir -> Path | None` properties.
- Produces persisted `schema_version: 1` prompt and manifest documents.

- [ ] **Step 1: Write failing lifecycle tests**

Create fixtures that use `TrainConfig.default_values()`, an absolute `tmp_path / "workspace"`, and config files written after `begin_training`. Add these tests:

```python
def test_resolves_new_core_config_using_exact_stem(gallery, train_config, workspace):
    gallery.begin_training(train_config)
    config_file = workspace / "config" / "prefix-2026-07-26_11-17-26.json"
    config_file.parent.mkdir(parents=True)
    config_file.write_text("{}", encoding="utf-8")
    batch_id = gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert batch_id == 1
    assert (workspace / "web" / "samples" / config_file.stem / "manifest.json").exists()


def test_reuses_canonical_prompt_revision(gallery, train_config, core_config):
    gallery.begin_training(train_config)
    core_config()
    definitions = [sample_definition("prompt_a", unknown_setting="kept")]
    gallery.begin_batch(definitions, train_config, progress(step=0))
    gallery.finish_batch()
    gallery.begin_batch(definitions, train_config, progress(step=100))
    prompts = read_prompts(gallery)
    manifest = read_manifest(gallery)
    assert len(prompts["revisions"]) == 1
    assert manifest["batches"][0]["prompt_revision_id"] == manifest["batches"][1]["prompt_revision_id"]
    assert next(iter(prompts["revisions"].values()))["prompts"][0]["unknown_setting"] == "kept"


def test_repeated_same_step_sampling_creates_distinct_batches(gallery, train_config, core_config):
    gallery.begin_training(train_config)
    core_config()
    first = gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=100))
    gallery.finish_batch()
    second = gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=100))
    assert (first, second) == (1, 2)


def test_expected_variants_follow_active_ema_config(gallery, train_config, core_config):
    train_config.ema = EMAMode.OFF
    gallery.begin_training(train_config)
    core_config()
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert read_manifest(gallery)["batches"][0]["expected_variants"] == ["base"]
```

Cover the remaining lifecycle rules with concrete assertions:

```python
def test_resolves_custom_prefix(gallery, train_config, workspace):
    train_config.save_filename_prefix = "portrait-"
    gallery.begin_training(train_config)
    write_core_config(workspace, "portrait-2026-07-26_11-17-26.json")
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert gallery.active_run_key == "portrait-2026-07-26_11-17-26"


def test_disables_missing_or_ambiguous_config_candidate(gallery, train_config, workspace):
    gallery.begin_training(train_config)
    assert gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0)) is None
    gallery.begin_training(train_config)
    write_core_config(workspace, "2026-07-26_11-17-26.json")
    write_core_config(workspace, "2026-07-26_11-17-27.json")
    assert gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0)) is None


def test_rejects_existing_run_key_collision(gallery, train_config, workspace):
    gallery.begin_training(train_config)
    config = write_core_config(workspace, "2026-07-26_11-17-26.json")
    occupied = workspace / "web" / "samples" / config.stem
    occupied.mkdir(parents=True)
    write_json_atomic(occupied / "manifest.json", {"schema_version": 1, "run": {"key": config.stem, "started_at": "different"}, "batches": []})
    assert gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0)) is None


def test_revision_applies_model_defaults_and_train_overlays(gallery, train_config, core_config):
    train_config.text_encoder_layer_skip = 3
    gallery.begin_training(train_config)
    core_config()
    gallery.begin_batch([{"webui_id": "prompt_a", "enabled": True, "prompt": "a"}], train_config, progress(step=0))
    prompt = first_revision_prompt(read_prompts(gallery))
    assert prompt["text_encoder_1_layer_skip"] == 3
    assert prompt["width"] == SampleConfig.default_values(train_config.model_type).width


def test_finish_batch_marks_pending_slots_unavailable(gallery, train_config, core_config):
    gallery.begin_training(train_config)
    core_config()
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    gallery.finish_batch()
    assert read_manifest(gallery)["batches"][0]["samples"][0]["status"] == "unavailable"
```

```python
def test_resolves_changed_same_name_config(gallery, train_config, workspace):
    config = write_core_config(workspace, "2026-07-26_11-17-26.json", content='{"before": true}')
    gallery.begin_training(train_config)
    config.write_text('{"after": true}', encoding="utf-8")
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert gallery.active_run_key == config.stem
```

- [ ] **Step 2: Run lifecycle tests and verify failure**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_gallery_service.py -k "config or revision or batch or variant" -v`

Expected: collection fails because `modules.webui.gallery` does not exist.

- [ ] **Step 3: Define concrete gallery types and initialization**

```python
SampleVariant = Literal["base", "ema", "non_ema"]
SampleStatus = Literal["pending", "ready", "unavailable", "error"]


@dataclass(frozen=True)
class TrainingProgressSnapshot:
    epoch: int
    epoch_step: int
    global_step: int


@dataclass(frozen=True)
class FileSignature:
    mtime_ns: int
    size: int
    sha256: str


@dataclass(frozen=True)
class GalleryImage:
    path: Path
    media_type: str
    etag: str


class GalleryNotFound(LookupError):
    pass


class GalleryService:
    def __init__(
        self,
        root_dir: Path,
        workspace_provider: Callable[[], str | Path],
        warning_sink: Callable[[str, dict[str, Any]], None] | None = None,
        thumbnail_max_size: tuple[int, int] = (512, 512),
    ) -> None:
        self._root_dir = root_dir.resolve()
        self._workspace_provider = workspace_provider
        self._warning_sink = warning_sink
        self._thumbnail_max_size = thumbnail_max_size
        self._lock = threading.RLock()
        self._active_config: TrainConfig | None = None
        self._active_workspace: Path | None = None
        self._active_run_key: str | None = None
        self._active_run_dir: Path | None = None
        self._active_batch_id: int | None = None
        self._started_at: datetime | None = None
        self._config_signatures: dict[str, FileSignature] = {}

    @property
    def active_run_key(self) -> str | None:
        return self._active_run_key

    @property
    def active_run_dir(self) -> Path | None:
        return self._active_run_dir
```

Resolve relative workspaces against `root_dir`. Compute file signatures by streaming SHA-256, not by trusting mtime alone. `begin_training` records signatures before core `trainer.start()` saves its config.

- [ ] **Step 4: Implement deterministic run and revision persistence**

Use these exact rules in `GalleryService`:

```python
def _expected_variants(config: TrainConfig) -> list[SampleVariant]:
    if config.ema == EMAMode.OFF:
        return ["base"]
    if config.non_ema_sampling:
        return ["ema", "non_ema"]
    return ["ema"]


def _normalize_definitions(definitions: list[dict[str, Any]], config: TrainConfig) -> list[dict[str, Any]]:
    normalized_definitions: list[dict[str, Any]] = []
    for source_index, source in enumerate(definitions):
        sample = SampleConfig.default_values(config.model_type).from_dict(source)
        sample.from_train_config(config)
        effective = {**source, **sample.to_dict()}
        effective["webui_id"] = source["webui_id"]
        effective["source_index"] = source_index
        normalized_definitions.append(effective)
    return normalized_definitions


def _revision_id(definitions: list[dict[str, Any]]) -> str:
    encoded = json.dumps(definitions, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"
```

`begin_batch` must resolve exactly one new/changed prefixed core config, reject an occupied run directory whose manifest has a different `started_at`, write `prompts.json` before `manifest.json`, append one batch per status transition, and prepopulate one `pending` sample slot for each enabled prompt/expected-variant pair. Add `unassigned_errors: []` to every batch so association errors have an explicit durable location.

- [ ] **Step 5: Run lifecycle tests**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_gallery_service.py -k "config or revision or batch or variant" -v`

Expected: all selected lifecycle tests pass.

- [ ] **Step 6: Commit gallery metadata lifecycle**

```bash
git add modules/webui/gallery.py tests/webui/test_gallery_service.py
git commit -m "feat(webui): persist gallery runs and prompt revisions"
```

---

### Task 3: Image Mirroring, Historical Reads, And Safe Lookup

**Files:**
- Modify: `modules/webui/gallery.py`
- Modify: `tests/webui/test_gallery_service.py`

**Interfaces:**
- Consumes: active batch state from Task 2 and atomic helpers from Task 1.
- Produces: `GalleryService.record_default_sample(sampler_output: ModelSamplerOutput) -> dict[str, Any] | None`.
- Produces: `GalleryService.list_runs() -> list[dict[str, Any]]`.
- Produces: `GalleryService.get_run_model(run_key: str) -> dict[str, Any]`.
- Produces: `GalleryService.get_current_model() -> dict[str, Any]`.
- Produces: `GalleryService.get_image(run_key: str, filename: str) -> GalleryImage`.

- [ ] **Step 1: Add failing mirroring and read tests**

```python
def test_record_sample_copies_exact_bytes_and_creates_thumbnail(active_gallery, source_png):
    output = ModelSamplerOutput(FileType.IMAGE, Image.open(source_png))
    output.filepath = str(source_png)
    event = active_gallery.record_default_sample(output)
    manifest = read_manifest(active_gallery)
    sample = manifest["batches"][0]["samples"][0]
    mirrored = active_gallery.active_run_dir / sample["filename"]
    thumbnail = active_gallery.active_run_dir / sample["thumbnail_filename"]
    assert mirrored.read_bytes() == source_png.read_bytes()
    with Image.open(thumbnail) as image:
        assert image.width <= 512
        assert image.height <= 512
        assert image.format == "WEBP"
    assert event["run_key"] == active_gallery.active_run_key
    assert event["batch_id"] == 1


def test_non_ema_parent_maps_to_non_ema_without_prompt_suffix_confusion(active_gallery, non_ema_source):
    output = image_output(non_ema_source)
    active_gallery.record_default_sample(output)
    ready = ready_samples(read_manifest(active_gallery))
    assert ready[0]["variant"] == "non_ema"


def test_get_image_rejects_unreferenced_and_escaping_files(active_gallery, source_png):
    active_gallery.record_default_sample(image_output(source_png))
    with pytest.raises(GalleryNotFound):
        active_gallery.get_image(active_gallery.active_run_key, "../manifest.json")
    rogue = active_gallery.active_run_dir / "rogue.png"
    rogue.write_bytes(b"rogue")
    with pytest.raises(GalleryNotFound):
        active_gallery.get_image(active_gallery.active_run_key, rogue.name)
```

Add explicit failure and recovery assertions:

```python
def test_thumbnail_failure_keeps_full_image_ready(active_gallery, source_png, monkeypatch):
    monkeypatch.setattr("modules.webui.gallery.save_pil_atomic", Mock(side_effect=OSError("thumbnail failed")))
    active_gallery.record_default_sample(image_output(source_png))
    sample = ready_samples(read_manifest(active_gallery))[0]
    assert sample["status"] == "ready"
    assert sample["thumbnail_filename"] == sample["filename"]
    assert sample["thumbnail_error"] == "thumbnail failed"


def test_copy_failure_marks_slot_error_without_touching_core(active_gallery, source_png, monkeypatch):
    original = source_png.read_bytes()
    monkeypatch.setattr("modules.webui.gallery.copy_file_atomic", Mock(side_effect=OSError("copy failed")))
    assert active_gallery.record_default_sample(image_output(source_png)) is None
    assert source_png.read_bytes() == original
    assert read_manifest(active_gallery)["batches"][0]["samples"][0]["status"] == "error"


@pytest.mark.parametrize("source_kind", ["outside_workspace", "wrong_parent", "non_image"])
def test_rejects_unassociable_or_unsupported_output(active_gallery, output_for_kind, source_kind):
    assert active_gallery.record_default_sample(output_for_kind(source_kind)) is None
    assert ready_samples(read_manifest(active_gallery)) == []


def test_concurrent_callbacks_do_not_corrupt_manifest(active_gallery, outputs_for_all_slots):
    with ThreadPoolExecutor(max_workers=len(outputs_for_all_slots)) as executor:
        list(executor.map(active_gallery.record_default_sample, outputs_for_all_slots))
    manifest = read_manifest(active_gallery)
    assert len(ready_samples(manifest)) == len(outputs_for_all_slots)
    json.loads((active_gallery.active_run_dir / "manifest.json").read_text(encoding="utf-8"))


def test_list_runs_is_newest_first_and_isolates_corrupt_runs(gallery, historical_run_factory):
    historical_run_factory("older", "2026-07-26T10:00:00Z")
    historical_run_factory("newer", "2026-07-26T11:00:00Z")
    historical_run_factory("corrupt", None, raw_manifest="not json")
    assert [run["key"] for run in gallery.list_runs()] == ["newer", "older"]


def test_current_gallery_shapes_before_and_after_first_batch(gallery, train_config, core_config):
    assert gallery.get_current_model() == {"active": False, "run": None, "batches": [], "revisions": {}}
    gallery.begin_training(train_config)
    assert gallery.get_current_model() == {"active": True, "run": None, "batches": [], "revisions": {}}
    core_config()
    gallery.begin_batch([sample_definition("prompt_a")], train_config, progress(step=0))
    assert gallery.get_current_model()["run"]["key"] == gallery.active_run_key


def test_missing_referenced_image_becomes_unavailable(active_gallery, source_png):
    active_gallery.record_default_sample(image_output(source_png))
    image = active_gallery.get_image(active_gallery.active_run_key, ready_samples(read_manifest(active_gallery))[0]["filename"])
    image.path.unlink()
    with pytest.raises(GalleryNotFound):
        active_gallery.get_image(active_gallery.active_run_key, image.path.name)
    assert active_gallery.get_run_model(active_gallery.active_run_key)["batches"][0]["samples"][0]["status"] == "unavailable"
```

- [ ] **Step 2: Run tests and verify missing behavior**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_gallery_service.py -k "sample or image or run or corrupt or concurrent" -v`

Expected: failures report missing `record_default_sample`, `list_runs`, `get_run_model`, and `get_image` behavior.

- [ ] **Step 3: Implement exact path association and synchronous mirroring**

For each active revision prompt, compare the callback parent against both exact expected directory names:

```python
primary_parent = f"{source_index} - {path_util.safe_filename(prompt['prompt'])}"
non_ema_parent = f"{primary_parent} - no-ema"
if source.parent.name == non_ema_parent:
    variant: SampleVariant = "non_ema"
elif source.parent.name == primary_parent:
    variant = "base" if self._active_config.ema == EMAMode.OFF else "ema"
else:
    self._record_unassigned_error(source.name, "source directory did not match captured prompt")
    return None
```

Require `sampler_output.file_type == FileType.IMAGE`, an existing regular source beneath `<workspace>/samples`, and one matching pending slot. Name outputs with:

```python
stem = f"{batch_id:06d}-step-{global_step:09d}-prompt-{source_index:03d}-{variant.replace('_', '-')}"
filename = f"{stem}{source.suffix.lower()}"
thumbnail_filename = f"{stem}-thumb.webp"
```

Copy before thumbnail generation. If thumbnail generation fails, keep the full image `ready`, set `thumbnail_filename` to the full filename, and store `thumbnail_error`. Store both SHA-256 digests when separate files exist. Persist the manifest before returning this enriched event:

```python
return {
    "run_key": self._active_run_key,
    "batch_id": batch_id,
    "webui_prompt_id": prompt["webui_id"],
    "variant": variant,
    "status": "ready",
}
```

- [ ] **Step 4: Implement validated historical models and image lookup**

Validate `schema_version == 1`, exact run key equality, revision references, sample statuses, and filename basenames when reading persisted JSON. `get_current_model()` returns this stable pre-batch shape:

```python
{
    "active": self._active_config is not None,
    "run": None,
    "batches": [],
    "revisions": {},
}
```

After a run finishes, retain its key as the process-local current run and return its persisted model with `active: false` until another Web UI run starts. After a Web UI restart there is no process-local current run, so return `{active: false, run: null, batches: [], revisions: {}}`; historical runs remain available through `list_runs()`.

`get_image` must accept only full/thumbnail filenames referenced by a `ready` sample, verify resolved containment and regular-file existence, detect an `image/*` MIME type, and return the stored digest as a quoted strong ETag.

`list_runs()` returns dictionaries with exactly `key`, `config_filename`, `started_at`, `batch_count`, `latest_sampled_at`, and `active`. `get_run_model()` and `get_current_model()` return exactly `active`, `run`, `batches`, `revisions`, and optional `warning`; absolute server paths never enter API models.

- [ ] **Step 5: Run the complete gallery service tests and lint**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_gallery_service.py -v && python -m ruff check modules/webui/gallery.py tests/webui/test_gallery_service.py`

Expected: all gallery service tests pass and Ruff reports no errors.

- [ ] **Step 6: Commit image persistence and reads**

```bash
git add modules/webui/gallery.py tests/webui/test_gallery_service.py
git commit -m "feat(webui): mirror and serve gallery sample files"
```

---

### Task 4: Dynamic Prompt Sampling Coordinator

**Files:**
- Create: `modules/webui/sampling_coordinator.py`
- Create: `tests/webui/test_sampling_coordinator.py`
- Modify: `modules/webui/config_service.py:205-224`

**Interfaces:**
- Consumes: `GalleryService` and `TrainingProgressSnapshot` from Tasks 2-3.
- Produces: `PromptDefinitionsState(samples: list[dict[str, Any]], queued: bool)`.
- Produces: `SamplingCoordinator(root_dir: Path, sample_path_provider: Callable[[], Path | None], gallery: GalleryService)`.
- Produces: `get_definitions() -> PromptDefinitionsState` and `put_definitions(samples: Sequence[Mapping[str, Any]]) -> PromptDefinitionsState`.
- Produces: `begin_training(config: TrainConfig) -> None`, `on_status(status: str, progress: TrainingProgressSnapshot) -> None`, and `on_default_sample(sampler_output: ModelSamplerOutput) -> dict[str, Any] | None`.
- Produces: `finish_training() -> None` and `recover_pending() -> None`.
- Produces: `ConfigService.sample_definition_path -> Path | None`.

- [ ] **Step 1: Write failing coordinator tests**

```python
def test_get_backfills_missing_ids_and_replaces_duplicates(coordinator, prompt_file):
    prompt_file.write_text(json.dumps([{"prompt": "a"}, {"prompt": "b", "webui_id": "same"}, {"prompt": "c", "webui_id": "same"}]))
    state = coordinator.get_definitions()
    ids = [sample["webui_id"] for sample in state.samples]
    assert all(value.startswith("prompt_") for value in ids)
    assert len(set(ids)) == 3
    assert state.queued is False


def test_edit_during_sampling_is_durable_and_applies_after_batch(coordinator, gallery, prompt_file, train_config):
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=100))
    queued = coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "new"}])
    assert queued.queued is True
    assert json.loads(prompt_file.read_text())[0]["prompt"] == "old"
    assert Path(f"{prompt_file}.webui-pending").exists()
    coordinator.on_status("Training ...", progress(step=100))
    assert json.loads(prompt_file.read_text())[0]["prompt"] == "new"
    assert not Path(f"{prompt_file}.webui-pending").exists()
    gallery.finish_batch.assert_called_once()


def test_restart_recovers_pending_update(coordinator, prompt_file):
    pending = Path(f"{prompt_file}.webui-pending")
    pending.write_text(json.dumps([{"webui_id": "prompt_a", "prompt": "recovered"}]))
    coordinator.recover_pending()
    assert json.loads(prompt_file.read_text())[0]["prompt"] == "recovered"
    assert not pending.exists()
```

Add concrete coordination edge cases:

```python
def test_edit_before_sampling_is_used_by_next_batch(coordinator, gallery, train_config):
    state = coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "new"}])
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    assert state.queued is False
    assert gallery.begin_batch.call_args.args[0][0]["prompt"] == "new"


def test_put_preserves_ids_and_latest_queued_edit_wins(coordinator, prompt_file, train_config):
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "first"}])
    coordinator.put_definitions([{"webui_id": "prompt_a", "prompt": "latest"}])
    coordinator.on_status("Training ...", progress(step=0))
    applied = json.loads(prompt_file.read_text(encoding="utf-8"))
    assert applied == [{"webui_id": "prompt_a", "prompt": "latest"}]


def test_failed_pending_write_is_not_acknowledged(coordinator, train_config, monkeypatch):
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    monkeypatch.setattr("modules.webui.sampling_coordinator.write_json_atomic", Mock(side_effect=OSError("disk full")))
    with pytest.raises(PromptPersistenceError, match="disk full"):
        coordinator.put_definitions([{"prompt": "new"}])


def test_repeated_sampling_status_opens_one_batch_and_finish_closes_it(coordinator, gallery, train_config):
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.on_status("Sampling ...", progress(step=0))
    coordinator.finish_training()
    gallery.begin_batch.assert_called_once()
    gallery.finish_batch.assert_called_once()
    gallery.finish_training.assert_called_once()


def test_inline_samples_queue_for_next_training_run(coordinator, gallery, train_config):
    train_config.samples = [SampleConfig.default_values(train_config.model_type)]
    coordinator.begin_training(train_config)
    coordinator.on_status("Sampling ...", progress(step=0))
    state = coordinator.put_definitions([{"webui_id": "prompt_new", "prompt": "next run"}])
    assert state.queued is True
    assert gallery.begin_batch.call_args.args[0][0]["prompt"] == train_config.samples[0].prompt


def test_on_default_sample_delegates_to_gallery(coordinator, gallery, image_output):
    gallery.record_default_sample.return_value = {"run_key": "run", "status": "ready"}
    assert coordinator.on_default_sample(image_output) == {"run_key": "run", "status": "ready"}
```

- [ ] **Step 2: Run tests and verify missing coordinator**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_sampling_coordinator.py -v`

Expected: collection fails with `ModuleNotFoundError: No module named 'modules.webui.sampling_coordinator'`.

- [ ] **Step 3: Expose current prompt path and define coordinator contracts**

Add to `ConfigService`:

```python
@property
def sample_definition_path(self) -> Path | None:
    return self._resolve_sample_file_path()
```

Define coordinator state and errors:

```python
@dataclass(frozen=True)
class PromptDefinitionsState:
    samples: list[dict[str, Any]]
    queued: bool


class PromptDefinitionsError(ValueError):
    pass


class PromptPersistenceError(OSError):
    pass
```

Use a `threading.RLock`. While training is active, pin the prompt path from `TrainConfig.sample_definition_file_name`; otherwise use the injected `sample_path_provider`.

- [ ] **Step 4: Implement ID normalization, durable queueing, and transitions**

```python
def _normalize_ids(samples: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source in samples:
        if not isinstance(source, Mapping):
            raise PromptDefinitionsError("Each sample definition must be an object")
        sample = deepcopy(dict(source))
        candidate = sample.get("webui_id")
        if not isinstance(candidate, str) or not candidate.startswith("prompt_") or candidate in seen:
            candidate = f"prompt_{uuid.uuid4().hex}"
        sample["webui_id"] = candidate
        seen.add(candidate)
        normalized.append(sample)
    return normalized
```

`put_definitions` must atomically write the source file when idle and `<source>.webui-pending` when sampling. Never return success after a failed write. `get_definitions` returns pending definitions during sampling so the prompt manager reflects the latest accepted edit.

`on_status("Sampling ...")` must set `_sampling_active = True` under the lock before writing back normalized IDs, then call `gallery.begin_batch`. A non-sampling status calls `gallery.finish_batch()`, atomically replaces the source with pending content, removes pending only after success, and clears `_sampling_active`. `finish_training` performs the same close/flush path in `finally`.

If active `TrainConfig.samples` is not `None`, capture those definitions for the gallery but mark live prompt writes as queued for the next training run because core will not reload the file.

- [ ] **Step 5: Run coordinator and config service tests**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_sampling_coordinator.py tests/webui/test_config_service.py -v`

Expected: all selected tests pass.

- [ ] **Step 6: Commit prompt coordination**

```bash
git add modules/webui/sampling_coordinator.py modules/webui/config_service.py tests/webui/test_sampling_coordinator.py
git commit -m "feat(webui): coordinate live sample prompt revisions"
```

---

### Task 5: Training Callback Integration

**Files:**
- Modify: `modules/webui/training.py:62-83, 231-250, 252-483`
- Modify: `modules/webui/events.py:14-20`
- Modify: `tests/webui/test_training_service.py`
- Modify: `tests/webui/test_training_events.py`

**Interfaces:**
- Consumes: `SamplingCoordinator` and `TrainingProgressSnapshot` from Task 4.
- Produces: `TrainingService(event_bus: Any | None = None, sampling_coordinator: SamplingCoordinator | None = None)`.
- Produces enriched `training_sample` events only after manifest persistence.
- Produces `gallery_warning` events through the gallery warning sink wired in Task 6.

- [ ] **Step 1: Write failing training integration tests**

```python
def test_training_status_callbacks_bound_one_gallery_batch(training_service, coordinator, fake_trainer):
    training_service._run_training_worker(valid_config_dict())
    coordinator.begin_training.assert_called_once()
    coordinator.on_status.assert_any_call("Sampling ...", TrainingProgressSnapshot(epoch=1, epoch_step=0, global_step=0))
    coordinator.on_status.assert_any_call("Training ...", TrainingProgressSnapshot(epoch=1, epoch_step=0, global_step=0))
    coordinator.finish_training.assert_called_once()


def test_sample_callback_does_not_write_training_samples(training_service, coordinator, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    coordinator.on_default_sample.return_value = {"run_key": "run", "batch_id": 1, "status": "ready"}
    training_service._handle_default_sample(image_output(tmp_path / "workspace" / "samples" / "0 - prompt" / "sample.png"))
    assert not (tmp_path / "training_samples").exists()
    assert training_service.get_samples()[-1]["run_key"] == "run"


def test_sample_event_is_not_emitted_when_gallery_rejects_output(training_service, coordinator):
    coordinator.on_default_sample.return_value = None
    training_service._handle_default_sample(object())
    assert training_service.get_samples() == []
```

```python
def test_progress_retains_epoch_step(training_service):
    training_service.update_progress(step=12, epoch=2, epoch_step=7)
    assert training_service._progress_snapshot() == TrainingProgressSnapshot(epoch=2, epoch_step=7, global_step=12)


@pytest.mark.parametrize("exit_mode", ["failure", "stop"])
def test_training_exit_always_finishes_coordinator(training_service, coordinator, fake_trainer, exit_mode):
    fake_trainer.configure_exit(exit_mode)
    training_service._run_training_worker(valid_config_dict())
    coordinator.finish_training.assert_called_once()
```

- [ ] **Step 2: Run tests and verify callback failures**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_training_service.py tests/webui/test_training_events.py -k "sample or coordinator or epoch_step or cleanup" -v`

Expected: failures show the missing coordinator integration and continued `training_samples` write.

- [ ] **Step 3: Wire progress, status, and sample methods**

Add `_epoch_step`, `_sampling_coordinator`, and:

```python
def _progress_snapshot(self) -> TrainingProgressSnapshot:
    with self._lock:
        return TrainingProgressSnapshot(
            epoch=self._epoch,
            epoch_step=self._epoch_step,
            global_step=self._step,
        )


def _handle_default_sample(self, sampler_output: Any) -> None:
    if self._sampling_coordinator is None:
        return
    payload = self._sampling_coordinator.on_default_sample(sampler_output)
    if payload is not None:
        self.record_sample(payload)
```

Change `update_progress` to accept `epoch_step: int | None = None`, populate it from `train_progress.epoch_step`, and wire:

```python
callbacks = TrainCallbacks(
    on_update_status=lambda status: self._sampling_coordinator.on_status(status, self._progress_snapshot())
    if self._sampling_coordinator
    else None,
    on_update_train_progress=on_progress,
    on_sample_default=self._handle_default_sample,
)
```

Delete the PIL re-encoding block and all callback-created `training_samples` paths.

Add the warning event enum consumed by Task 6 while preserving every existing enum member:

```python
class EventType(str, Enum):
    GALLERY_WARNING = "gallery_warning"
```

- [ ] **Step 4: Guarantee lifecycle cleanup**

Call `sampling_coordinator.begin_training(train_config)` after constructing `TrainConfig` and before creating the trainer. Wrap trainer setup/start/train in `try/finally`, with exactly one `sampling_coordinator.finish_training()` call in `finally`; log coordinator failures without replacing the training failure state.

- [ ] **Step 5: Run impacted training tests**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_training_service.py tests/webui/test_training_events.py tests/webui/test_training_api.py -v`

Expected: all selected tests pass and no test observes a generated image under `training_samples`.

- [ ] **Step 6: Commit training integration**

```bash
git add modules/webui/training.py modules/webui/events.py tests/webui/test_training_service.py tests/webui/test_training_events.py
git commit -m "feat(webui): record gallery samples from training callbacks"
```

---

### Task 6: Gallery And Prompt APIs

**Files:**
- Create: `modules/webui/routers/gallery.py`
- Modify: `modules/webui/routers/samples.py`
- Modify: `modules/webui/state.py:5-46`
- Modify: `modules/webui/app.py:107-170, 217-229`
- Create: `tests/webui/test_gallery_router.py`
- Modify: `tests/webui/test_samples_router.py`

**Interfaces:**
- Consumes: `GalleryService`, `GalleryImage`, and `SamplingCoordinator`.
- Produces: `GET /api/gallery/runs`, `GET /api/gallery/current`, `GET /api/gallery/runs/{run_key}`, and `GET /api/gallery/runs/{run_key}/images/{filename}`.
- Produces: `{samples: SampleDefinition[], queued: bool}` from both sample-definition endpoints.

- [ ] **Step 1: Write failing router tests**

```python
def test_gallery_image_has_strong_cache_headers(client, gallery_service):
    image_path = client.app.state.webui.settings.root_dir / "sample.png"
    image_path.write_bytes(b"image")
    gallery_service.get_image.return_value = GalleryImage(
        path=image_path, media_type="image/png", etag='"abc123"'
    )
    response = client.get("/api/gallery/runs/run/images/sample.png")
    assert response.status_code == 200
    assert response.headers["etag"] == '"abc123"'
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_gallery_image_honors_if_none_match(client, gallery_service):
    image_path = client.app.state.webui.settings.root_dir / "sample.png"
    image_path.write_bytes(b"image")
    gallery_service.get_image.return_value = GalleryImage(
        path=image_path, media_type="image/png", etag='"abc123"'
    )
    response = client.get("/api/gallery/runs/run/images/sample.png", headers={"If-None-Match": '"abc123"'})
    assert response.status_code == 304


def test_samples_put_returns_queued_state(client, sampling_coordinator):
    sampling_coordinator.put_definitions.return_value = PromptDefinitionsState(
        samples=[{"webui_id": "prompt_a", "prompt": "new"}], queued=True
    )
    response = client.put("/api/samples", json={"samples": [{"prompt": "new"}]})
    assert response.status_code == 200
    assert response.json()["queued"] is True
```

```python
def test_lists_valid_runs_newest_first_and_returns_empty_current(client, gallery_service):
    gallery_service.list_runs.return_value = [{"key": "newer"}, {"key": "older"}]
    gallery_service.get_current_model.return_value = {"active": False, "run": None, "batches": [], "revisions": {}}
    assert client.get("/api/gallery/runs").json() == {"runs": [{"key": "newer"}, {"key": "older"}]}
    assert client.get("/api/gallery/current").json()["run"] is None


def test_samples_rejects_malformed_body(client):
    assert client.put("/api/samples", json={"samples": "not-a-list"}).status_code == 422


@pytest.mark.parametrize(
    "url",
    [
        "/api/gallery/runs/unknown",
        "/api/gallery/runs/..%2Foutside",
        "/api/gallery/runs/run/images/..%2Fmanifest.json",
        "/api/gallery/runs/run/images/unreferenced.png",
        "/api/gallery/runs/run/images/missing.png",
        "/api/gallery/runs/run/images/not-image.txt",
    ],
)
def test_gallery_rejects_unknown_or_unsafe_resources(client, gallery_service, url):
    gallery_service.get_run_model.side_effect = GalleryNotFound("gallery run not found")
    gallery_service.get_image.side_effect = GalleryNotFound("gallery image not found")
    assert client.get(url).status_code == 404
```

- [ ] **Step 2: Run router tests and verify missing endpoints**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_gallery_router.py tests/webui/test_samples_router.py -v`

Expected: gallery requests return 404 and sample response assertions fail.

- [ ] **Step 3: Implement router contracts**

```python
class SamplesPutRequest(BaseModel):
    samples: list[dict[str, Any]]


@router.get("/gallery/runs")
def list_gallery_runs(request: Request):
    return {"runs": request.app.state.webui.gallery_service.list_runs()}


@router.get("/gallery/current")
def get_current_gallery(request: Request):
    return request.app.state.webui.gallery_service.get_current_model()


@router.get("/gallery/runs/{run_key}")
def get_gallery_run(run_key: str, request: Request):
    try:
        return request.app.state.webui.gallery_service.get_run_model(run_key)
    except GalleryNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
```

The image endpoint returns `Response(status_code=304, headers=cache_headers)` for an ETag match, otherwise `FileResponse` with MIME, ETag, immutable cache, and `nosniff`. Delegate all identifier and path checks to `GalleryService.get_image`.

Map `PromptDefinitionsError` to 422 and `PromptPersistenceError` to 500 in `routers/samples.py`; do not silently convert malformed bodies to an empty list.

- [ ] **Step 4: Wire services and warning events in app state**

Add `gallery` and `sampling` fields/properties to `AppState`. Construct services after `event_hub.start()` and before `TrainingService`:

```python
gallery_svc = GalleryService(
    root_dir=settings.root_dir,
    workspace_provider=lambda: config_svc.current_workspace,
    warning_sink=lambda message, payload: event_hub.publish_from_thread(
        EventType.GALLERY_WARNING.value,
        {"message": message, **payload},
    ),
)
sampling_svc = SamplingCoordinator(
    root_dir=settings.root_dir,
    sample_path_provider=lambda: config_svc.sample_definition_path,
    gallery=gallery_svc,
)
sampling_svc.recover_pending()
training_svc = TrainingService(event_bus=event_hub, sampling_coordinator=sampling_svc)
```

Register `gallery_router` under `/api`. Ensure shutdown calls `sampling_svc.finish_training()` before closing the event hub.

- [ ] **Step 5: Run backend router and regression tests**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_gallery_router.py tests/webui/test_samples_router.py tests/webui/test_api_security.py tests/webui/test_events.py -v`

Expected: all selected tests pass.

- [ ] **Step 6: Commit the backend API surface**

```bash
git add modules/webui/routers/gallery.py modules/webui/routers/samples.py modules/webui/state.py modules/webui/app.py tests/webui/test_gallery_router.py tests/webui/test_samples_router.py
git commit -m "feat(webui): expose persistent sample gallery API"
```

---

### Task 7: Frontend Gallery Contracts And Live Invalidation

**Files:**
- Modify: `web/src/lib/api/types.ts`
- Modify: `web/src/lib/api/client.ts`
- Modify: `web/src/lib/api/queries.ts`
- Modify: `web/src/lib/events/client.ts`
- Modify: `web/src/lib/components/LayoutContent.svelte`
- Create: `web/src/lib/components/LayoutContent.test.ts`
- Modify: `web/src/lib/api/client.test.ts`
- Modify: `web/src/lib/events/client.test.ts`

**Interfaces:**
- Produces the exact `GalleryVariant`, `GallerySampleStatus`, `GalleryRunSummary`, `GalleryPrompt`, `GalleryPromptRevision`, `GallerySample`, `GalleryBatch`, `GalleryRunModel`, `SampleDefinition`, and `SamplesResponse` TypeScript contracts.
- Produces `galleryImageUrl`, gallery API methods, gallery query factories, `EventClientOptions.onTrainingSample`, and `EventClientOptions.onGalleryWarning`.

- [ ] **Step 1: Write failing client and event tests**

```typescript
it('encodes gallery run keys and filenames', async () => {
  const api = createApi('/root');
  fetchMock.mockResolvedValue(jsonResponse(emptyGallery));
  await api.getGalleryRun('prefix run');
  expect(fetchMock).toHaveBeenCalledWith('/root/api/gallery/runs/prefix%20run', expect.anything());
  expect(galleryImageUrl('prefix run', 'sample one.png', '/root')).toBe(
    '/root/api/gallery/runs/prefix%20run/images/sample%20one.png'
  );
});


it('notifies training sample and gallery warning callbacks', async () => {
  const onTrainingSample = vi.fn();
  const onGalleryWarning = vi.fn();
  const { client, socket } = liveClient({ onTrainingSample, onGalleryWarning });
  socket.message({ type: 'training_sample', run_key: 'run', batch_id: 1 });
  socket.message({ type: 'gallery_warning', message: 'thumbnail failed', run_key: 'run' });
  expect(onTrainingSample).toHaveBeenCalledWith(expect.objectContaining({ run_key: 'run' }));
  expect(onGalleryWarning).toHaveBeenCalledWith(expect.objectContaining({ message: 'thumbnail failed' }));
  client.stop();
});


it('invalidates persisted gallery queries and renders a gallery warning', async () => {
  const { eventClient, queryClient } = renderLayoutContent();
  eventClient.emit({ type: 'training_sample', run_key: 'run_a', batch_id: 1 });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['gallery', 'current'] });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['gallery', 'runs'] });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['gallery', 'runs', 'run_a'] });
  eventClient.emit({ type: 'gallery_warning', message: 'thumbnail failed', run_key: 'run_a' });
  expect(await screen.findByRole('status')).toHaveTextContent('thumbnail failed');
});
```

- [ ] **Step 2: Run focused tests and verify failures**

Run from `web`: `bun run test -- src/lib/api/client.test.ts src/lib/events/client.test.ts`

Expected: tests fail because gallery methods and event callbacks are absent.

- [ ] **Step 3: Add exact shared types and API methods**

```typescript
export type GalleryVariant = 'base' | 'ema' | 'non_ema';
export type GallerySampleStatus = 'pending' | 'ready' | 'unavailable' | 'error';

export interface GalleryRunInfo {
  key: string;
  config_filename: string;
  started_at: string;
}

export interface GalleryRunSummary extends GalleryRunInfo {
  batch_count: number;
  latest_sampled_at?: string | null;
  active?: boolean;
}

export interface GalleryRunsResponse {
  runs: GalleryRunSummary[];
}

export interface GalleryPrompt extends Record<string, unknown> {
  webui_id: string;
  source_index: number;
  enabled: boolean;
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  diffusion_steps: number;
  cfg_scale: number;
  seed?: number;
  random_seed?: boolean;
  noise_scheduler?: string;
}

export interface GalleryPromptRevision {
  captured_at: string;
  prompts: GalleryPrompt[];
}

export interface GallerySample {
  webui_prompt_id: string;
  source_index: number;
  variant: GalleryVariant;
  status: GallerySampleStatus;
  filename?: string | null;
  thumbnail_filename?: string | null;
  width?: number | null;
  height?: number | null;
  error?: string | null;
  thumbnail_error?: string | null;
}

export interface GalleryBatch {
  id: number;
  sampled_at: string;
  epoch: number;
  epoch_step: number;
  global_step: number;
  prompt_revision_id: string;
  expected_prompt_ids: string[];
  expected_variants: GalleryVariant[];
  samples: GallerySample[];
  unassigned_errors: Array<{ source_filename: string; message: string }>;
}

export interface GalleryRunModel {
  active: boolean;
  run: GalleryRunInfo | null;
  batches: GalleryBatch[];
  revisions: Record<string, GalleryPromptRevision>;
  warning?: string | null;
}

export interface SampleDefinition extends Record<string, unknown> {
  webui_id?: string;
  enabled?: boolean;
  prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  diffusion_steps?: number;
  cfg_scale?: number;
  seed?: number;
  random_seed?: boolean;
  noise_scheduler?: string;
}

export interface SamplesResponse {
  samples: SampleDefinition[];
  queued: boolean;
}
```

Add these exact client methods and URL builder:

```typescript
getGalleryRuns: () => request<GalleryRunsResponse>(`${base}/api/gallery/runs`),
getGalleryRun: (runKey: string) =>
  request<GalleryRunModel>(`${base}/api/gallery/runs/${encodeURIComponent(runKey)}`),
getCurrentGallery: () => request<GalleryRunModel>(`${base}/api/gallery/current`),
getSamples: () => request<SamplesResponse>(`${base}/api/samples`),
updateSamples: (samples: SampleDefinition[]) =>
  request<SamplesResponse>(`${base}/api/samples`, {
    method: 'PUT',
    body: JSON.stringify({ samples }),
  }),
```

```typescript
export function galleryImageUrl(runKey: string, filename: string, base = ''): string {
  return `${base}/api/gallery/runs/${encodeURIComponent(runKey)}/images/${encodeURIComponent(filename)}`;
}
```

Add these event contracts to `events/client.ts` and fields to `EventClientOptions`:

```typescript
export interface GalleryTrainingSampleEvent {
  type: 'training_sample';
  run_key?: string;
  batch_id?: number;
  webui_prompt_id?: string;
  variant?: GalleryVariant;
  status?: GallerySampleStatus;
  [key: string]: unknown;
}

export interface GalleryWarningEvent {
  type: 'gallery_warning';
  message: string;
  run_key?: string;
  [key: string]: unknown;
}

onTrainingSample?: (event: GalleryTrainingSampleEvent) => void;
onGalleryWarning?: (event: GalleryWarningEvent) => void;
```

- [ ] **Step 4: Add reactive query factories and event invalidation**

```typescript
gallery: () => ['gallery'] as const,
galleryRuns: () => ['gallery', 'runs'] as const,
galleryRun: (runKey: string) => ['gallery', 'runs', runKey] as const,
galleryCurrent: () => ['gallery', 'current'] as const,
```

`createGalleryRunQuery(getRunKey: () => string | null)` must use this reactive options callback. Prompt queries return the whole `SamplesResponse` and mutation success writes the whole response to `queryKeys.samples()`.

```typescript
export function createGalleryRunQuery(getRunKey: () => string | null) {
  const client = getSafeQueryClient();
  return createQuery(
    () => {
      const runKey = getRunKey();
      return {
        queryKey: queryKeys.galleryRun(runKey ?? ''),
        queryFn: () => api.getGalleryRun(runKey as string),
        enabled: Boolean(runKey),
      };
    },
    client
  );
}

export function createGalleryRunsQuery() {
  return createQuery({ queryKey: queryKeys.galleryRuns(), queryFn: () => api.getGalleryRuns() });
}

export function createGalleryCurrentQuery() {
  return createQuery({ queryKey: queryKeys.galleryCurrent(), queryFn: () => api.getCurrentGallery() });
}
```

In `LayoutContent`, invalidate current, runs, and the event's exact run after `training_sample`. Show a four-second global warning banner for `gallery_warning` with `role="status"`; do not add a new toast framework.

- [ ] **Step 5: Run tests and Svelte type checking**

Run from `web`: `bun run test -- src/lib/api/client.test.ts src/lib/events/client.test.ts src/lib/components/LayoutContent.test.ts && bun run check`

Expected: focused tests pass and Svelte Check reports 0 errors.

- [ ] **Step 6: Commit frontend contracts**

```bash
git add web/src/lib/api/types.ts web/src/lib/api/client.ts web/src/lib/api/queries.ts web/src/lib/events/client.ts web/src/lib/components/LayoutContent.svelte web/src/lib/components/LayoutContent.test.ts web/src/lib/api/client.test.ts web/src/lib/events/client.test.ts
git commit -m "feat(webui): add sample gallery client contracts"
```

---

### Task 8: Accessible Timeline Image Viewer

**Files:**
- Modify: `web/src/lib/components/ui/ModalDialog.svelte`
- Modify: `web/src/lib/components/ui/ModalDialog.test.ts`
- Create: `web/src/lib/components/training/GalleryImageViewer.svelte`
- Create: `web/src/lib/components/training/GalleryImageViewer.test.ts`

**Interfaces:**
- Consumes: gallery types and `galleryImageUrl` from Task 7.
- Produces exported `GallerySelection` and the viewer props below.
- Produces backward-compatible `ModalDialog` props `width`, `showFooter`, and `onKeyDown`.

```typescript
export interface GallerySelection {
  batchId: number;
  promptId: string;
  variant: GalleryVariant;
}

interface GalleryImageViewerProps {
  open: boolean;
  gallery: GalleryRunModel;
  selection: GallerySelection | null;
  onClose: () => void;
}
```

- [ ] **Step 1: Write failing modal and viewer tests**

```typescript
it('navigates only ready checkpoints for the selected prompt and variant', async () => {
  render(GalleryImageViewer, {
    props: { open: true, gallery, selection: { batchId: 2, promptId: 'prompt_a', variant: 'ema' }, onClose: vi.fn() },
  });
  await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
  expect(screen.getByText('Epoch 3 · Step 300')).toBeInTheDocument();
  await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
  expect(screen.getByText('Epoch 3 · Step 300')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next checkpoint' })).toBeDisabled();
});


it('navigates with a horizontal swipe but ignores vertical movement', async () => {
  const { container } = renderViewerAtMiddleCheckpoint();
  const imageStage = container.querySelector('.viewer-image-stage') as HTMLElement;
  await fireEvent.touchStart(imageStage, { touches: [{ clientX: 200, clientY: 100 }] });
  await fireEvent.touchEnd(imageStage, { changedTouches: [{ clientX: 120, clientY: 105 }] });
  expect(screen.getByText('Epoch 3 · Step 300')).toBeInTheDocument();
});
```

Cover the remaining viewer and modal behavior directly:

```typescript
it('shows exact historical metadata and a revision boundary', () => {
  renderViewerAtMiddleCheckpoint();
  expect(screen.getByText('old prompt text')).toBeInTheDocument();
  expect(screen.getByText('old negative prompt')).toBeInTheDocument();
  expect(screen.getByText('Prompt changed at this checkpoint')).toBeInTheDocument();
});


it('prefetches only adjacent ready images and exposes the original', async () => {
  const prefetched: string[] = [];
  vi.stubGlobal('Image', class { set src(value: string) { prefetched.push(value); } });
  renderViewerAtMiddleCheckpoint();
  await waitFor(() => expect(prefetched).toEqual([previousImageUrl, nextImageUrl]));
  expect(screen.getByRole('link', { name: 'Open original' })).toHaveAttribute('href', currentImageUrl);
});


it('closes on Escape and restores focus to the opening card', async () => {
  const opener = renderGalleryAndOpenViewer();
  await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(opener).toHaveFocus());
});


it('supports wide footerless modal and delegates arrow keys', async () => {
  const onKeyDown = vi.fn();
  render(ModalDialog, { props: { open: true, width: 'wide', showFooter: false, onKeyDown, onClose: vi.fn() } });
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveClass('modal-wide');
  expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  await fireEvent.keyDown(dialog, { key: 'ArrowRight' });
  expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowRight' }));
});
```

- [ ] **Step 2: Run tests and verify missing component/props**

Run from `web`: `bun run test -- src/lib/components/ui/ModalDialog.test.ts src/lib/components/training/GalleryImageViewer.test.ts`

Expected: viewer import fails and ModalDialog prop tests fail.

- [ ] **Step 3: Extend ModalDialog without changing existing defaults**

Add:

```typescript
width?: 'default' | 'wide';
showFooter?: boolean;
onKeyDown?: (event: KeyboardEvent) => void;
```

Default to `width = 'default'` and `showFooter = true`. Keep Escape and Tab handling first; invoke `onKeyDown?.(event)` only for keys not consumed by modal behavior. Add a `modal-wide` class with `max-width: 1100px` and render the footer only when `showFooter` is true.

- [ ] **Step 4: Implement viewer timeline and controls**

Build all checkpoint entries whose `expected_prompt_ids` and `expected_variants` include the selection. Resolve slots by `(webui_prompt_id, variant)`, preserve unavailable gaps for the timeline, and build navigation from `status === 'ready'` entries only.

Use:

```typescript
function navigate(delta: -1 | 1): void {
  const current = readyEntries.findIndex((entry) => entry.batch.id === activeBatchId);
  const next = current + delta;
  if (next >= 0 && next < readyEntries.length) activeBatchId = readyEntries[next].batch.id;
}

function handleViewerKeyDown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft') navigate(-1);
  if (event.key === 'ArrowRight') navigate(1);
}

function handleTouchEnd(event: TouchEvent): void {
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1);
}
```

Prefetch only adjacent ready full-size URLs in an effect. Display `Random` only for `random_seed === true`; otherwise display the numeric seed unchanged.

- [ ] **Step 5: Run viewer tests and check**

Run from `web`: `bun run test -- src/lib/components/ui/ModalDialog.test.ts src/lib/components/training/GalleryImageViewer.test.ts && bun run check`

Expected: all selected tests pass and Svelte Check reports 0 errors.

- [ ] **Step 6: Commit the viewer**

```bash
git add web/src/lib/components/ui/ModalDialog.svelte web/src/lib/components/ui/ModalDialog.test.ts web/src/lib/components/training/GalleryImageViewer.svelte web/src/lib/components/training/GalleryImageViewer.test.ts
git commit -m "feat(webui): add sample timeline image viewer"
```

---

### Task 9: Shared Checkpoint Gallery

**Files:**
- Replace: `web/src/lib/components/training/SampleGallery.svelte`
- Replace: `web/src/lib/components/training/SampleGallery.test.ts`

**Interfaces:**
- Consumes: `GalleryRunModel`, `GalleryVariant`, and `GalleryImageViewer`.
- Produces the props below.

```typescript
interface SampleGalleryProps {
  gallery?: GalleryRunModel | null;
  loading?: boolean;
  error?: Error | string | null;
  title?: string;
}
```

- [ ] **Step 1: Replace flat-gallery tests with batch fixtures**

```typescript
it('renders chronological checkpoints and exact per-revision captions', () => {
  render(SampleGallery, { props: { gallery: galleryWithEditedPrompt } });
  const rows = screen.getAllByTestId('checkpoint-row');
  expect(rows[0]).toHaveTextContent('Step 0');
  expect(rows[1]).toHaveTextContent('Step 100');
  expect(rows[0]).toHaveTextContent('old prompt');
  expect(rows[1]).toHaveTextContent('edited prompt');
});


it('renders EMA and non-EMA variant sub-rows with progressive slots', () => {
  render(SampleGallery, { props: { gallery: progressiveGallery } });
  expect(screen.getByText('EMA')).toBeInTheDocument();
  expect(screen.getByText('Non-EMA')).toBeInTheDocument();
  expect(screen.getByText('Generating...')).toBeInTheDocument();
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
  expect(screen.getByText('Gallery error')).toBeInTheDocument();
});
```

```typescript
it('omits a lone variant label and exposes exact ready-card metadata', async () => {
  render(SampleGallery, { props: { gallery: singleVariantGallery } });
  expect(screen.queryByText('Base')).not.toBeInTheDocument();
  const image = screen.getByRole('img', { name: 'sample prompt' });
  expect(image).toHaveAttribute('loading', 'lazy');
  expect(screen.getByText('1024×768')).toBeInTheDocument();
  expect(screen.getByText('20 steps')).toBeInTheDocument();
  expect(screen.getByText('CFG 7')).toBeInTheDocument();
  expect(screen.getByText('Seed -1')).toBeInTheDocument();
  expect(screen.getByTestId('variant-grid')).toHaveStyle('--prompt-columns: 3');
});


it.each([
  [{ loading: true }, 'Loading sample gallery...'],
  [{ error: new Error('gallery failed') }, 'gallery failed'],
  [{ gallery: emptyGallery }, 'No samples yet'],
])('renders renderer state %#', (props, expected) => {
  render(SampleGallery, { props });
  expect(screen.getByText(expected)).toBeInTheDocument();
});


it('opens only ready cards and passes the exact selection to the viewer', async () => {
  render(SampleGallery, { props: { gallery: progressiveGallery } });
  expect(screen.getAllByRole('button', { name: /Open sample/ })).toHaveLength(1);
  await fireEvent.click(screen.getByRole('button', { name: /Open sample/ }));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-batch-id', '1');
  expect(screen.getByRole('dialog')).toHaveAttribute('data-prompt-id', 'prompt_a');
  expect(screen.getByRole('dialog')).toHaveAttribute('data-variant', 'ema');
});
```

- [ ] **Step 2: Run tests and verify the legacy component fails**

Run from `web`: `bun run test -- src/lib/components/training/SampleGallery.test.ts`

Expected: tests fail because the component still accepts flat `samples`.

- [ ] **Step 3: Implement pure batch rendering**

Sort batches by `id`, resolve each `prompt_revision_id`, order prompts by `expected_prompt_ids`, and build every expected `(promptId, variant)` slot. Use a real button only for ready samples. Set the wide-grid column count through:

```svelte
<div
  class="variant-grid"
  style={`--prompt-columns: ${Math.max(batch.expected_prompt_ids.length, 1)}`}
>
```

Use `grid-template-columns: repeat(var(--prompt-columns), minmax(0, 1fr))`; at 768px switch to two columns and move the checkpoint label above the cards, then switch to one column at 520px. Apply `content-visibility: auto` and `contain-intrinsic-size` to checkpoint groups.

Ready cards use `loading="lazy"`, the thumbnail URL, exact revision caption, and overlay values. Pending/unavailable/error slots remain visible and are not clickable.

- [ ] **Step 4: Connect the shared viewer**

Store `GallerySelection | null` on ready-card click and render `GalleryImageViewer` with the same `GalleryRunModel`. Clear selection on close. Do not add queries or event handling to this component.

- [ ] **Step 5: Run gallery tests and type checking**

Run from `web`: `bun run test -- src/lib/components/training/SampleGallery.test.ts src/lib/components/training/GalleryImageViewer.test.ts && bun run check`

Expected: all selected tests pass and Svelte Check reports 0 errors.

- [ ] **Step 6: Commit the shared gallery**

```bash
git add web/src/lib/components/training/SampleGallery.svelte web/src/lib/components/training/SampleGallery.test.ts
git commit -m "feat(webui): render sample checkpoints and variants"
```

---

### Task 10: Gallery Route, Live Reuse, And Navigation

**Files:**
- Create: `web/src/routes/gallery/+page.svelte`
- Create: `web/src/routes/gallery/page.test.ts`
- Modify: `web/src/routes/live/+page.svelte`
- Modify: `web/src/routes/live/page.test.ts`
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Modify: `web/src/lib/components/shell/Rail.test.ts`

**Interfaces:**
- Consumes: gallery queries from Task 7 and `SampleGallery` from Task 9.
- Produces `/gallery` and a Live gallery fixed to `/api/gallery/current`.

- [ ] **Step 1: Write failing route and navigation tests**

```typescript
it('selects the active run and allows exact historical selection', async () => {
  mockGalleryRuns(['2026-07-26_12-00-00', '2026-07-26_11-00-00']);
  mockCurrentGallery(activeGallery('2026-07-26_12-00-00'));
  render(GalleryPage);
  expect(await screen.findByRole('combobox', { name: 'Gallery run' })).toHaveValue('2026-07-26_12-00-00');
  await fireEvent.change(screen.getByRole('combobox', { name: 'Gallery run' }), {
    target: { value: '2026-07-26_11-00-00' },
  });
  expect(await screen.findByText('Historical checkpoint')).toBeInTheDocument();
});


it('renders current gallery on Live without a run selector', async () => {
  render(LivePage);
  expect(await screen.findByText('Live Sample Gallery')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Gallery run' })).not.toBeInTheDocument();
});
```

```typescript
it('places enabled Gallery navigation directly after Live', () => {
  render(Rail, { props: { currentPath: '/live', mobile: false } });
  const links = screen.getAllByRole('link');
  const liveIndex = links.findIndex((link) => link.textContent?.includes('Live'));
  expect(links[liveIndex + 1]).toHaveTextContent('Gallery');
  expect(links[liveIndex + 1]).toHaveAttribute('href', '/gallery');
  expect(links[liveIndex + 1]).not.toHaveAttribute('aria-disabled', 'true');
});
```

- [ ] **Step 2: Run route tests and verify failures**

Run from `web`: `bun run test -- src/routes/gallery/page.test.ts src/routes/live/page.test.ts src/lib/components/shell/Rail.test.ts`

Expected: gallery route import/selection tests fail and Rail lacks Gallery.

- [ ] **Step 3: Implement route selection behavior**

Create all three gallery queries once. Track `selectedRunKey` and `userSelected`; prefer active current, otherwise newest summary, and retain a valid explicit historical selection. Render exact config keys newest first. Before the active run has a key, pass the empty current model to `SampleGallery`.

Use this shared rendering boundary:

```svelte
<SampleGallery
  gallery={displayGallery}
  loading={displayLoading}
  error={displayError}
  title="Sample Gallery"
/>
```

- [ ] **Step 4: Replace Live's legacy sample path and add navigation**

Remove `trainingStore.samples`, `api.getTrainingSamples()`, and the flat `samples` prop from Live. Create `createGalleryCurrentQuery()` once and render `SampleGallery` with title `Live Sample Gallery`.

Add `{ name: 'Gallery', path: '/gallery', icon: Images, disabled: false }` immediately after Live in `Rail.svelte`.

- [ ] **Step 5: Run route tests, full frontend tests, and build**

Run from `web`: `bun run test -- src/routes/gallery/page.test.ts src/routes/live/page.test.ts src/lib/components/shell/Rail.test.ts && bun run check && bun run build`

Expected: route tests pass, Svelte Check reports 0 errors, and Vite build exits 0.

- [ ] **Step 6: Commit routes and navigation**

```bash
git add web/src/routes/gallery/+page.svelte web/src/routes/gallery/page.test.ts web/src/routes/live/+page.svelte web/src/routes/live/page.test.ts web/src/lib/components/shell/Rail.svelte web/src/lib/components/shell/Rail.test.ts
git commit -m "feat(webui): add historical sample gallery route"
```

---

### Task 11: Queued Prompt Feedback And End-To-End Verification

**Files:**
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/sampling/SamplingPage.test.ts`
- Modify: `web/src/lib/components/sampling/SampleDetailModal.test.ts`
- Verify: all backend/frontend files from Tasks 1-10.

**Interfaces:**
- Consumes: `SamplesResponse` from Task 7 and backend stable-ID behavior from Task 4.
- Produces visible queued state and clone behavior that cannot reuse prompt identity.

- [ ] **Step 1: Write failing prompt manager tests**

```typescript
it('shows durable queued feedback after a mid-batch edit', async () => {
  mockSamples({ samples: [{ webui_id: 'prompt_a', prompt: 'old' }], queued: false });
  mockSampleUpdate({ samples: [{ webui_id: 'prompt_a', prompt: 'new' }], queued: true });
  render(SamplingPage);
  await editPrompt('old', 'new');
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Sample prompt changes are queued for the next sampling batch.'
  );
});


it('preserves identity on edit but removes it on clone', async () => {
  mockSamples({ samples: [{ webui_id: 'prompt_a', prompt: 'source' }], queued: false });
  render(SamplingPage);
  await clonePrompt('source');
  expect(lastUpdatedSamples()[0].webui_id).toBe('prompt_a');
  expect(lastUpdatedSamples()[1]).not.toHaveProperty('webui_id');
});
```

- [ ] **Step 2: Run tests and verify current response-shape failures**

Run from `web`: `bun run test -- src/routes/sampling/SamplingPage.test.ts src/lib/components/sampling/SampleDetailModal.test.ts`

Expected: tests fail because the route treats sample query data as an array and clone preserves `webui_id`.

- [ ] **Step 3: Implement queued feedback and safe cloning**

Use:

```typescript
const samples = $derived($samplesQuery.data?.samples ?? []);
const queued = $derived($samplesQuery.data?.queued ?? false);

function cloneSample(target: SampleDefinition): void {
  const { webui_id: discardedWebuiId, ...clone } = structuredClone(target);
  void discardedWebuiId;
  updateSamples([...samples, clone]);
}
```

Render this persistent status near the Sample Prompts heading:

```svelte
{#if queued}
  <div class="queued-banner" role="status">
    Sample prompt changes are queued for the next sampling batch.
  </div>
{/if}
```

Editing continues to deep-clone the whole definition so its existing `webui_id` survives.

- [ ] **Step 4: Run focused and complete backend verification**

Run from repository root:

```bash
PYTHONPATH=. python -m pytest \
  tests/webui/test_atomic_io.py \
  tests/webui/test_gallery_service.py \
  tests/webui/test_sampling_coordinator.py \
  tests/webui/test_gallery_router.py \
  tests/webui/test_samples_router.py \
  tests/webui/test_training_service.py \
  tests/webui/test_training_api.py \
  tests/webui/test_training_events.py -v
PYTHONPATH=. python -m pytest tests/webui -v
python -m ruff check \
  modules/webui/atomic_io.py \
  modules/webui/gallery.py \
  modules/webui/sampling_coordinator.py \
  modules/webui/training.py \
  modules/webui/config_service.py \
  modules/webui/events.py \
  modules/webui/state.py \
  modules/webui/app.py \
  modules/webui/routers/gallery.py \
  modules/webui/routers/samples.py \
  tests/webui/test_atomic_io.py \
  tests/webui/test_gallery_service.py \
  tests/webui/test_sampling_coordinator.py \
  tests/webui/test_gallery_router.py
```

Expected: all focused and complete Web UI backend tests pass; Ruff reports no errors.

- [ ] **Step 5: Run complete frontend verification**

Run from `web`:

```bash
bun run check
bun run test
bun run build
```

Expected: Svelte Check reports 0 errors, Vitest reports 0 failed tests, and Vite build exits 0.

- [ ] **Step 6: Inspect the final source-only diff**

Run from repository root:

```bash
git status --short
git diff --check
git diff --stat
git diff -- modules web/src tests/webui
```

Confirm no core file outside `modules/webui` changed, no generated image code still writes to `training_samples`, and unrelated existing worktree changes remain untouched.

- [ ] **Step 7: Commit queued feedback and final integration**

```bash
git add web/src/routes/sampling/+page.svelte web/src/routes/sampling/SamplingPage.test.ts web/src/lib/components/sampling/SampleDetailModal.test.ts
git commit -m "feat(webui): show queued sample prompt updates"
```

---

## Completion Checklist

- [ ] No core source file changed.
- [ ] Core config and sample outputs are byte-for-byte untouched by gallery code.
- [ ] No Web UI callback writes generated images under `training_samples`.
- [ ] Exact core config stems name gallery run directories.
- [ ] Prompt revisions are immutable, deduplicated, and exact for each batch.
- [ ] Mid-batch Web UI edits are durably queued and used by the following batch.
- [ ] Repeated same-step samples create separate batches.
- [ ] Base, EMA, and non-EMA variants remain separate.
- [ ] Current and historical APIs survive browser refresh and Web UI restart.
- [ ] Live progressively refreshes from persisted manifests.
- [ ] Shared gallery cards wrap by checkpoint on narrow screens.
- [ ] Modal navigation follows one prompt ID and variant, exposes gaps, stops at endpoints, and supports buttons, keyboard, swipe, Escape, focus restoration, and adjacent prefetch.
- [ ] Invalid paths, unreferenced files, corrupt manifests, unsupported media, and persistence failures fail safely.
- [ ] Backend Web UI tests, Ruff, Svelte Check, Vitest, and production build pass.
