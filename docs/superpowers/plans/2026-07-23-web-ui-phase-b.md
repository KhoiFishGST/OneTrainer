# OneTrainer Web UI Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase B of the OneTrainer Web UI to achieve full configuration surface parity with native OneTrainer, including Model, Training (with Optimizer/Scheduler parameter modals), Sampling, LoRA/Embedding, interactive Concepts dataset editor, file-capable `PathInput` pickers, and 100% automated CI schema coverage testing.

**Architecture:** Extend backend `modules/webui/schema.py` with dynamic parameter descriptors and `test_schema_coverage.py` CI tests. Upgrade filesystem router for file extension filtering. Build Svelte `PathInput` and `ModalDialog` components, enable all remaining routes in `Rail.svelte`, and create the interactive `ConceptsEditor` with dataset preview capabilities.

**Tech Stack:** Python 3.10+, FastAPI, Pytest, SvelteKit, TypeScript, Vitest, Playwright.

## Global Constraints

- Preserve existing `TrainConfig` serialization/migration behavior.
- All Python changes restricted to `modules/webui/` and `tests/webui/`.
- All frontend changes restricted to `web/src/` and `web/tests/`.
- Plain CSS styling using approved Graphite & Ember theme tokens.
- No direct mutations of native UI code.

---

### Task 1: Backend Schema Expansion & CI Schema Coverage Test

**Files:**
- Create: `tests/webui/test_schema_coverage.py`
- Modify: `modules/webui/schema.py`
- Test: `tests/webui/test_schema_coverage.py`

**Interfaces:**
- Consumes: `modules.train_config.TrainConfig`, `modules.webui.schema.SchemaRegistry`
- Produces: `SchemaRegistry.get_all_field_names()`, `SchemaRegistry.get_schema_for_domain(domain)`, `SchemaRegistry.get_sub_schema(key)`

- [ ] **Step 1: Write failing schema coverage test**

Create `tests/webui/test_schema_coverage.py`:
```python
from dataclasses import fields
import pytest
from modules.train_config import TrainConfig
from modules.webui.schema import SchemaRegistry

DEPRECATED_OR_INTERNAL = {
    "version", "config_version", "saved_version"
}

def test_all_train_config_fields_covered():
    config_field_names = {f.name for f in fields(TrainConfig)} - DEPRECATED_OR_INTERNAL
    schema_field_names = set(SchemaRegistry.get_all_field_names())
    missing = config_field_names - schema_field_names
    assert not missing, f"TrainConfig fields missing from SchemaRegistry: {missing}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/webui/test_schema_coverage.py -v`
Expected: FAIL showing unmapped fields from Model, Training, Sampling, LoRA/Embedding, and Concepts.

- [ ] **Step 3: Update `modules/webui/schema.py` to declare all remaining fields**

Expand `SchemaRegistry` in `modules/webui/schema.py` with field definitions for `model`, `training` (including optimizer & scheduler sub-schema keys), `sampling`, `lora_embedding`, and `concepts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/webui/test_schema_coverage.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/webui/schema.py tests/webui/test_schema_coverage.py
git commit -m "feat(webui): expand schema registry and add schema coverage CI test"
```

---

### Task 2: File Router Extension Filtering & Directory Router Tests

**Files:**
- Modify: `modules/webui/routers/directories.py`
- Modify: `modules/webui/directories.py`
- Test: `tests/webui/test_directories.py`

**Interfaces:**
- Consumes: `FastAPI` request query parameters
- Produces: `/api/fs/list?path=...&mode=...&extensions=...` returning file and directory entries with size and modification timestamp.

- [ ] **Step 1: Write test for file extension filtering**

Add to `tests/webui/test_directories.py`:
```python
def test_list_directories_with_extension_filter(client, tmp_path):
    (tmp_path / "model.safetensors").write_text("dummy")
    (tmp_path / "notes.txt").write_text("dummy")
    (tmp_path / "subfolder").mkdir()
    
    resp = client.get(f"/api/fs/list?path={tmp_path}&mode=both&extensions=.safetensors")
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    names = [e["name"] for e in entries]
    assert "model.safetensors" in names
    assert "subfolder" in names
    assert "notes.txt" not in names
```

- [ ] **Step 2: Run test to verify failure**

Run: `pytest tests/webui/test_directories.py -k test_list_directories_with_extension_filter -v`
Expected: FAIL (filter parameters not yet handled).

- [ ] **Step 3: Update `directories.py` and router to process `mode` and `extensions`**

Update `modules/webui/directories.py` and `modules/webui/routers/directories.py` to filter returned filesystem entries based on mode (`"dir"`, `"file"`, `"both"`) and matching extension masks.

- [ ] **Step 4: Run tests to verify pass**

Run: `pytest tests/webui/test_directories.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/webui/directories.py modules/webui/routers/directories.py tests/webui/test_directories.py
git commit -m "feat(webui): support file extension filtering in filesystem router"
```

---

### Task 3: Backend Concepts REST Endpoints & Tests

**Files:**
- Create: `modules/webui/routers/concepts.py`
- Modify: `modules/webui/app.py`
- Test: `tests/webui/test_concepts_api.py`

**Interfaces:**
- Consumes: `AppState.config_service`
- Produces: `GET /api/concepts`, `PUT /api/concepts`

- [ ] **Step 1: Write failing test for concepts API**

Create `tests/webui/test_concepts_api.py`:
```python
def test_get_and_put_concepts(client):
    resp = client.get("/api/concepts")
    assert resp.status_code == 200
    concepts = resp.json()
    assert isinstance(concepts, list)
    
    new_concepts = [{
        "instance_prompt": "skw cat",
        "class_prompt": "cat",
        "dataset_directory": "/tmp/cats"
    }]
    put_resp = client.put("/api/concepts", json=new_concepts)
    assert put_resp.status_code == 200
    assert put_resp.json() == new_concepts
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/webui/test_concepts_api.py -v`
Expected: FAIL 404 Not Found.

- [ ] **Step 3: Implement concepts router and wire into `app.py`**

Create `modules/webui/routers/concepts.py` handling `GET` and `PUT` for concepts array in `ConfigService`, and include router in `modules/webui/app.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/webui/test_concepts_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/webui/routers/concepts.py modules/webui/app.py tests/webui/test_concepts_api.py
git commit -m "feat(webui): add REST endpoints for concept list management"
```

---

### Task 4: Frontend `PathInput` Component & Client API Updates

**Files:**
- Modify: `web/src/lib/api/types.ts`
- Modify: `web/src/lib/api/client.ts`
- Create: `web/src/lib/components/form/PathInput.svelte`
- Create: `web/src/lib/components/form/PathInput.test.ts`

**Interfaces:**
- Consumes: `client.listDirectory(path, mode, extensions)`
- Produces: `<PathInput value={path} mode="file" extensions={[".safetensors"]} onChange={...} />`

- [ ] **Step 1: Write Vitest test for `PathInput`**

Create `web/src/lib/components/form/PathInput.test.ts`:
```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import PathInput from './PathInput.svelte';

describe('PathInput', () => {
  it('renders input value and browse button', () => {
    render(PathInput, { props: { value: '/tmp/model.safetensors', label: 'Model Path' } });
    expect(screen.getByLabelText('Model Path')).toHaveValue('/tmp/model.safetensors');
    expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/components/form/PathInput.test.ts`
Expected: FAIL (Component missing).

- [ ] **Step 3: Implement `PathInput.svelte` and client API methods**

Update `web/src/lib/api/client.ts` for filtering options, and write `web/src/lib/components/form/PathInput.svelte` integrating file/directory browser modal.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/components/form/PathInput.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api/types.ts web/src/lib/api/client.ts web/src/lib/components/form/PathInput.svelte web/src/lib/components/form/PathInput.test.ts
git commit -m "feat(web): add PathInput component with file and directory browsing"
```

---

### Task 5: Frontend `ModalDialog` & `OptimizerSchedulerModal` Components

**Files:**
- Create: `web/src/lib/components/ui/ModalDialog.svelte`
- Create: `web/src/lib/components/ui/ModalDialog.test.ts`
- Create: `web/src/lib/components/form/OptimizerSchedulerModal.svelte`

**Interfaces:**
- Consumes: Sub-schema definition from `SchemaRegistry`
- Produces: Accessible modal dialog for tuning optimizer/scheduler hyperparameters.

- [ ] **Step 1: Write Vitest test for `ModalDialog`**

Create `web/src/lib/components/ui/ModalDialog.test.ts`:
```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ModalDialog from './ModalDialog.svelte';

describe('ModalDialog', () => {
  it('renders when open is true and responds to close', async () => {
    const onClose = vi.fn();
    render(ModalDialog, { props: { open: true, title: 'Test Modal', onClose } });
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/components/ui/ModalDialog.test.ts`
Expected: FAIL (ModalDialog missing).

- [ ] **Step 3: Implement `ModalDialog.svelte` and `OptimizerSchedulerModal.svelte`**

Create `ModalDialog.svelte` with backdrop blur, accessible dialog role, ESC key handling, and `OptimizerSchedulerModal.svelte` bound to optimizer/scheduler sub-schemas.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/components/ui/ModalDialog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/ui/ModalDialog.svelte web/src/lib/components/ui/ModalDialog.test.ts web/src/lib/components/form/OptimizerSchedulerModal.svelte
git commit -m "feat(web): add ModalDialog and OptimizerSchedulerModal components"
```

---

### Task 6: Core Config Tab Routes & Navigation Rail Integration

**Files:**
- Create: `web/src/routes/model/+page.svelte`
- Create: `web/src/routes/training/+page.svelte`
- Create: `web/src/routes/sampling/+page.svelte`
- Create: `web/src/routes/lora-embedding/+page.svelte`
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Test: `web/src/lib/components/shell/Rail.test.ts`

**Interfaces:**
- Consumes: `workspace` config context, `SchemaForm`
- Produces: Functioning `/model`, `/training`, `/sampling`, `/lora-embedding` pages.

- [ ] **Step 1: Write Vitest test for unlocked Navigation Rail**

Update `web/src/lib/components/shell/Rail.test.ts` to assert that Model, Training, Sampling, and LoRA/Embedding navigation items are enabled.

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/components/shell/Rail.test.ts`
Expected: FAIL (Items still marked disabled).

- [ ] **Step 3: Implement tab pages and update `Rail.svelte`**

Create the 4 core route pages using `SchemaForm` and enable navigation items in `Rail.svelte`.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/components/shell/Rail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/model/+page.svelte web/src/routes/training/+page.svelte web/src/routes/sampling/+page.svelte web/src/routes/lora-embedding/+page.svelte web/src/lib/components/shell/Rail.svelte web/src/lib/components/shell/Rail.test.ts
git commit -m "feat(web): add Model, Training, Sampling, and LoRA/Embedding configuration tabs"
```

---

### Task 7: Interactive Concepts Tab & Dataset Editor

**Files:**
- Create: `web/src/lib/components/concepts/ConceptsEditor.svelte`
- Create: `web/src/lib/components/concepts/ConceptsEditor.test.ts`
- Create: `web/src/routes/concepts/+page.svelte`

**Interfaces:**
- Consumes: `/api/concepts` REST API, `/api/workspace/files` preview endpoints
- Produces: Rich dataset concept list editor with thumbnail preview pane.

- [ ] **Step 1: Write Vitest test for `ConceptsEditor`**

Create `web/src/lib/components/concepts/ConceptsEditor.test.ts`:
```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ConceptsEditor from './ConceptsEditor.svelte';

describe('ConceptsEditor', () => {
  it('renders concept list and add button', () => {
    render(ConceptsEditor, { props: { concepts: [] } });
    expect(screen.getByRole('button', { name: /add concept/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run Vitest to verify failure**

Run: `cd web && bun test src/lib/components/concepts/ConceptsEditor.test.ts`
Expected: FAIL (Component missing).

- [ ] **Step 3: Implement `ConceptsEditor.svelte` and `/concepts` route page**

Write `ConceptsEditor.svelte` supporting concept list operations, dataset directory `PathInput`, instance/class prompt fields, and thumbnail preview grid.

- [ ] **Step 4: Run Vitest to verify pass**

Run: `cd web && bun test src/lib/components/concepts/ConceptsEditor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/concepts/ConceptsEditor.svelte web/src/lib/components/concepts/ConceptsEditor.test.ts web/src/routes/concepts/+page.svelte
git commit -m "feat(web): add interactive Concepts tab and dataset preview editor"
```

---

### Task 8: Playwright E2E Integration Suite & Full System Verification

**Files:**
- Create: `web/tests/e2e/phase-b.spec.ts`

**Interfaces:**
- Consumes: Full stack running server + web SPA
- Produces: E2E automated test suite verifying all Phase B tab flows.

- [ ] **Step 1: Write Playwright E2E test suite for Phase B**

Create `web/tests/e2e/phase-b.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase B Configuration Surface', () => {
  test('navigates through Model, Training, Sampling, LoRA, and Concepts tabs', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Model tab
    await page.click('a[href="/model"]');
    await expect(page.locator('h1, h2')).toContainText(/model/i);
    
    // Navigate to Training tab and open Optimizer modal
    await page.click('a[href="/training"]');
    await expect(page.locator('h1, h2')).toContainText(/training/i);
    await page.click('button:has-text("Configure Optimizer")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.click('button:has-text("Close"), button:has-text("Cancel")');
    
    // Navigate to Concepts tab
    await page.click('a[href="/concepts"]');
    await expect(page.locator('button:has-text("Add Concept")')).toBeVisible();
  });
});
```

- [ ] **Step 2: Execute backend pytest suite**

Run: `pytest tests/webui/`
Expected: All backend tests pass.

- [ ] **Step 3: Execute frontend Vitest suite**

Run: `cd web && bun test`
Expected: All Vitest unit tests pass.

- [ ] **Step 4: Execute Playwright E2E suite**

Run: `cd web && npx playwright test tests/e2e/phase-b.spec.ts`
Expected: All E2E browser flows pass.

- [ ] **Step 5: Final Commit**

```bash
git add web/tests/e2e/phase-b.spec.ts
git commit -m "test(webui): add Playwright E2E test coverage for Phase B browser flows"
```
