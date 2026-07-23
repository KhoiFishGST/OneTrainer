# OneTrainer Web UI Phase C Design Specification

> **Phase C Goal:** Implement complete training lifecycle execution, live monitoring, interactive uPlot loss/LR charts, GPU resource tracking, sample gallery with scrubber, and seamless cloud/detached run reattach for the OneTrainer Web UI.

---

## 1. Overview & Architectural Strategy

Phase C extends the OneTrainer Web UI from a configuration surface into a fully functional, live-capable training interface.

### Key Principles
- **Immutable Launch Snapshot**: Before launching training, `TrainingService` takes a validated deep copy of `TrainConfig` from `ConfigService`. Edits made in the browser configuration forms after training starts will never mutate the active training run.
- **Integrated Service Architecture**: `TrainingService` operates as a singleton inside the FastAPI application context, executing training on a dedicated worker thread while broadcasting lifecycle and metric events to the Web UI.
- **Single Event Channel**: All real-time training updates (state, step progress, metrics, samples, GPU stats) stream over the single established WebSocket/SSE event bus. High-frequency metric updates are throttled at 10 Hz to prevent DOM/UI main-thread lag.
- **Automatic Seamless Reattach**: Upon page load or network reconnection, the client queries `/api/training/status`. If a training run is active, the UI automatically transitions to "Live Mode", populates metric ring buffer history, and streams live updates without interrupting training.

---

## 2. Backend Architecture & REST APIs

### 2.1 `TrainingService` (`modules/webui/training.py`)
- **Lifecycle State Machine**:
  - `IDLE`: No active training session.
  - `STARTING`: Validating config snapshot and initializing PyTorch models/data loaders.
  - `TRAINING`: Executing training loop.
  - `PAUSED`: Training loop paused at step boundary.
  - `STOPPING`: Graceful termination requested.
  - `COMPLETED`: Training finished successfully.
  - `FAILED`: Training halted due to exception (stack trace captured).
- **Metric Buffer**: In-memory ring buffer holding up to 10,000 metric entries (`step`, `epoch`, `loss`, `lr`, `timestamp`) for instant client sync upon reattach.
- **Sample Manager**: Tracks generated sample metadata and file locations on disk.
- **GPU Stats Monitor**: Samples `torch.cuda` memory (allocated, reserved, total) and GPU utilization/temperature at 1 Hz intervals.

### 2.2 REST Endpoints (`modules/webui/routers/training.py`)
- `POST /api/training/start`: Validates active draft config, creates immutable snapshot, and initiates training thread.
- `POST /api/training/stop`: Requests graceful training loop termination.
- `POST /api/training/pause`: Pauses training loop at next step.
- `POST /api/training/resume`: Resumes paused training loop.
- `POST /api/training/sample`: Requests immediate sample generation on next step.
- `POST /api/training/backup`: Triggers manual model checkpoint save.
- `GET /api/training/status`: Returns state, current step/total steps, epoch/total epochs, speed (it/s), elapsed time, ETA, and error message if failed.
- `GET /api/training/metrics`: Returns historical metric ring buffer array.
- `GET /api/training/samples`: Returns array of generated sample records (`sample_id`, `step`, `epoch`, `prompt`, `seed`, `url`).
- `GET /api/training/samples/{sample_id}/image`: Serves the sample image binary file from disk.
- `GET /api/training/gpu`: Returns current GPU VRAM (used/total), utilization %, and temperature.

---

## 3. Event Envelope & Real-Time Data Flow

The WebSocket event envelope (`modules/webui/events.py`) is extended with four new payload types:

1. **`training_state`**:
   ```json
   {
     "state": "TRAINING",
     "step": 450,
     "max_steps": 1000,
     "epoch": 5,
     "max_epochs": 10,
     "speed_its": 2.4,
     "eta_seconds": 230,
     "elapsed_seconds": 195
   }
   ```
2. **`training_metric`**:
   ```json
   {
     "step": 450,
     "epoch": 5,
     "loss": 0.0421,
     "lr": 0.00015,
     "timestamp": 1721700000
   }
   ```
3. **`training_sample`**:
   ```json
   {
     "id": "sample_450",
     "step": 450,
     "epoch": 5,
     "prompt": "skw cat sitting on green grass",
     "seed": 42,
     "url": "/api/training/samples/sample_450/image"
   }
   ```
4. **`gpu_stat`**:
   ```json
   {
     "vram_used_mb": 8192,
     "vram_total_mb": 16384,
     "gpu_util_pct": 98,
     "temp_c": 65
   }
   ```

---

## 4. Frontend Architecture & Live Dashboard

### 4.1 Header & Navigation Integration (`Header.svelte` & `Rail.svelte`)
- **Status Indicator Pill**: Displays current state (`IDLE`, `TRAINING`, `PAUSED`, `STOPPING`, `COMPLETED`, `FAILED`) with theme-colored visual indicators.
- **Global Control Toolbar**:
  - `Start Training` (Primary accent button; disabled when training is active).
  - `Pause` / `Resume` toggle button.
  - `Stop` button (opens confirmation dialog before stopping).
  - `Sample Now` button (triggers on-demand sample image).
  - `Backup Checkpoint` button.
- **Unlocked `/live` Navigation Link**: Enabled in `Rail.svelte` and route `/live`.

### 4.2 Live Dashboard (`web/src/routes/live/+page.svelte`)
- **Progress & Speed Card**: Progress bar (0–100%), Step counter (`450 / 1000`), Epoch counter (`5 / 10`), Speed (`2.40 it/s`), Elapsed time (`03:15`), ETA (`04:30`).
- **Interactive `uPlot` Loss & LR Charts**:
  - Rendered via high-performance `uPlot` canvas.
  - Chart Controls: Loss exponential moving average (EMA) smoothing slider (0.0 to 0.99), Logarithmic vs Linear Y-axis toggle, Reset zoom view.
- **GPU & System Resource Meter**:
  - VRAM usage gauge (`8.2 GB / 16.0 GB`), GPU utilization %, Temperature gauge.
- **Sample Gallery & Step Scrubber**:
  - Image grid featuring generated sample thumbnails with metadata overlay (Step, Epoch, Seed, Prompt).
  - Step/epoch timeline scrubber to filter samples across training steps.
  - Interactive Lightbox view for full-resolution sample image inspection.

---

## 5. Automated Testing & Verification Strategy

- **Backend Pytest Coverage (`tests/webui/test_training_service.py` & `test_training_api.py`)**:
  - Test state machine transitions (`IDLE` -> `STARTING` -> `TRAINING` -> `PAUSED` -> `STOPPING` -> `COMPLETED`).
  - Test config snapshotting immutability.
  - Test REST endpoints `/api/training/start`, `/stop`, `/pause`, `/metrics`, `/samples`, `/gpu`.
  - Test metric ring buffer retention and downsampling.
- **Frontend Vitest Unit Suite**:
  - Test `uPlot` chart component rendering and metric data updates.
  - Test status pill state rendering.
  - Test sample gallery timeline scrubber filtering.
- **Playwright E2E Integration Suite (`web/e2e/phase-c.spec.ts`)**:
  - E2E flow testing: Navigate to Live view, verify status pill, trigger mock training start/pause/stop, verify uPlot charts update, verify sample gallery updates.

---

## 6. Scope Boundaries & Constraints
- All backend Python code restricted to `modules/webui/` and `tests/webui/`.
- All frontend Svelte/TypeScript code restricted to `web/src/` and `web/e2e/`.
- Styling uses approved Graphite & Ember CSS tokens (`var(--panel)`, `var(--accent)`, `var(--text)`, `var(--line)`).
- No direct mutations of native UI code.
