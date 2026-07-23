# OneTrainer Web UI Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase C of the OneTrainer Web UI to add full training execution, real-time status and metric event streaming, interactive uPlot loss/LR charts, GPU resource tracking, sample gallery with scrubber, and automated E2E test verification.

**Architecture:** Create `TrainingService` singleton in `modules/webui/training.py` with immutable config snapshotting and state machine management. Expose training control REST endpoints and extend the single WebSocket stream with `training_state`, `training_metric`, `training_sample`, and `gpu_stat` events. On the frontend, build Svelte training stores, high-performance `uPlot` canvas charts, GPU monitor gauges, live sample gallery with scrubber, header controls, and `/live` dashboard page.

**Tech Stack:** Python 3.10+, FastAPI, Pytest, SvelteKit, TypeScript, Vitest, uPlot, Playwright.

## Global Constraints

- Preserve existing `TrainConfig` serialization/migration behavior.
- All Python changes restricted to `modules/webui/` and `tests/webui/`.
- All frontend changes restricted to `web/src/` and `web/e2e/`.
- Plain CSS styling using approved Graphite & Ember theme tokens (`var(--panel)`, `var(--accent)`, `var(--text)`, `var(--line)`).
- No direct mutations of native UI code.

---

### Task 1: Backend `TrainingService` State Machine & Config Snapshotting

**Files:**
- Create: `modules/webui/training.py`
- Test: `tests/webui/test_training_service.py`

**Interfaces:**
- Consumes: `ConfigService`, `TrainConfig`
- Produces: `TrainingService.get_status()`, `TrainingService.start_training()`, `TrainingService.stop_training()`, `TrainingService.pause_training()`, `TrainingService.resume_training()`

- [ ] **Step 1: Write failing test for `TrainingService` state transitions**

Create `tests/webui/test_training_service.py`:
```python
import pytest
from modules.webui.training import TrainingService, TrainingState

def test_training_service_initial_state_and_snapshot():
    service = TrainingService()
    assert service.get_status()["state"] == TrainingState.IDLE
    assert service.get_status()["step"] == 0
```

- [ ] **Step 2: Run test to verify failure**

Run: `PYTHONPATH=. pytest tests/webui/test_training_service.py -v`
Expected: FAIL (`modules.webui.training` missing).

- [ ] **Step 3: Implement `TrainingService` state machine**

Create `modules/webui/training.py`:
```python
from enum import Enum
from threading import Lock
from typing import Dict, Any, Optional
import copy

class TrainingState(str, Enum):
    IDLE = "IDLE"
    STARTING = "STARTING"
    TRAINING = "TRAINING"
    PAUSED = "PAUSED"
    STOPPING = "STOPPING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TrainingService:
    def __init__(self):
        self._lock = Lock()
        self._state = TrainingState.IDLE
        self._step = 0
        self._max_steps = 0
        self._epoch = 0
        self._max_epochs = 0
        self._config_snapshot: Optional[Dict[str, Any]] = None

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "state": self._state,
                "step": self._step,
                "max_steps": self._max_steps,
                "epoch": self._epoch,
                "max_epochs": self._max_epochs,
            }

    def start_training(self, config_data: Dict[str, Any]):
        with self._lock:
            if self._state not in (TrainingState.IDLE, TrainingState.COMPLETED, TrainingState.FAILED):
                raise RuntimeError(f"Cannot start training from state {self._state}")
            self._config_snapshot = copy.deepcopy(config_data)
            self._state = TrainingState.TRAINING
            self._step = 0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. pytest tests/webui/test_training_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/webui/training.py tests/webui/test_training_service.py
git commit -m "feat(webui): implement TrainingService state machine and config snapshotting"
```

---

### Task 2: Backend Training REST Router & API Endpoints

**Files:**
- Create: `modules/webui/routers/training.py`
- Modify: `modules/webui/app.py`
- Test: `tests/webui/test_training_api.py`

**Interfaces:**
- Consumes: `AppState.training_service`, `AppState.config_service`
- Produces: REST endpoints `/api/training/start`, `/stop`, `/pause`, `/resume`, `/sample`, `/backup`, `/status`, `/metrics`, `/samples`, `/gpu`

- [ ] **Step 1: Write failing test for training API router**

Create `tests/webui/test_training_api.py`:
```python
def test_training_api_status_and_start(client):
    res = client.get("/api/training/status")
    assert res.status_code == 200
    assert res.json()["state"] == "IDLE"

    start_res = client.post("/api/training/start")
    assert start_res.status_code == 200
    assert start_res.json()["state"] == "TRAINING"
```

- [ ] **Step 2: Run test to verify failure**

Run: `PYTHONPATH=. pytest tests/webui/test_training_api.py -v`
Expected: FAIL (404 Not Found).

- [ ] **Step 3: Implement training REST router and attach to FastAPI app**

Create `modules/webui/routers/training.py` with FastAPI router handling start, stop, pause, resume, sample, backup, status, metrics, samples, and gpu endpoints. Mount in `modules/webui/app.py`.

- [ ] **Step 4: Run test to verify pass**

Run: `PYTHONPATH=. pytest tests/webui/test_training_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/webui/routers/training.py modules/webui/app.py tests/webui/test_training_api.py
git commit -m "feat(webui): add training control REST endpoints and router"
```

---

### Task 3: Backend Training Event Envelope Extensions & Metric Buffer

**Files:**
- Modify: `modules/webui/events.py`
- Modify: `modules/webui/training.py`
- Test: `tests/webui/test_training_events.py`

**Interfaces:**
- Consumes: `EventBus`
- Produces: WebSocket payloads for `training_state`, `training_metric`, `training_sample`, `gpu_stat`

- [ ] **Step 1: Write failing test for training event dispatching**

Create `tests/webui/test_training_events.py`:
```python
from modules.webui.events import EventBus, EventType
from modules.webui.training import TrainingService

def test_training_service_emits_metric_and_state_events():
    bus = EventBus()
    service = TrainingService(event_bus=bus)
    service.record_metric(step=1, epoch=1, loss=0.5, lr=0.001)
    snapshot = service.get_metrics()
    assert len(snapshot) == 1
    assert snapshot[0]["loss"] == 0.5
```

- [ ] **Step 2: Run test to verify failure**

Run: `PYTHONPATH=. pytest tests/webui/test_training_events.py -v`
Expected: FAIL (`record_metric` / `get_metrics` missing).

- [ ] **Step 3: Implement metric ring buffer and event broadcasting in `TrainingService`**

Update `modules/webui/events.py` with `EventType.TRAINING_STATE`, `TRAINING_METRIC`, `TRAINING_SAMPLE`, `GPU_STAT` and update `modules/webui/training.py` to buffer metrics and emit events.

- [ ] **Step 4: Run test to verify pass**

Run: `PYTHONPATH=. pytest tests/webui/test_training_events.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/webui/events.py modules/webui/training.py tests/webui/test_training_events.py
git commit -m "feat(webui): add training metric buffering and event envelope broadcasting"
```

---

### Task 4: Frontend API Client & Svelte Training Store Integration

**Files:**
- Modify: `web/src/lib/api/types.ts`
- Modify: `web/src/lib/api/client.ts`
- Modify: `web/src/lib/api/queries.ts`
- Create: `web/src/lib/events/training-store.ts`
- Create: `web/src/lib/events/training-store.test.ts`

**Interfaces:**
- Consumes: `/api/training/*` endpoints, WebSocket event stream
- Produces: `trainingStore` Svelte store with reactive state (`status`, `metrics`, `samples`, `gpuStats`)

- [ ] **Step 1: Write Vitest test for `training-store`**

Create `web/src/lib/events/training-store.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createTrainingStore } from './training-store';

describe('trainingStore', () => {
  it('initializes with IDLE state and empty metric buffer', () => {
    const store = createTrainingStore();
    let state;
    store.subscribe(s => state = s)();
    expect(state.status.state).toBe('IDLE');
    expect(state.metrics).toEqual([]);
  });
});
```

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/events/training-store.test.ts`
Expected: FAIL (`training-store` missing).

- [ ] **Step 3: Implement `types.ts`, `client.ts`, `queries.ts`, and `training-store.ts`**

Add training API methods to `client.ts` and build `createTrainingStore` processing WebSocket messages for state, metrics, samples, and GPU stats.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/events/training-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api/types.ts web/src/lib/api/client.ts web/src/lib/api/queries.ts web/src/lib/events/training-store.ts web/src/lib/events/training-store.test.ts
git commit -m "feat(web): add frontend training API client and reactive training store"
```

---

### Task 5: Header Action Bar & Status Pill Integration

**Files:**
- Modify: `web/src/lib/components/shell/Header.svelte`
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Test: `web/src/lib/components/shell/Header.test.ts`
- Test: `web/src/lib/components/shell/Rail.test.ts`

**Interfaces:**
- Consumes: `trainingStore`
- Produces: Active status pill and `Start Training`, `Pause`, `Stop`, `Sample`, `Backup` controls in `Header.svelte`, and unlocked `/live` navigation rail item.

- [ ] **Step 1: Write Vitest test for Header training status pill and action controls**

Update `web/src/lib/components/shell/Header.test.ts` asserting Start Training button and Status Pill render appropriately based on training state.

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/components/shell/Header.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `Header.svelte` and `Rail.svelte`**

Add status pill rendering (`IDLE`, `TRAINING`, `PAUSED`, etc.) and action toolbar in `Header.svelte`. Unlock `/live` route link in `Rail.svelte`.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/components/shell/Header.test.ts src/lib/components/shell/Rail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/shell/Header.svelte web/src/lib/components/shell/Header.test.ts web/src/lib/components/shell/Rail.svelte web/src/lib/components/shell/Rail.test.ts
git commit -m "feat(web): integrate header status pill, training controls, and unlock live route"
```

---

### Task 6: Interactive `uPlot` Loss & Learning Rate Canvas Charts

**Files:**
- Create: `web/src/lib/components/charts/MetricsChart.svelte`
- Create: `web/src/lib/components/charts/MetricsChart.test.ts`

**Interfaces:**
- Consumes: `metrics` array from `trainingStore`
- Produces: `<MetricsChart {metrics} metricKey="loss" />` featuring EMA smoothing, log/linear scale, and reset zoom.

- [ ] **Step 1: Write Vitest test for `MetricsChart`**

Create `web/src/lib/components/charts/MetricsChart.test.ts`:
```typescript
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MetricsChart from './MetricsChart.svelte';

describe('MetricsChart', () => {
  it('renders chart container and controls', () => {
    render(MetricsChart, { props: { metrics: [], metricKey: 'loss', title: 'Loss' } });
    expect(screen.getByText('Loss')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/components/charts/MetricsChart.test.ts`
Expected: FAIL (`MetricsChart` missing).

- [ ] **Step 3: Implement `MetricsChart.svelte` with `uPlot` canvas engine**

Create `MetricsChart.svelte` with `uPlot` canvas initialization, EMA smoothing computation, Y-axis log/linear toggles, and responsive window resize handling.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/components/charts/MetricsChart.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/charts/MetricsChart.svelte web/src/lib/components/charts/MetricsChart.test.ts
git commit -m "feat(web): add interactive uPlot canvas metrics chart component"
```

---

### Task 7: GPU Resource Monitor & Live Sample Gallery with Timeline Scrubber

**Files:**
- Create: `web/src/lib/components/training/GpuMonitor.svelte`
- Create: `web/src/lib/components/training/SampleGallery.svelte`
- Create: `web/src/lib/components/training/SampleGallery.test.ts`

**Interfaces:**
- Consumes: `gpuStats` and `samples` from `trainingStore`
- Produces: `<GpuMonitor {gpuStats} />` and `<SampleGallery {samples} />` with timeline step scrubber and lightbox overlay.

- [ ] **Step 1: Write Vitest test for `SampleGallery`**

Create `web/src/lib/components/training/SampleGallery.test.ts`:
```typescript
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import SampleGallery from './SampleGallery.svelte';

describe('SampleGallery', () => {
  it('renders empty gallery placeholder when no samples exist', () => {
    render(SampleGallery, { props: { samples: [] } });
    expect(screen.getByText(/no samples generated yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/components/training/SampleGallery.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `GpuMonitor.svelte` and `SampleGallery.svelte`**

Build `GpuMonitor.svelte` rendering VRAM gauge and utilization meters. Build `SampleGallery.svelte` with thumbnail grid, step scrubber filter, prompt info overlay, and modal lightbox viewer.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/components/training/SampleGallery.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/training/GpuMonitor.svelte web/src/lib/components/training/SampleGallery.svelte web/src/lib/components/training/SampleGallery.test.ts
git commit -m "feat(web): add GPU resource monitor gauge and live sample gallery with scrubber"
```

---

### Task 8: Live Dashboard Page & Playwright E2E Integration Suite

**Files:**
- Create: `web/src/routes/live/+page.svelte`
- Create: `web/e2e/phase-c.spec.ts`

**Interfaces:**
- Consumes: Full Phase C backend and frontend stack
- Produces: Complete `/live` dashboard page and Playwright E2E test suite.

- [ ] **Step 1: Implement `/live` route page (`web/src/routes/live/+page.svelte`)**

Integrate `trainingStore`, progress card, `MetricsChart` (loss and learning rate), `GpuMonitor`, and `SampleGallery` into `web/src/routes/live/+page.svelte`.

- [ ] **Step 2: Create Playwright E2E test suite `web/e2e/phase-c.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase C Live Training Dashboard', () => {
  test('navigates to /live and displays progress, metrics charts, and controls', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/live"]');
    await expect(page.locator('h1, h2')).toContainText(/live/i);
    await expect(page.locator('button:has-text("Start Training")')).toBeVisible();
  });
});
```

- [ ] **Step 3: Execute Pytest backend suite**

Run: `PYTHONPATH=. pytest tests/webui/ -v`
Expected: All Pytest backend tests pass.

- [ ] **Step 4: Execute Vitest frontend unit suite**

Run: `cd web && bun run test`
Expected: All Vitest unit tests pass.

- [ ] **Step 5: Execute Playwright E2E suite**

Run: `cd web && npx playwright test`
Expected: All E2E browser tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/live/+page.svelte web/e2e/phase-c.spec.ts
git commit -m "test(webui): add Live dashboard page and Playwright E2E integration test suite for Phase C"
```
