# Live Actions & Backup Route Native Parity Design Spec

## Executive Summary

This specification details the design for bringing full Native UI parity to live training execution actions in the Svelte Web UI by adding **`Sample Now`**, **`Backup Now`**, and **`Save Model Now`** action controls to both the **Live Training Dashboard** (`web/src/routes/live/+page.svelte`) and target configuration routes (**Backup** and **Sampling**).

---

## 1. Backend & API Extensions

### 1.1 `TrainingService` (`modules/webui/training.py`)

- Add `request_save(self)` method setting `self._save_requested = True`.
- In `_run_training_loop`, when `self._save_requested` is set, trigger model saving and reset flag to `False`.

### 1.2 Router Endpoints (`modules/webui/routers/training.py`)

- Expose `POST /api/training/save` returning `{"status": "ok"}` when `app_state.training_service.request_save()` succeeds (raising HTTP 409 if training is not active).

### 1.3 Query Client Mutations (`web/src/lib/api/queries.ts`)

- `createRequestSampleMutation()` (`POST /api/training/sample`)
- `createRequestBackupMutation()` (`POST /api/training/backup`)
- `createRequestSaveMutation()` (`POST /api/training/save`)

---

## 2. Frontend Layout & Action Bars

### 2.1 Live Training Dashboard (`web/src/routes/live/+page.svelte`)

- Add header action bar next to status badge:
  - **`Sample Now`** (Sparkles icon)
  - **`Backup Now`** (Archive icon)
  - **`Save Model Now`** (Save icon)
- **State & Guard**:
  - Enabled when `$trainingStore.status.state === 'RUNNING'`.
  - Disabled when idle with tooltip *"Active training run required"*.
  - Show temporary confirmation badge on click ("Sample requested!", "Backup requested!", "Save requested!").

### 2.2 Backup Route (`web/src/routes/backup/+page.svelte`)

- Add top header action bar with **`Backup Now`** and **`Save Model Now`**.
- Render standard 740px options panel with backup/save configuration fields.

### 2.3 Sampling Route (`web/src/routes/sampling/+page.svelte`)

- Add top header action bar with **`Sample Now`**.

---

## 3. Verification Plan

1. **Backend Tests**:
   - Add unit test for `request_save()` and `POST /api/training/save` in `tests/webui/test_training_api.py`.
   - Run `PYTHONPATH=. pytest tests/webui/ -v`.
2. **Frontend Tests**:
   - Add unit tests for Live, Backup, and Sampling page action buttons.
   - Run `cd web && bun run test`.
3. **Production Static Build**:
   - Run `cd web && bun run build`.
