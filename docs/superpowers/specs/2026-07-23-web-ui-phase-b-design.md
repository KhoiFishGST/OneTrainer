# OneTrainer Web UI Phase B Design

Status: approved

Date: 2026-07-23

## 1. Purpose

This document specifies Phase B of the OneTrainer Web UI, building directly upon the Phase A foundation established in `docs/superpowers/specs/2026-07-22-web-ui-phase-a-design.md`. 

While Phase A delivered the core server infrastructure, console streaming, preset management, and initial configuration tabs (General, Data, Backup), Phase B achieves **complete configuration surface parity** with native OneTrainer. 

Upon completion of Phase B, users will be able to configure every setting available in OneTrainer—including Model setup, Training hyperparameters, Optimizer/Scheduler modal sub-configs, Sampling parameters, LoRA/Embedding networks, and rich Multi-Concept dataset definitions—directly through the web interface with full validation and automated CI schema coverage enforcement.

---

## 2. Scope

### 2.1 Included

1. **Complete Schema Coverage (`modules/webui/schema.py`)**:
   - Schema registry declarations for all remaining `TrainConfig` domains: `Model`, `Training`, `Sampling`, `LoRA/Embedding`, and `Concepts`.
   - Dynamic parameter schemas for all supported Optimizers (AdamW, Prodigy, CAME, 8-bit Adam, Lion, Adafactor, SGD, etc.) and LR Schedulers (Cosine, Linear, Polynomial, Constant with Warmup, Exponential, etc.).
   - Conditional field visibility logic based on active model architecture (SD 1.5, SDXL, Flux, SD3, Pony) and training methods (Full, LoRA, Embedding).

2. **Unified File & Directory Picker (`PathInput.svelte` & `/api/fs/list`)**:
   - Upgraded filesystem API supporting file and directory mode flags (`file`, `directory`, `both`) and extension mask filtering (e.g. `.safetensors`, `.ckpt`, `.pt`, `.json`, `.txt`).
   - Svelte `PathInput` component with absolute path text entry, file/directory browse modal, breadcrumbs, extension chips, and file size/date metadata.

3. **Optimizer & Scheduler Sub-Config Modals**:
   - Modal trigger buttons in the Training tab for selected Optimizer and LR Scheduler algorithms.
   - Dynamic modal dialog rendering algorithm-specific hyperparameters with validation and workspace config persistence.

4. **All Remaining Configuration Tabs**:
   - **Model Tab (`/model`)**: Base model selection, model weight paths, VAE/Text Encoder overrides, precision options (fp16, bf16, fp32), CPU offloading.
   - **Training Tab (`/training`)**: Epochs/steps, batch sizes, learning rates, loss functions, optimizer selection + sub-config modal, scheduler selection + sub-config modal, gradient accumulation/checkpointing.
   - **Sampling Tab (`/sampling`)**: Sample prompt lists, image dimensions, CFG guidance scale, sample steps, seed, sampling intervals (epochs/steps), sample output directory.
   - **LoRA & Embedding Tab (`/lora-embedding`)**: Network rank (`dim`), network alpha, module type, target linear/conv layers, dropout, embedding tokens/vector settings.

5. **Interactive Concepts Tab & Dataset Editor (`/concepts`)**:
   - Table and card management view for concept list entries (Add, Remove, Duplicate, Reorder).
   - Detailed concept configuration form (Dataset path, Instance prompt, Class prompt, repeats, caption extensions, balancing weights).
   - Dataset preview panel displaying dataset file counts, thumbnail grid (via `/api/workspace/files`), and hover/drawer caption file previews.

6. **Validation Display & Conflict Handling**:
   - Real-time field-level error mapping from server validation endpoints to specific form inputs and navigation rail tab badges.
   - Debounced atomic config autosave (500ms) with revision header verification (`X-Config-Revision`).

7. **Schema Coverage CI Test (`tests/webui/test_schema_coverage.py`)**:
   - Automated introspection test asserting that 100% of non-deprecated `TrainConfig` dataclass fields are declared in `SchemaRegistry`.

8. **Comprehensive Automated Testing**:
   - Python unit tests for schema definitions, optimizer sub-schemas, file router parameters, and concept endpoints.
   - Frontend Vitest unit tests for new form controls and modal components.
   - Playwright E2E browser tests covering Phase B editing workflows.

### 2.2 Excluded

- Training lifecycle execution (Start, Stop, Pause, Live Progress) — *Phase C*.
- Live metrics, uPlot loss/LR charts, GPU monitoring, live sample gallery scrubber — *Phase C*.
- Cloud tab & cloud reattach dialogs — *Phase C*.
- Tools tab (dataset captioning/masking, model conversion tools) — *Phase D*.
- Light theme tokens — *Phase D*.

---

## 3. Backend Specification (`modules/webui/`)

### 3.1 Schema Registry Expansion (`modules/webui/schema.py`)

`SchemaRegistry` is expanded with descriptors for all Phase B domains:

```python
# Field descriptor metadata extensions
@dataclass
class FieldSchema:
    name: str
    label: str
    control: str  # "text" | "number" | "toggle" | "select" | "path" | "modal_trigger"
    type: str     # "string" | "int" | "float" | "bool" | "list" | "dict"
    path_type: Optional[str] = None  # "directory" | "file" | "both"
    extensions: Optional[List[str]] = None  # e.g. [".safetensors", ".ckpt"]
    options: Optional[List[Dict[str, Any]]] = None
    default: Any = None
    tooltip: Optional[str] = None
    group: Optional[str] = None
    visible_if: Optional[str] = None
    modal_schema_key: Optional[str] = None  # Key for sub-schema lookup
```

#### Optimizer Parameter Sub-Schemas
- `adamw`: `weight_decay`, `betas` (tuple), `eps`, `amsgrad`
- `prodigy`: `d0`, `d_coef`, `growth_rate`, `decouple`, `weight_decay`, `use_bias_correction`
- `came`: `weight_decay`, `betas` (3-tuple), `eps1`, `eps2`
- `adamw_8bit` / `lion_8bit`: `weight_decay`, `betas`, `eps`, `percentile_clipping`
- `adafactor`: `scale_parameter`, `relative_step`, `warmup_init`, `decay_rate`

#### Scheduler Parameter Sub-Schemas
- `cosine`: `warmup_steps`, `eta_min`
- `linear`: `warmup_steps`, `end_factor`
- `polynomial`: `warmup_steps`, `power`, `eta_min`
- `constant_with_warmup`: `warmup_steps`

### 3.2 File Router Enhancements (`modules/webui/routers/directories.py`)

Upgrade `/api/fs/list` endpoint parameters:
- `path` (str, default: workspace or root)
- `mode` (`"dir"` | `"file"` | `"both"`, default: `"both"`)
- `extensions` (List[str], optional e.g. `[".safetensors", ".ckpt"]`)
- `show_hidden` (bool, default: False)

Response format:
```json
{
  "current_path": "/home/user/models",
  "parent_path": "/home/user",
  "entries": [
    {
      "name": "v1-5-pruned.safetensors",
      "path": "/home/user/models/v1-5-pruned.safetensors",
      "is_dir": false,
      "size_bytes": 4265380120,
      "modified": 1721654300
    }
  ]
}
```

### 3.3 Schema Coverage CI Test (`tests/webui/test_schema_coverage.py`)

A dedicated pytest suite introspects `TrainConfig` dataclass fields and verifies every field is mapped in `SchemaRegistry`:

```python
def test_all_train_config_fields_covered():
    config_fields = {f.name for f in fields(TrainConfig)}
    schema_fields = set(SchemaRegistry.get_all_field_names())
    uncovered = config_fields - schema_fields - DEPRECATED_FIELDS
    assert not uncovered, f"Fields missing from SchemaRegistry: {uncovered}"
```

---

## 4. Frontend Specification (`web/src/lib/`)

### 4.1 UI Components

1. **`PathInput.svelte`**:
   - Absolute path text field + browse button.
   - Opens `FileDirectoryPickerModal` with extension filter tags and directory breadcrumbs.
   - Shows file metadata (size, last modified date) when hovering over selected path.

2. **`ModalDialog.svelte`**:
   - Reusable accessible modal dialog with backdrop blur, focus trap, Esc keyboard dismiss, and action controls (`Apply`, `Cancel`).

3. **`OptimizerSchedulerModal.svelte`**:
   - Sub-form modal bound to `ModalDialog`. Reads parameter sub-schema and edits nested optimizer/scheduler dictionary within `workspace.svelte.ts` config state.

4. **`ConceptsEditor.svelte` (`/concepts`)**:
   - Dual-pane or master-detail concepts layout:
     - Left/Top: Concept list summary table with controls (`+ Add Concept`, `Delete`, `Duplicate`).
     - Right/Bottom: Active concept form (Dataset folder path, Instance prompt, Class prompt, Repeats, Captions).
   - Dataset image grid preview pane rendering thumbnails from `/api/workspace/files` with hover text preview for caption files.

### 4.2 Route Structure

- `web/src/routes/model/+page.svelte`
- `web/src/routes/training/+page.svelte`
- `web/src/routes/sampling/+page.svelte`
- `web/src/routes/lora-embedding/+page.svelte`
- `web/src/routes/concepts/+page.svelte`

Navigation Rail (`web/src/lib/components/shell/Rail.svelte`) is updated to enable all corresponding icons and routes.

---

## 5. File Changes Map

### New Files
- `tests/webui/test_schema_coverage.py`
- `tests/webui/test_concepts_api.py`
- `web/src/lib/components/form/PathInput.svelte`
- `web/src/lib/components/form/PathInput.test.ts`
- `web/src/lib/components/ui/ModalDialog.svelte`
- `web/src/lib/components/ui/ModalDialog.test.ts`
- `web/src/lib/components/form/OptimizerSchedulerModal.svelte`
- `web/src/lib/components/concepts/ConceptsEditor.svelte`
- `web/src/lib/components/concepts/ConceptsEditor.test.ts`
- `web/src/routes/model/+page.svelte`
- `web/src/routes/training/+page.svelte`
- `web/src/routes/sampling/+page.svelte`
- `web/src/routes/lora-embedding/+page.svelte`
- `web/src/routes/concepts/+page.svelte`
- `web/tests/e2e/phase-b.spec.ts`

### Modified Files
- `modules/webui/schema.py`
- `modules/webui/directories.py`
- `modules/webui/routers/directories.py`
- `modules/webui/routers/config.py`
- `web/src/lib/components/shell/Rail.svelte`
- `web/src/lib/api/types.ts`
- `web/src/lib/api/client.ts`

---

## 6. Verification Plan

1. **Schema Coverage CI Check**:
   - `pytest tests/webui/test_schema_coverage.py` must pass with 100% field mapping.
2. **Backend Unit & Router Tests**:
   - `pytest tests/webui/` for all schema, router, file picker, and concepts API tests.
3. **Frontend Vitest Unit Suite**:
   - `cd web && bun test` covering component tests for `PathInput`, `ModalDialog`, and `ConceptsEditor`.
4. **Playwright E2E Integration Suite**:
   - `cd web && npx playwright test tests/e2e/phase-b.spec.ts` ensuring clean browser interaction across all Phase B tabs.
