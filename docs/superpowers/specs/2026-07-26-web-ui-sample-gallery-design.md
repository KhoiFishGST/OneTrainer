# Web UI Sample Gallery Design

## Summary

The Web UI will persist a self-contained image gallery for training runs started through the Web UI. It will mirror successful still-image samples into `<workspace>/web/samples/<config-key>`, preserve core output under `<workspace>/samples`, and remove the Web UI's duplicate image writes to `training_samples`.

The gallery will provide a historical `/gallery` route and replace Live's current sample display with the same shared component. Checkpoints form rows, enabled sample prompts form responsive cards within each row, and EMA/non-EMA outputs form labeled variant sub-rows. Selecting an image opens a modal that navigates through checkpoints for the same stable prompt and variant.

Prompt definitions remain live during training. Core already reloads the external sample-definition file at the start of each default sampling batch when `TrainConfig.samples` is `None`. The Web UI will capture an immutable, content-addressed prompt revision for every batch and queue edits submitted during an active batch so they apply to the next batch.

All implementation changes are limited to `modules/webui`, `web/src`, and their tests. Core OneTrainer source and core-generated files are not changed.

## Goals

- Persist Web UI gallery files under `<workspace>/web/samples/<config-key>`.
- Use the exact core config filename stem as the gallery run key.
- Keep mirrored full-size images, thumbnails, `manifest.json`, and `prompts.json` in one run directory.
- Associate every image with its exact prompt revision and training progress.
- Preserve repeated manual samples at the same epoch and step as separate rows.
- Apply prompt edits to the next sampling batch without mixing revisions within a batch.
- Share one gallery component between `/gallery` and `/live`.
- Support historical browsing after browser refreshes and Web UI restarts.
- Preserve progressive Live updates while a batch is generating.
- Keep training operational when gallery persistence fails.

## Non-Goals

- Modifying core OneTrainer code or callback contracts.
- Moving, renaming, deleting, or importing files from core sample output.
- Importing native UI, CLI, or pre-existing sample history.
- Displaying video or audio sampler outputs.
- Showing the actual randomized seed when core does not expose it.
- Gallery deletion, retention policies, ratings, or comparison sliders.
- Reconciliation scanning of core output after missed callbacks.
- Coordinating prompt-file edits made outside the Web UI during an active sampling batch.

## Existing Behavior And Constraints

- Core saves its packed config to `<workspace>/config/<save_filename_prefix><timestamp>.json`.
- Core saves default samples below `<workspace>/samples/<source-index> - <safe-prompt>/`.
- `GenericTrainer.__sample_during_training` reloads `sample_definition_file_name` for each default batch when `config.samples` is `None`.
- `GenericTrainer` calls `on_update_status("Sampling ...")` immediately before loading those definitions.
- Core normalizes each definition through `SampleConfig` and applies `SampleConfig.from_train_config` before generation.
- The Web UI receives each successful default output through `TrainCallbacks.on_sample_default` after core saves it.
- `ModelSamplerOutput` exposes file type, data, and filepath, but not reliable prompt or actual random-seed metadata.
- The core sample directory name exposes the source prompt index. The ` - no-ema` postfix distinguishes non-EMA output.
- The current Web UI re-saves PIL callback data as PNG in repository-root `training_samples`; that generated-image write is incorrect and will be removed.
- `training_samples/samples.json` remains a valid existing prompt-definition file and is not relocated by this feature.

## Architecture

### Gallery Service

A Web UI-only gallery service owns run discovery, prompt revisions, batch records, mirrored files, thumbnails, manifest persistence, and safe image lookup. `TrainingService` passes training lifecycle and sample callback data to this service.

The gallery service is best-effort. It reports persistence failures through logs and Web UI events but never raises them into the training loop.

### Sampling Coordinator

A Web UI sampling coordinator serializes sample-definition updates with sampling lifecycle transitions. It uses the existing `on_update_status` callback; no core hook is added.

When status changes to `Sampling ...`, the coordinator:

1. Acquires the prompt-update lock.
2. Marks sampling active before another Web UI request can write the definition file.
3. Reads the currently applied definitions.
4. Backfills missing stable Web UI prompt IDs and atomically writes them before core reads the same file.
5. Normalizes the definitions with the active model defaults and train-config overlays, then captures or reuses the content-addressed prompt revision.
6. Opens a new batch with the current training progress and expected enabled prompt IDs.
7. Releases the lock while keeping writes gated for the duration of the batch.

When status leaves `Sampling ...`, or training cleanup runs, the coordinator atomically applies the latest queued definitions and clears the sampling state. Multiple mid-batch edits collapse to the latest submitted set.

Queued definitions are also written atomically to a transient sibling of the configured definition file named `<sample-definition-file>.webui-pending`. The pending file is removed after application. On Web UI startup, an unapplied pending file for the currently configured definition file is applied before another Web UI training run can start, so an acknowledged prompt edit is not lost to a process interruption.

The sampling endpoint and the periodic core schedule use the same coordinator lifecycle. An edit completed before the next `Sampling ...` transition is used by that batch. An edit submitted after the transition is explicitly queued for the following batch.

### Stable Prompt Identity

Every sample definition managed by the Web UI has a `webui_id` string. Existing definitions receive an ID on their next Web UI read, write, or sampling capture. Core's `BaseConfig.from_dict` ignores unknown keys, so the field does not change core sampling behavior.

- Editing a prompt preserves `webui_id`.
- Cloning or adding a prompt creates a new ID.
- Duplicate or missing IDs are replaced before persistence.
- Deleting or reordering prompts does not change surviving IDs.
- If an external editor removes an ID, the Web UI assigns a new one rather than guessing lineage.

Modal navigation treats one `webui_id` as a continuous timeline even when its prompt text or generation settings change. Each image still resolves metadata from the exact revision used for its batch.

### Run Identity

At Web UI training start, the gallery service records:

- The resolved workspace directory.
- The configured filename prefix.
- The training start time.
- File signatures for existing JSON files in `<workspace>/config`.

Before the first batch is opened, the service resolves the config JSON created or changed by this training start. It filters by prefix and start time, then uses the selected file's exact stem as `run_key`. This preserves custom prefixes and the core timestamp format. One Web UI service permits only one active training run, and native/CLI run discovery is out of scope.

If no unambiguous core config file can be resolved, gallery persistence is disabled for that run with a visible warning; the service never invents a key that could associate images with the wrong config.

## Persistent Layout

For a core config named `workspace/run/config/2026-07-26_11-17-26.json`, the Web UI writes:

```text
workspace/run/web/samples/2026-07-26_11-17-26/
  manifest.json
  prompts.json
  000001-step-000000000-prompt-000-ema.png
  000001-step-000000000-prompt-000-ema-thumb.webp
  000001-step-000000000-prompt-001-ema.png
  000001-step-000000000-prompt-001-ema-thumb.webp
  000002-step-000000100-prompt-000-ema.png
  000002-step-000000100-prompt-000-ema-thumb.webp
```

The example assumes EMA is active. When EMA is off, primary filenames use `base` instead of `ema`. The full-size file is copied from `sampler_output.filepath`, preserving exact bytes and extension. It is never re-encoded. A bounded WebP thumbnail is generated for card display. Both are finalized with a temporary file and atomic rename.

The monotonic batch number prevents collisions when `Sample Now` is invoked repeatedly at the same progress. The prompt number is the source index for readability only; `webui_id` in the manifest is authoritative. Non-EMA filenames use `non-ema` instead of `ema`.

## Prompt Revision Schema

`prompts.json` is an append-only store scoped to one gallery run:

```json
{
  "schema_version": 1,
  "revisions": {
    "sha256:<canonical-json-hash>": {
      "captured_at": "2026-07-26T11:18:02Z",
      "prompts": [
        {
          "webui_id": "prompt_<uuid>",
          "source_index": 0,
          "enabled": true,
          "prompt": "Studio portrait, soft light",
          "negative_prompt": "artifacts, text",
          "width": 1024,
          "height": 1024,
          "diffusion_steps": 20,
          "cfg_scale": 7.0,
          "seed": 42,
          "noise_scheduler": "EULER_A"
        }
      ]
    }
  }
}
```

The revision hash uses canonical JSON for the complete ordered effective definition list after ID normalization. Known fields are normalized through the existing `SampleConfig` defaults and `from_train_config` behavior so inherited settings match core generation. Stable IDs, source indexes, and unknown source fields are retained as Web UI metadata. Disabled definitions remain in the revision so source indexes and historical state are exact. A batch's `expected_prompt_ids` contains only enabled definitions.

The schema preserves all sample-definition fields, not only the fields shown above. Unknown fields survive capture so model-specific settings are not discarded.

## Manifest Schema

`manifest.json` is the source of truth for gallery discovery and display:

```json
{
  "schema_version": 1,
  "run": {
    "key": "2026-07-26_11-17-26",
    "config_filename": "2026-07-26_11-17-26.json",
    "started_at": "2026-07-26T11:17:26Z"
  },
  "batches": [
    {
      "id": 1,
      "sampled_at": "2026-07-26T11:18:02Z",
      "epoch": 1,
      "epoch_step": 0,
      "global_step": 0,
      "prompt_revision_id": "sha256:<canonical-json-hash>",
      "expected_prompt_ids": ["prompt_<uuid>"],
      "expected_variants": ["ema", "non_ema"],
      "samples": [
        {
          "webui_prompt_id": "prompt_<uuid>",
          "source_index": 0,
          "variant": "ema",
          "status": "ready",
          "filename": "000001-step-000000000-prompt-000-ema.png",
          "thumbnail_filename": "000001-step-000000000-prompt-000-ema-thumb.webp",
          "width": 1024,
          "height": 1024
        }
      ]
    }
  ]
}
```

Variant is `base` when EMA is off, `ema` for the primary pass when EMA is active, and `non_ema` for the optional additional pass. `expected_variants` is derived from the active training config, allowing the frontend to infer every expected prompt/variant slot before callbacks arrive.

Sample status is `pending`, `ready`, `unavailable`, or `error`. A new batch begins at the status transition rather than being inferred from step values, so repeated same-step samples are always separate. At the end of sampling, expected slots that received no successful callback become `unavailable`; gallery persistence failures become `error`. EMA and non-EMA callbacks join the same batch as separate variants.

The configured seed comes from the prompt revision. When `random_seed` is enabled or the configured value is a random sentinel, the UI displays `Random`; the design does not claim an actual generated seed that core did not expose.

`prompts.json` and `manifest.json` are replaced atomically under a per-run lock. Prompt revision persistence precedes any manifest reference to that revision. Image and thumbnail finalization precede a sample's transition to `ready`.

## Callback Data Flow

```text
Web UI/core status: Sampling ...
  -> freeze applied definitions and open batch
  -> core reloads the same definition file
  -> core generates and saves original sample
  -> Web UI default-sample callback receives filepath
  -> parse source index from the core path and resolve variant from the path plus active config
  -> resolve stable prompt ID from batch revision
  -> mirror exact image and create thumbnail
  -> atomically update manifest
  -> emit enriched training_sample event
  -> frontend invalidates/refetches active gallery query
```

An unexpected path that cannot be associated with the captured revision is recorded as an unassigned error and logged rather than attached to the wrong prompt. Unsupported media is ignored by the image gallery and remains untouched in core output.

## Web UI API

All endpoints are under the existing `/api` prefix.

- `GET /gallery/runs` returns valid run summaries sorted newest first.
- `GET /gallery/runs/{run_key}` returns the validated manifest and referenced prompt revisions as one normalized display model.
- `GET /gallery/current` returns the active Web UI run, or an empty active-gallery state before its first batch.
- `GET /gallery/runs/{run_key}/images/{filename}` serves only ready image or thumbnail filenames referenced by that run's manifest.
- `GET /samples` returns the latest submitted definitions and whether they are queued.
- `PUT /samples` assigns and validates prompt IDs, then either applies definitions atomically or durably queues them for the next batch.

Run keys and filenames are treated as identifiers, not arbitrary paths. The backend resolves and verifies containment beneath the active workspace gallery root. Image responses set the detected MIME type, ETag, and immutable cache headers. Unknown runs, unreferenced filenames, missing files, traversal attempts, and non-image media are rejected.

Run discovery scans only direct subdirectories of `<workspace>/web/samples`. A missing, invalid, corrupt, or unsupported manifest is skipped with a warning and does not prevent other runs from loading. Core sample directories are never scanned.

## Frontend Design

### Navigation And Route

The new `/gallery` route has the navigation label `Gallery` directly below `Live`. It selects the active run while training and otherwise selects the newest valid run. A run dropdown lists exact config keys, newest first.

The Live route has no run selector and always requests `/api/gallery/current`.

### Shared Gallery Component

One shared gallery component receives a normalized run model. It owns checkpoint groups, variant sub-rows, cards, progressive states, empty/error states, and the image viewer.

- Checkpoints are ordered chronologically from top to bottom.
- The left label shows epoch, global step, and sampling time.
- EMA and non-EMA are labeled sub-rows when both exist; a lone base or EMA row needs no redundant label.
- On wide screens, each variant row has one column per enabled prompt in that batch.
- On narrow screens, cards wrap within their checkpoint group, normally to two columns and then one at the smallest width.
- A generating Live batch shows completed cards immediately and pending placeholders for expected outputs.
- Every ready card shows a thumbnail, the exact revision's prompt caption, and an overlay with resolution, sampling steps, CFG, and configured seed or `Random`.
- Missing or failed files remain visible as unavailable/error cards.

Cards use lazy-loaded thumbnails. Rows use `content-visibility` to avoid eager layout work for long histories.

### Image Viewer

Selecting a card opens an accessible modal with the full mirrored image and exact historical metadata, including prompt, negative prompt, scheduler, dimensions, steps, CFG, configured seed, epoch, step, timestamp, and model variant.

The modal timeline is filtered by `webui_id` and variant. It continues across prompt edits, skips checkpoints where that prompt has no ready image while showing those gaps in its timeline, and never mixes base, EMA, or non-EMA output.

- Left/right buttons and keyboard arrows move to the previous/next available checkpoint.
- Controls disable at the first and latest available image; navigation does not wrap.
- Horizontal swipe provides the same action on touch devices.
- `Escape` closes the modal.
- Focus is trapped while open and restored to the originating card on close.
- Adjacent full-size images are prefetched.
- An `Open original` action opens the immutable full-size image endpoint.
- A revision-change indicator appears when adjacent images use different prompt revisions.

## Failure Handling

Gallery failures never abort or pause training.

- Image copy failure records an error sample when the manifest remains writable and emits a Web UI warning.
- Thumbnail failure may fall back to the full image for that card while retaining an error detail in the manifest.
- Manifest persistence failure emits a warning and leaves the core file untouched.
- Prompt revision persistence must succeed before a batch can be mirrored; failure disables gallery persistence for that batch rather than recording incorrect metadata.
- Pending prompt updates are flushed on normal sampling completion, sampling failure, stop, and training cleanup.
- A corrupt historical run is isolated and omitted rather than breaking the run list.
- A missing historical image renders an unavailable card and cannot be opened.
- An unresolvable prompt association is never guessed.

Warnings are concise user-facing toasts for active-run failures and detailed server logs for diagnosis.

## Testing Strategy

### Python Service Tests

- Resolve exact config keys, including custom prefixes and changed same-name files.
- Reject ambiguous or missing config identity without affecting training.
- Backfill, preserve, and de-duplicate `webui_id` values.
- Create and reuse canonical prompt revisions.
- Normalize effective prompt settings with model defaults and active train-config overlays.
- Preserve unknown prompt fields and disabled definitions.
- Apply edits before sampling to the next batch.
- Queue edits during sampling and flush only after the batch.
- Recover and apply a durable pending edit after service restart.
- Keep one revision across EMA and non-EMA callbacks.
- Create separate batches for repeated same-step sampling.
- Transition unresolved expected prompt/variant slots from pending to unavailable when sampling ends.
- Map source indexes from core paths and resolve base/EMA/non-EMA variants from the path plus active config.
- Copy exact source bytes and atomically create thumbnails/manifests.
- Record random seed as configured `Random`, not an invented seed.
- Handle concurrent callbacks, copy failures, invalid paths, and unsupported media.
- Prove core output is unchanged and no generated image is written to `training_samples`.

### Router Tests

- List valid runs newest first and omit corrupt manifests.
- Return active, empty-active, and historical run models.
- Return queued prompt-update state.
- Serve only manifest-referenced files with correct MIME, ETag, and cache headers.
- Reject traversal, unknown runs, unreferenced files, missing files, and non-image media.

### Frontend Tests

- Render chronological checkpoint groups and dynamic prompt columns.
- Render EMA and non-EMA variant sub-rows.
- Wrap cards responsively without separating them from their checkpoint label.
- Render exact per-revision captions, overlays, pending, unavailable, and error states.
- Select active/newest/historical runs on `/gallery`.
- Omit the selector and bind to the active run on `/live`.
- Refetch progressive batches after training-sample events.
- Show queued prompt-update feedback in the Sampling route.
- Navigate the modal by stable prompt ID and variant across prompt edits.
- Disable endpoint controls, avoid wrapping, and handle buttons, arrows, swipe, and `Escape`.
- Restore focus, show revision changes, tolerate missing checkpoints, and prefetch adjacent images.

### Integration And Build Verification

- Simulate a Web UI-started training run in a temporary workspace using existing callback interfaces.
- Edit prompts before and during sampling and verify each image resolves to the correct revision.
- Verify repeated manual sampling and EMA variants produce distinct, correctly grouped records.
- Run focused Web UI Python tests.
- Run focused Svelte/Vitest tests, then the complete Web UI test suite.
- Build the production frontend.

## Acceptance Criteria

- No core source file is modified.
- Core config and sample outputs remain unchanged.
- The Web UI no longer writes generated images to `training_samples`.
- A Web UI-started run creates one gallery directory whose name exactly matches the core config stem.
- Successful still-image callbacks create flat, uniquely named mirrored images and thumbnails.
- Every ready image resolves to the exact prompt revision used by its batch.
- Prompt edits made outside sampling affect the next batch; edits made during sampling are queued for the following batch.
- Browser refresh and Web UI restart retain valid historical galleries.
- `/gallery` browses current and previous Web UI runs by config key.
- `/live` uses the same component and remains fixed to the current run.
- Rows display progress labels and progressive sample states.
- EMA and non-EMA outputs appear as separate sub-rows when both are configured.
- Modal navigation follows one stable prompt and variant across checkpoints, stops at both ends, and supports accessible controls.
- Gallery persistence failures do not interrupt training.
