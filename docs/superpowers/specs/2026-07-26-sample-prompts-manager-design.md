# Sample Prompts Manager Design Spec

## Executive Summary

This specification details the design for introducing a full **Sample Prompts Manager** to the Web UI's `/sampling` route. It provides feature parity with the native UI, using the unified card grid layout with `<AddCard title="Add Sample Prompt" />` (matching Concepts and Datasets), a compact top options panel, and a detailed `<SampleDetailModal />`.

---

## 1. Architecture & API Endpoints

### 1.1 `ConfigService` (`modules/webui/config_service.py`)

- **`get_sample_definitions(self) -> list`**:
  - Resolves `self._config.sample_definition_file_name` relative to active workspace/working directory.
  - Returns sample configuration dicts loaded from `samples.json` (or `[]` if file doesn't exist or is empty).
- **`update_sample_definitions(self, samples: list) -> list`**:
  - Atomically writes sample dicts to `sample_definition_file_name` via `write_json_atomic`.
  - Updates `self._config.samples` in memory.
  - Returns updated sample list.

### 1.2 Router Endpoint (`modules/webui/routers/samples.py`)

- `GET /api/samples`: Calls `config_svc.get_sample_definitions()` and returns `{"samples": [...]}`.
- `PUT /api/samples`: Accepts sample array and calls `config_svc.update_sample_definitions(samples)`. Returns `{"samples": [...]}`.

---

## 2. Frontend Components & Layout

### 2.1 Sampling Route (`web/src/routes/sampling/+page.svelte`)

- **Header**: Title `"Sampling"` and **`Sample Now`** button.
- **Top Options Panel**: Compact, 740px max-width container rendering sampling parameters (*Sample File Path*, *Sample After*, *Sample Skip First*, *Format*, *TensorBoard Log*).
- **Section Header**: `"Sample Prompts"` with count badge.
- **Sample Prompts Grid**:
  - First Card: `<AddCard title="Add Sample Prompt" onClick={handleAddSample} />`.
  - Sample Cards Grid: Each card features:
    - Top bar: Enable/Disable toggle switch, Edit button, Clone button, Delete button (`e.stopPropagation()`).
    - Body: Prompt snippet preview text, Negative prompt snippet preview text.
    - Badges: `Width × Height`, `Steps`, `CFG`, `Seed`, `Scheduler`.
    - Click: Opens `<SampleDetailModal />`.

### 2.2 Sample Detail Modal (`web/src/lib/components/sampling/SampleDetailModal.svelte`)

- Modal window for creating and editing a sample configuration:
  - **Prompt**: `<textarea>`
  - **Negative Prompt**: `<textarea>`
  - **Enabled**: toggle switch
  - **Width** & **Height**: `<input type="number">` with quick resolution preset buttons (`512`, `768`, `1024`)
  - **Diffusion Steps**: `<input type="number">` (default 30)
  - **CFG Scale**: `<input type="number">` (default 7.0 or 7.5)
  - **Seed**: `<input type="number">` (default -1)
  - **Noise Scheduler**: `<select>` dropdown (`EULER_A`, `DDIM`, `EULER`, `DPM_PLUS_PLUS_2M_KARRAS`, etc.)

---

## 3. Verification Plan

1. **Backend Tests**:
   - Create `tests/webui/test_samples_router.py` testing `GET /api/samples` and `PUT /api/samples`.
   - Run `PYTHONPATH=. pytest tests/webui/test_samples_router.py -v`.
2. **Frontend Tests**:
   - Create `web/src/lib/components/sampling/SampleDetailModal.test.ts` testing modal input bindings.
   - Update `web/src/routes/sampling/SamplingPage.test.ts` testing grid rendering, Add Card click, and modal interactions.
   - Run `cd web && bun run test`.
3. **Production Static Build**:
   - Run `cd web && bun run build`.
