# Live Actions Wiring & Sample Prompts Validation Design Spec

## Executive Summary

This specification details the design for wiring Web UI live execution actions (**`Sample Now`**, **`Backup Now`**, **`Save Model Now`**) directly to PyTorch `TrainCommands` and validating sample prompt availability before requesting live samples.

---

## 1. Backend Wiring & Validation

### 1.1 `TrainingService` (`modules/webui/training.py`)

- **`_has_sample_definitions(self) -> bool`**:
  - Checks if `self._active_train_config.samples` list is non-empty.
  - OR resolves `self._active_train_config.sample_definition_file_name` relative to workspace/working directory. If file exists on disk, parses JSON and returns `len(json.load(f)) > 0`.
  - Returns `False` if neither condition is met or file parsing fails.

- **`request_sample(self)`**:
  - Verifies training state is `TRAINING` or `PAUSED`.
  - Checks `self._has_sample_definitions()`. If `False`, raises `RuntimeError("No sample prompts configured in sample definitions file (training_samples/samples.json)")`.
  - If `self._train_commands` exists, invokes `self._train_commands.sample_default()`.

- **`request_backup(self)`**:
  - Verifies training state is `TRAINING` or `PAUSED`.
  - If `self._train_commands` exists, invokes `self._train_commands.backup()`.

- **`request_save(self)`**:
  - Verifies training state is `TRAINING` or `PAUSED`.
  - If `self._train_commands` exists, invokes `self._train_commands.save()`.

---

## 2. API & Frontend Error Messaging

### 2.1 FastAPI Router (`modules/webui/routers/training.py`)

- `POST /api/training/sample`, `POST /api/training/backup`, `POST /api/training/save`:
  - Catch `RuntimeError` from `TrainingService` and raise `HTTPException(status_code=409, detail=str(e))`.

### 2.2 Frontend Route Handling

- In `web/src/routes/live/+page.svelte`, `backup/+page.svelte`, and `sampling/+page.svelte`:
  - Catch API error response on mutation failure and display red toast: `"Cannot request sample: No sample prompts configured in sample definitions file"`.

---

## 3. Verification Plan

1. **Backend Tests**:
   - Test `_has_sample_definitions()` and `request_sample()` throwing `RuntimeError` when sample definition file is missing or empty `[]`.
   - Test `request_sample()` calling `train_commands.sample_default()` when sample definition file contains prompts.
   - Run `PYTHONPATH=. pytest tests/webui/test_training_api.py tests/webui/test_training_service.py -v`.
2. **Frontend Tests**:
   - Test `Live`, `Backup`, and `Sampling` routes handling mutation error responses with red error toast.
   - Run `cd web && bun run test`.
3. **Production Static Build**:
   - Run `cd web && bun run build`.
