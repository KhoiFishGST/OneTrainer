# Native-Parity Sampling Route Redesign Specification

**Date:** 2026-07-27  
**Status:** Approved by User  

---

## 1. Executive Summary

Redesign the Web UI **Sampling Route** (`/sampling`) to achieve 100% parity with OneTrainer's native PySide6/CustomTkinter UI features while upgrading the user experience with modern Web UI controls and styling. 

Key enhancements:
1. **Sample Configuration Selector**: Support multiple `.json` sample files in `training_samples/` via a dropdown list and `+ New Config` action.
2. **Dense Spreadsheet Prompt Table (`SamplePromptTable.svelte`)**: Replace chunky prompt cards with a responsive, high-density table.
3. **Tailored Inline Controls**: Direct inline editing for active state, width, height, seed (with a 1-click Random Seed dice toggle), and prompt text (allocated maximum available width).
4. **Full Parameter Modal**: Retain `SampleDetailModal.svelte` for deep editing of negative prompts, guidance scale, steps, sampler, and EMA options.

---

## 2. System Architecture & Endpoints

### 2.1 Backend Router (`modules/webui/routers/samples.py`)

- `GET /api/samples/files`: Returns list of `.json` sample files present in `<workspace>/training_samples/` (e.g. `["samples.json", "custom_samples.json"]`).
- `POST /api/samples/files`: Accepts `{"name": "filename.json"}` to create a new sample JSON file in `training_samples/` initialized with default prompt definitions.
- `GET /api/samples?file=<filename>`: Retrieves sample prompt definitions from the specified file (or defaults to `sample_definition_file_name` in `TrainConfig`).
- `PUT /api/samples?file=<filename>`: Saves prompt definitions to the active sample file.

### 2.2 Frontend Contracts & Store Integration (`web/src/lib/api`)

- `getSampleFiles()`: Queries `/api/samples/files`.
- `createSampleFile(name)`: Mutates `/api/samples/files`.
- `sample_definition_file_name` binding in workspace draft triggers invalidation of `$samplesQuery`.

---

## 3. UI Layout & Component Architecture

### 3.1 Top Controls Bar

Located above the **Sample Prompts** table:
- **Config Dropdown**: `<Select>` displaying available `.json` files in `training_samples/`.
- **Add Config Button**: Opens a modal or prompt to create a new `.json` sample file.
- **Generate Sample Button**: `<button class="btn btn-primary">` with `<Sparkles size={16} />` to trigger immediate sample generation.

### 3.2 Spreadsheet Table Component (`web/src/lib/components/sampling/SamplePromptTable.svelte`)

Renders a clean, dense table structure:

| Column Header | Width Allocation | Interactive Elements |
|---|---|---|
| **Active** | `44px` (fixed) | Checkbox / Toggle switch |
| **Width** | `68px` (fixed) | Compact `<input type="number">` (e.g., 512) |
| **Height** | `68px` (fixed) | Compact `<input type="number">` (e.g., 512) |
| **Seed** | `116px` (fixed) | Compact `<input type="number">` (`84px`) + Dice toggle button (`28px`, sets `-1`) |
| **Prompt** | **Flex 1 (Max Available)** | `<input type="text">` or auto-expanding input for full prompt readability |
| **Actions** | `100px` (fixed) | Details (`...`), Clone (`+`), Delete (`Trash`) |

### 3.3 Add Prompt Row

At the bottom of the prompt table, a prominent **`+ Add Sample Prompt`** button row allows 1-click creation of new prompts.

---

## 4. Verification & Testing

- **Backend Pytest**: `PYTHONPATH=. python -m pytest tests/webui -v` validating `/api/samples/files` endpoints and multi-file persistence.
- **Frontend Vitest & Build**: `bun run check && bun run test && bun run build` validating table row rendering, inline edit debouncing, and modal integration.
