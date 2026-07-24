# Design Specification: Concept Editor Dataset Picker Modal

## Overview
When creating or editing a Concept in OneTrainer Web UI (`Concepts` route), users need an intuitive way to select from their existing dataset gallery instead of manually typing or browsing raw file paths. This design introduces a dedicated `DatasetPickerModal.svelte` component that presents the visual dataset cards gallery and populates the selected dataset's directory path into the Concept's `path` field.

---

## User Experience & Interaction Flow

1. **Triggering the Picker**:
   - In `ConceptDetailModal.svelte`, alongside the `Dataset Directory Path` input field, a **"Select Dataset"** button is rendered (with a `FolderKanban` icon).
   - Clicking **"Select Dataset"** opens `DatasetPickerModal.svelte`.

2. **Dataset Picker Modal Interface**:
   - **Modal Header**: Title `"Select Dataset"`.
   - **Modal Body**: Displays a grid of dataset cards loaded from `GET /api/datasets`.
   - **Dataset Card View**:
     - Image thumbnail preview (or dark fallback if empty).
     - Gradient overlay with dataset name.
     - Subtitle showing `{image_count} images • {caption_count} captions`.
     - Active selection state: Blue border (`var(--accent)`) with a checkmark badge in the top-right corner.
   - **Selection Actions**:
     - **Single-Click**: Selects the dataset card (enables the "Select Dataset" footer button).
     - **Double-Click**: Immediately confirms the dataset selection and closes the modal.
     - **Footer Actions**:
       - **Cancel**: Closes modal without altering the path.
       - **Select Dataset (OK)**: Confirms the highlighted dataset path and updates `draft.path` in the concept editor.

3. **Empty State Handling**:
   - If no datasets exist in the workspace, displays an empty state: *"No datasets found. Create a dataset in the Datasets tab first."* with a link/button to `/datasets`.

---

## Architecture & Component Design

### 1. `web/src/lib/components/datasets/DatasetPickerModal.svelte` [NEW]
- **Props**:
  - `open: boolean` — controls modal visibility.
  - `currentPath?: string` — pre-selects dataset matching this path if present.
  - `onSelect: (selectedPath: string) => void` — callback triggered when a dataset is confirmed.
  - `onClose: () => void` — callback triggered when modal is cancelled or closed.
- **State**:
  - `datasets: DatasetItem[]` — loaded asynchronously from `GET /api/datasets`.
  - `selectedDataset: DatasetItem | null` — currently highlighted dataset item.
  - `loading: boolean` — loading state for dataset fetching.

### 2. `web/src/lib/components/concepts/ConceptDetailModal.svelte` [MODIFY]
- State: `showDatasetPicker = $state(false)`.
- UI: Next to `Dataset Directory Path`, render `<button type="button" class="btn-select-dataset" onclick={() => (showDatasetPicker = true)}>... Select Dataset</button>`.
- Render `<DatasetPickerModal open={showDatasetPicker} currentPath={draft.path} onSelect={(path) => { draft.path = path; showDatasetPicker = false; }} onClose={() => (showDatasetPicker = false)} />`.

---

## Testing & Verification Plan

1. **Unit Tests (`DatasetPickerModal.test.ts`)**:
   - Verify modal opens and renders dataset cards loaded from `/api/datasets`.
   - Verify single-click highlights card and enables Select button.
   - Verify double-click triggers `onSelect` with dataset path.
   - Verify Cancel button triggers `onClose` without calling `onSelect`.

2. **Integration Tests (`ConceptDetailModal.test.ts`)**:
   - Verify "Select Dataset" button renders in Concept detail form.
   - Verify clicking "Select Dataset" opens picker modal and populates `draft.path` upon selection.

3. **Build & Regression Checks**:
   - Run Vitest suite (`cd web && bun run test`).
   - Run production static build (`cd web && bun run build`).
