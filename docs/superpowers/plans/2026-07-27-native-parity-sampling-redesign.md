# Native-Parity Sampling Route Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Web UI Sampling Route (`/sampling`) to match OneTrainer native UI capabilities by adding multi-sample JSON configuration file support in `training_samples/`, a dense spreadsheet prompt table component with tailored inline controls (width, height, seed, dice random toggle, max-width prompt text input), and full parameters modal integration.

**Architecture:** Extend backend `modules/webui/routers/samples.py` with file listing/creation endpoints; build `web/src/lib/components/sampling/SamplePromptTable.svelte` for high-density inline prompt editing; connect sample config selector to `sample_definition_file_name` in workspace draft.

**Tech Stack:** FastAPI (Python), Svelte 5 (`$derived`, `$state`), TypeScript, Lucide Icons, Vitest, Pytest.

## Global Constraints

- Modify only `modules/webui`, `web/src`, `tests/webui`, and Web UI tests; do not modify OneTrainer core source.
- Do not move, rename, rewrite, or delete files under core `<workspace>/samples` or `<workspace>/config`.
- Keep all sample files within `<workspace>/training_samples/` directory.
- Preserve stable `webui_id` prompt identities across inline edits.
- Keep all new code and edited files ASCII.

---

### Task 1: Backend Sample Files Endpoints

**Files:**
- Modify: `modules/webui/routers/samples.py`
- Test: `tests/webui/test_samples_router.py`

**Interfaces:**
- Consumes: `app_state.settings.root_dir` (`Path`)
- Produces: `GET /api/samples/files`, `POST /api/samples/files`, `GET /api/samples?file=...`, `PUT /api/samples?file=...`

- [ ] **Step 1: Write failing test for sample files endpoints**

Edit `tests/webui/test_samples_router.py`:

```python
def test_list_and_create_sample_files(client):
    resp = client.get("/api/samples/files")
    assert resp.status_code == 200
    files = resp.json().get("files", [])
    assert isinstance(files, list)

    create_resp = client.post("/api/samples/files", json={"name": "custom_samples"})
    assert create_resp.status_code == 200
    assert create_resp.json()["filename"] == "custom_samples.json"

    resp2 = client.get("/api/samples/files")
    assert "custom_samples.json" in resp2.json().get("files", [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_samples_router.py::test_list_and_create_sample_files -v`
Expected: FAIL with 404 Not Found.

- [ ] **Step 3: Implement sample files endpoints in samples.py**

Edit `modules/webui/routers/samples.py`:

```python
class SampleFileCreateRequest(BaseModel):
    name: str

@router.get("/samples/files")
async def list_sample_files(request: Request):
    app_state: AppState = request.app.state.webui
    samples_dir = app_state.settings.root_dir / "training_samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    files = sorted([f.name for f in samples_dir.glob("*.json") if f.is_file()])
    if "samples.json" not in files:
        files.insert(0, "samples.json")
    return {"files": files}

@router.post("/samples/files")
async def create_sample_file(body: SampleFileCreateRequest, request: Request):
    app_state: AppState = request.app.state.webui
    clean_name = body.name.strip()
    if not clean_name:
        return JSONResponse(status_code=422, content={"detail": "Sample file name cannot be empty"})
    filename = clean_name if clean_name.endswith(".json") else f"{clean_name}.json"
    samples_dir = app_state.settings.root_dir / "training_samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    target_path = samples_dir / filename
    if not target_path.exists():
        save_sample_prompt_definitions([], target_path)
    return {"filename": filename}
```

- [ ] **Step 4: Run backend tests to verify pass**

Run: `PYTHONPATH=. python -m pytest tests/webui/test_samples_router.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/webui/routers/samples.py tests/webui/test_samples_router.py
git commit -m "feat(webui): add sample config files API endpoints"
```

---

### Task 2: Frontend API Client Contracts & Queries

**Files:**
- Modify: `web/src/lib/api/client.ts`
- Modify: `web/src/lib/api/queries.ts`
- Test: `web/src/lib/api/client.test.ts`

**Interfaces:**
- Consumes: `GET /api/samples/files`, `POST /api/samples/files`
- Produces: `api.getSampleFiles()`, `api.createSampleFile(name)`, `createSampleFilesQuery()`, `createCreateSampleFileMutation()`

- [ ] **Step 1: Write failing client unit tests**

Edit `web/src/lib/api/client.test.ts`:

```typescript
it('fetches sample config files list', async () => {
  const mockFiles = { files: ['samples.json', 'portrait.json'] };
  fetchMock.mockResponseOnce(JSON.stringify(mockFiles));

  const result = await api.getSampleFiles();
  expect(result.files).toEqual(['samples.json', 'portrait.json']);
});

it('creates new sample config file', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ filename: 'new_samples.json' }));

  const result = await api.createSampleFile('new_samples');
  expect(result.filename).toBe('new_samples.json');
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun run test -- src/lib/api/client.test.ts`
Expected: FAIL with `api.getSampleFiles is not a function`.

- [ ] **Step 3: Implement client methods & reactive query hooks**

Edit `web/src/lib/api/client.ts`:

```typescript
  getSampleFiles: () =>
    request<{ files: string[] }>(`${base}/api/samples/files`),

  createSampleFile: (name: string) =>
    request<{ filename: string }>(`${base}/api/samples/files`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
```

Edit `web/src/lib/api/queries.ts`:

```typescript
export function createSampleFilesQuery() {
  return createQuery({
    queryKey: ['sampleFiles'],
    queryFn: () => api.getSampleFiles(),
  });
}

export function createCreateSampleFileMutation() {
  const client = useQueryClient();
  return createMutation({
    mutationFn: (name: string) => api.createSampleFile(name),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['sampleFiles'] });
    },
  });
}
```

- [ ] **Step 4: Run frontend tests to verify pass**

Run: `cd web && bun run test -- src/lib/api/client.test.ts && bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api/client.ts web/src/lib/api/queries.ts web/src/lib/api/client.test.ts
git commit -m "feat(webui): add frontend client methods for sample config files"
```

---

### Task 3: Spreadsheet Prompt Table Component (`SamplePromptTable.svelte`)

**Files:**
- Create: `web/src/lib/components/sampling/SamplePromptTable.svelte`
- Create: `web/src/lib/components/sampling/SamplePromptTable.test.ts`

**Interfaces:**
- Consumes: `samples: SamplePrompt[]`
- Produces: Inline event callbacks `onUpdate(index, field, value)`, `onEditModal(index)`, `onClone(index)`, `onDelete(index)`, `onAdd()`

- [ ] **Step 1: Write failing component tests**

Create `web/src/lib/components/sampling/SamplePromptTable.test.ts`:

```typescript
import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import SamplePromptTable from './SamplePromptTable.svelte';

it('renders table rows with tailored widths and dice toggle button', async () => {
  const samples = [
    { enabled: true, width: 512, height: 768, seed: -1, prompt: 'A cinematic photo' }
  ];
  const onUpdate = vi.fn();
  const onEditModal = vi.fn();

  render(SamplePromptTable, { samples, onUpdate, onEditModal });

  expect(screen.getByDisplayValue('A cinematic photo')).toBeInTheDocument();
  expect(screen.getByDisplayValue('512')).toBeInTheDocument();
  expect(screen.getByDisplayValue('768')).toBeInTheDocument();

  const diceBtn = screen.getByRole('button', { name: 'Toggle random seed' });
  expect(diceBtn).toHaveClass('active');
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun run test -- src/lib/components/sampling/SamplePromptTable.test.ts`
Expected: FAIL with component file missing.

- [ ] **Step 3: Implement `SamplePromptTable.svelte`**

Create `web/src/lib/components/sampling/SamplePromptTable.svelte`:

```svelte
<script lang="ts">
  import { Dices, Pencil, Copy, Trash2, Plus } from 'lucide-svelte';

  let {
    samples = [],
    onUpdate,
    onEditModal,
    onClone,
    onDelete,
    onAdd,
  }: {
    samples: any[];
    onUpdate: (index: number, updatedSample: any) => void;
    onEditModal: (index: number) => void;
    onClone: (index: number) => void;
    onDelete: (index: number) => void;
    onAdd: () => void;
  } = $props();

  function handleToggleRandomSeed(index: number, currentSeed: number) {
    const nextSeed = currentSeed === -1 ? 42 : -1;
    onUpdate(index, { ...samples[index], seed: nextSeed });
  }
</script>

<div class="table-container">
  <table class="prompt-table">
    <thead>
      <tr>
        <th class="col-active">Active</th>
        <th class="col-dim">Width</th>
        <th class="col-dim">Height</th>
        <th class="col-seed">Seed</th>
        <th class="col-prompt">Prompt Text</th>
        <th class="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each samples as sample, index (sample.webui_id || index)}
        <tr class:disabled={!sample.enabled}>
          <td class="col-active">
            <input
              type="checkbox"
              checked={sample.enabled}
              onchange={(e) => onUpdate(index, { ...sample, enabled: (e.target as HTMLInputElement).checked })}
            />
          </td>
          <td class="col-dim">
            <input
              type="number"
              class="num-input"
              value={sample.width ?? 512}
              onchange={(e) => onUpdate(index, { ...sample, width: parseInt((e.target as HTMLInputElement).value) || 512 })}
            />
          </td>
          <td class="col-dim">
            <input
              type="number"
              class="num-input"
              value={sample.height ?? 512}
              onchange={(e) => onUpdate(index, { ...sample, height: parseInt((e.target as HTMLInputElement).value) || 512 })}
            />
          </td>
          <td class="col-seed">
            <div class="seed-cell">
              <input
                type="number"
                class="num-input seed-input"
                value={sample.seed ?? -1}
                onchange={(e) => onUpdate(index, { ...sample, seed: parseInt((e.target as HTMLInputElement).value) || -1 })}
              />
              <button
                type="button"
                class="dice-btn"
                class:active={(sample.seed ?? -1) === -1}
                title="Toggle random seed (-1)"
                aria-label="Toggle random seed"
                onclick={() => handleToggleRandomSeed(index, sample.seed ?? -1)}
              >
                <Dices size={14} />
              </button>
            </div>
          </td>
          <td class="col-prompt">
            <input
              type="text"
              class="prompt-input"
              value={sample.prompt ?? ''}
              onchange={(e) => onUpdate(index, { ...sample, prompt: (e.target as HTMLInputElement).value })}
            />
          </td>
          <td class="col-actions">
            <button type="button" class="btn-icon" title="Edit details" onclick={() => onEditModal(index)}>
              <Pencil size={14} />
            </button>
            <button type="button" class="btn-icon" title="Clone prompt" onclick={() => onClone(index)}>
              <Copy size={14} />
            </button>
            <button type="button" class="btn-icon danger" title="Delete prompt" onclick={() => onDelete(index)}>
              <Trash2 size={14} />
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="add-row">
    <button type="button" class="add-btn" onclick={onAdd}>
      <Plus size={16} /> Add Sample Prompt
    </button>
  </div>
</div>

<style>
  .table-container { width: 100%; overflow-x: auto; background: var(--panel-bg, #1e242b); border-radius: 6px; border: 1px solid var(--line, #2d3741); }
  .prompt-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--line, #2d3741); text-align: left; vertical-align: middle; }
  th { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted, #8b9bb4); background: rgba(0,0,0,0.2); }
  .col-active { width: 44px; text-align: center; }
  .col-dim { width: 68px; }
  .col-seed { width: 116px; }
  .col-prompt { width: auto; }
  .col-actions { width: 100px; text-align: right; }
  .num-input { width: 100%; height: 30px; background: var(--bg-dark, #13171c); border: 1px solid var(--line, #2d3741); color: var(--text, #fff); border-radius: 4px; padding: 0 6px; }
  .prompt-input { width: 100%; height: 30px; background: var(--bg-dark, #13171c); border: 1px solid var(--line, #2d3741); color: var(--text, #fff); border-radius: 4px; padding: 0 8px; font-size: 0.875rem; }
  .seed-cell { display: flex; align-items: center; gap: 4px; }
  .dice-btn { height: 30px; width: 28px; display: flex; align-items: center; justify-content: center; background: var(--bg-dark, #13171c); border: 1px solid var(--line, #2d3741); color: var(--text-muted, #8b9bb4); border-radius: 4px; cursor: pointer; }
  .dice-btn.active { color: #10b981; border-color: #10b981; background: rgba(16, 185, 129, 0.1); }
  .btn-icon { background: none; border: none; color: var(--text-muted, #8b9bb4); cursor: pointer; padding: 4px; }
  .btn-icon:hover { color: #fff; }
  .btn-icon.danger:hover { color: #ef4444; }
  .add-row { padding: 10px; text-align: center; background: rgba(0,0,0,0.1); }
  .add-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px dashed var(--line, #2d3741); color: var(--accent, #3b82f6); padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 0.875rem; }
  .add-btn:hover { background: rgba(59, 130, 246, 0.1); }
</style>
```

- [ ] **Step 4: Run component tests to verify pass**

Run: `cd web && bun run test -- src/lib/components/sampling/SamplePromptTable.test.ts && bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/sampling/SamplePromptTable.svelte web/src/lib/components/sampling/SamplePromptTable.test.ts
git commit -m "feat(webui): add SamplePromptTable component for dense spreadsheet prompt layout"
```

---

### Task 4: Sampling Route Integration & Config Selector Bar

**Files:**
- Modify: `web/src/routes/sampling/+page.svelte`
- Test: `web/src/routes/sampling/SamplingPage.test.ts`

**Interfaces:**
- Consumes: `SamplePromptTable.svelte`, `createSampleFilesQuery()`, `createCreateSampleFileMutation()`
- Produces: Integrated Native-Parity Sampling Page

- [ ] **Step 1: Update page tests for table & config file selector**

Edit `web/src/routes/sampling/SamplingPage.test.ts`:

```typescript
it('renders sample config selector bar and prompt table', async () => {
  render(SamplingPage);
  expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Add Sample Prompt/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun run test -- src/routes/sampling/SamplingPage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `web/src/routes/sampling/+page.svelte`**

Edit `web/src/routes/sampling/+page.svelte`:
- Replace `.samples-grid` with `<SamplePromptTable>` component.
- Add **Sample Configuration** bar with `<Select>` bound to `sample_definition_file_name` in workspace draft.
- Add **`+ Add Config`** modal to create a new `.json` sample file.

- [ ] **Step 4: Run full verification suite**

Run: `PYTHONPATH=. python -m pytest tests/webui -v && cd web && bun run check && bun run test && bun run build`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/sampling/+page.svelte web/src/routes/sampling/SamplingPage.test.ts
git commit -m "feat(webui): integrate spreadsheet prompt table and sample config bar into sampling route"
```
