# Consolidate Data & Datasets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the **Data** configuration tab (`/data`) and **Datasets** management gallery (`/datasets`) into a single, unified, intuitive page at `/data`.

**Architecture:** Combine `web/src/routes/data/+page.svelte` into a unified page displaying a compact header card with the `Base Directory` path input and 3 caching toggles (*Aspect Ratio Bucketing*, *Latent Caching*, *Clear Cache Before Training*) at the top, followed by the Dataset Gallery grid below. Remove `Datasets` from `Rail.svelte` nav items, add a 307 redirect at `web/src/routes/datasets/+page.ts` pointing to `/data`, and update `web/src/routes/datasets/[id]/+page.svelte` back link to `"← Back to Data"`.

**Tech Stack:** Svelte 5, SvelteKit, TypeScript, Vitest, Pytest.

## Global Constraints

- All frontend changes restricted to `web/src/` and `web/e2e/`.
- Preserve existing `datasets_dir`, `aspect_ratio_bucketing`, `latent_caching`, and `clear_cache_before_training` backend configuration contracts.
- Use plain CSS styling with approved theme tokens (`var(--panel)`, `var(--line)`, `var(--text)`, `var(--color-text-title, var(--accent))`).

---

### Task 1: Consolidate Unified `/data` Page with Compact Options & Datasets Gallery

**Files:**
- Modify: `web/src/routes/data/+page.svelte`
- Test: `web/src/routes/data/DataPage.test.ts` (or `web/src/lib/components/form/SchemaForm.test.ts`)

**Interfaces:**
- Consumes: `getRouteContext()`, `createDatasetsQuery()`, `createCreateDatasetMutation()`, `createDeleteDatasetMutation()`, `queryKeys`
- Produces: Consolidated `/data` route with top compact panel and dataset gallery grid

- [ ] **Step 1: Write failing test in `web/src/routes/data/DataPage.test.ts`**

Create `web/src/routes/data/DataPage.test.ts`:
```ts
import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import { readable } from 'svelte/store';
import DataPage from './+page.svelte';
import * as queries from '$lib/api/queries';

test('renders Data page title, base directory input, and dataset cards', async () => {
  vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
    readable({
      data: {
        datasets: [
          {
            name: 'Dataset Alpha',
            path: '/path/to/Dataset Alpha',
            image_count: 12,
            caption_count: 12,
            thumbnail_url: '/api/datasets/image?dataset=Dataset%20Alpha&thumb=true',
          },
        ],
        base_dir: 'workspace/datasets',
      },
      isLoading: false,
    }) as any
  );

  render(DataPage);
  expect(screen.getByText('Data')).toBeInTheDocument();
  expect(screen.getByText('Base Directory:')).toBeInTheDocument();
  expect(await screen.findByText('Dataset Alpha')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun test src/routes/data/DataPage.test.ts`
Expected: FAIL (component missing `Base Directory:` or `createDatasetsQuery` bindings).

- [ ] **Step 3: Implement consolidated `web/src/routes/data/+page.svelte`**

Update `web/src/routes/data/+page.svelte`:
```svelte
<script lang="ts">
  import { Plus, Trash2 } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import PathInput from '$lib/components/form/PathInput.svelte';
  import Toggle from '$lib/components/form/Toggle.svelte';
  import {
    queryKeys,
    getSafeQueryClient,
    createDatasetsQuery,
    createCreateDatasetMutation,
    createDeleteDatasetMutation,
  } from '$lib/api/queries';

  interface DatasetItem {
    name: string;
    path: string;
    image_count: number;
    caption_count: number;
    thumbnail_url: string;
  }

  let ctx: any = null;
  try {
    ctx = getRouteContext();
  } catch {
    // Context fallback for testing
  }

  const queryClient = getSafeQueryClient();
  const datasetsQuery = createDatasetsQuery();
  const createMutation = createCreateDatasetMutation();
  const deleteMutation = createDeleteDatasetMutation();

  let datasets = $derived($datasetsQuery.data?.datasets || []);
  let baseDir = $derived(
    ctx?.workspace?.draft?.datasets_dir ?? $datasetsQuery.data?.base_dir ?? 'workspace/datasets'
  );
  let showCreateModal = $state(false);
  let newDatasetName = $state('');
  let createError = $state<string | null>(null);

  async function handleBaseDirChange(newPath: string) {
    if (ctx?.workspace) {
      ctx.workspace.setRaw('datasets_dir', newPath);
      await ctx.workspace.flush();
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets() });
    }
  }

  function openCreateModal() {
    const existingNames = new Set(datasets.map((d: DatasetItem) => d.name));
    let idx = 1;
    while (existingNames.has(`Dataset ${idx}`)) {
      idx++;
    }
    newDatasetName = `Dataset ${idx}`;
    createError = null;
    showCreateModal = true;
  }

  async function handleCreateDataset() {
    createError = null;
    const nameToSubmit = newDatasetName.trim();

    const safeRegex = /^[a-zA-Z0-9 _-]+$/;
    if (nameToSubmit && !safeRegex.test(nameToSubmit)) {
      createError =
        'Invalid dataset name. Use alphanumeric characters, spaces, dashes, and underscores only.';
      return;
    }

    try {
      await $createMutation.mutateAsync(nameToSubmit);
      showCreateModal = false;
      newDatasetName = '';
    } catch (err: any) {
      createError = err.message || 'Failed to create dataset';
    }
  }

  async function handleDeleteDataset(e: MouseEvent, name: string) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm(`Are you sure you want to delete dataset "${name}"?`)) return;
    try {
      await $deleteMutation.mutateAsync(name);
    } catch (err) {
      console.error('Failed to delete dataset', err);
    }
  }
</script>

<div class="route-page">
  <div class="page-header">
    <h1 class="page-title">Data</h1>
  </div>

  <div class="options-panel">
    <div class="base-dir-row">
      <span class="base-dir-label">Base Directory:</span>
      <div class="base-dir-input-wrapper">
        <PathInput
          id="base-datasets-dir"
          value={baseDir}
          mode="dir"
          onInput={handleBaseDirChange}
          onChange={handleBaseDirChange}
        />
      </div>
    </div>

    {#if ctx?.workspace}
      <div class="toggles-divider"></div>
      <div class="toggles-row">
        <div class="toggle-item">
          <Toggle
            id="aspect_ratio_bucketing"
            checked={Boolean(ctx.workspace.draft?.aspect_ratio_bucketing)}
            onChange={(val) => ctx.workspace.setRaw('aspect_ratio_bucketing', val)}
          />
          <span class="toggle-label">Aspect Ratio Bucketing</span>
        </div>
        <div class="toggle-item">
          <Toggle
            id="latent_caching"
            checked={Boolean(ctx.workspace.draft?.latent_caching)}
            onChange={(val) => ctx.workspace.setRaw('latent_caching', val)}
          />
          <span class="toggle-label">Latent Caching</span>
        </div>
        <div class="toggle-item">
          <Toggle
            id="clear_cache_before_training"
            checked={Boolean(ctx.workspace.draft?.clear_cache_before_training)}
            onChange={(val) => ctx.workspace.setRaw('clear_cache_before_training', val)}
          />
          <span class="toggle-label">Clear cache before training</span>
        </div>
      </div>
    {/if}
  </div>

  <div class="datasets-grid">
    <button type="button" class="card add-card" onclick={openCreateModal}>
      <div class="add-icon-wrapper">
        <Plus size={32} />
      </div>
      <span class="add-label">Add Dataset</span>
    </button>

    {#each datasets as ds (ds.name)}
      <a href="/datasets/{encodeURIComponent(ds.name)}" class="card dataset-card">
        <div class="thumbnail-wrapper">
          {#if ds.thumbnail_url}
            <img src={ds.thumbnail_url} alt={ds.name} class="thumbnail-img" />
          {/if}
          <div class="thumbnail-overlay">
            <span class="dataset-name">{ds.name}</span>
          </div>
          <button
            type="button"
            class="btn-delete"
            aria-label="Delete dataset"
            onclick={(e) => handleDeleteDataset(e, ds.name)}
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div class="card-footer">
          <span class="count-badge">
            {ds.image_count} {ds.image_count === 1 ? 'image' : 'images'} • {ds.caption_count} {ds.caption_count === 1 ? 'caption' : 'captions'}
          </span>
        </div>
      </a>
    {/each}
  </div>
</div>

<ModalDialog
  open={showCreateModal}
  title="Create New Dataset"
  onClose={() => (showCreateModal = false)}
>
  <div class="create-modal-content">
    <label for="ds-name-input" class="input-label">Dataset Name</label>
    <input
      id="ds-name-input"
      type="text"
      placeholder="e.g. Dataset 1"
      bind:value={newDatasetName}
      class="text-input"
    />
    {#if createError}
      <p class="error-text">{createError}</p>
    {/if}
  </div>
  {#snippet footer()}
    <button type="button" class="btn btn-secondary" onclick={() => (showCreateModal = false)}>
      Cancel
    </button>
    <button type="button" class="btn btn-primary" onclick={handleCreateDataset}>
      Create
    </button>
  {/snippet}
</ModalDialog>

<style>
  .route-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .options-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--panel, #182026);
    padding: 1rem 1.25rem;
    border-radius: 8px;
    border: 1px solid var(--line, #2d3741);
  }

  .base-dir-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .base-dir-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted, #8995a1);
    white-space: nowrap;
  }

  .base-dir-input-wrapper {
    flex: 1;
  }

  .toggles-divider {
    height: 1px;
    background: var(--line, #2d3741);
  }

  .toggles-row {
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .toggle-label {
    font-size: 0.875rem;
    color: var(--text, #e6ebef);
  }

  .datasets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .card {
    background: var(--panel, #182026);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .card:hover {
    border-color: var(--accent, #3b82f6);
    transform: translateY(-2px);
  }

  .add-card {
    min-height: 200px;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: 2px dashed var(--line, #2d3741);
    background: transparent;
    cursor: pointer;
  }

  .add-card:hover {
    border-color: var(--accent, #3b82f6);
    background: rgba(59, 130, 246, 0.05);
  }

  .add-icon-wrapper {
    color: var(--accent, #3b82f6);
  }

  .add-label {
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .dataset-card {
    height: 220px;
  }

  .thumbnail-wrapper {
    position: relative;
    flex: 1;
    background: var(--control, #101419);
    overflow: hidden;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.75rem;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    display: flex;
    align-items: flex-end;
  }

  .dataset-name {
    font-weight: 600;
    color: #ffffff;
    font-size: 0.9375rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .btn-delete {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: var(--danger, #ef4444);
    padding: 0.375rem;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .dataset-card:hover .btn-delete {
    opacity: 1;
  }

  .card-footer {
    padding: 0.625rem 0.75rem;
    background: var(--panel, #182026);
    border-top: 1px solid var(--line, #2d3741);
  }

  .count-badge {
    font-size: 0.75rem;
    color: var(--muted, #8995a1);
  }

  .create-modal-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .input-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .text-input {
    background: var(--control, #101419);
    border: 1px solid var(--line, #2d3741);
    color: var(--text, #f8fafc);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .error-text {
    color: var(--danger, #ef4444);
    font-size: 0.75rem;
    margin: 0;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }

  .btn-secondary {
    background: var(--control, #101419);
    color: var(--text, #e6ebef);
    border: 1px solid var(--line, #2d3741);
  }

  .btn-primary {
    background: var(--accent, #3b82f6);
    color: #ffffff;
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && bun test src/routes/data/DataPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/data/+page.svelte web/src/routes/data/DataPage.test.ts
git commit -m "feat(webui): consolidate options and dataset gallery into unified Data page"
```

---

### Task 2: Update Side Navigation Rail & Route Redirection

**Files:**
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Test: `web/src/lib/components/shell/Rail.test.ts`
- Replace: Delete `web/src/routes/datasets/+page.svelte`, create `web/src/routes/datasets/+page.ts`

**Interfaces:**
- Consumes: `navItems` in `Rail.svelte`
- Produces: Single `Data` nav item in rail; 307 redirect at `/datasets` -> `/data`

- [ ] **Step 1: Write failing test in `web/src/lib/components/shell/Rail.test.ts`**

Update `web/src/lib/components/shell/Rail.test.ts`:
```ts
it("persists pinned expansion and enables configuration routes", async () => {
  render(Rail, { currentPath: "/general", mobile: false });
  await fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(localStorage.getItem("webui.railExpanded")).toBe("true");
  expect(screen.getByText("General")).toBeVisible();
  
  // Enabled tabs (Data is enabled, Datasets is removed)
  for (const name of ["Model", "Concepts", "Training", "Sampling", "LoRA", "Data", "Live"]) {
    const link = screen.getByRole("link", { name });
    expect(link).not.toHaveAttribute("aria-disabled");
  }

  expect(screen.queryByRole("link", { name: "Datasets" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun test src/lib/components/shell/Rail.test.ts`
Expected: FAIL (`Datasets` link still found in document).

- [ ] **Step 3: Remove `Datasets` from `Rail.svelte`**

Update `web/src/lib/components/shell/Rail.svelte` lines 45-60:
```svelte
    { name: 'Data', path: '/data', icon: Database, disabled: false },
    { name: 'Concepts', path: '/concepts', icon: Layers, disabled: false },
    { name: 'Training', path: '/training', icon: Activity, disabled: false },
    { name: 'Sampling', path: '/sampling', icon: Sparkles, disabled: false },
    { name: 'Backup', path: '/backup', icon: Archive, disabled: false },
    { name: 'Tools', path: '/tools', icon: Wrench, disabled: true },
    { name: 'Cloud', path: '/cloud', icon: Cloud, disabled: true },
    { name: 'LoRA', path: '/lora', icon: Cpu, disabled: false },
    { name: 'Secrets', path: '/secrets', icon: Key, disabled: false },
```

- [ ] **Step 4: Create redirect script `web/src/routes/datasets/+page.ts` and remove old page**

Run: `rm web/src/routes/datasets/+page.svelte`

Create `web/src/routes/datasets/+page.ts`:
```ts
import { redirect } from '@sveltejs/kit';

export const load = () => {
  throw redirect(307, '/data');
};
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd web && bun test src/lib/components/shell/Rail.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/components/shell/Rail.svelte web/src/lib/components/shell/Rail.test.ts web/src/routes/datasets/+page.ts
git rm web/src/routes/datasets/+page.svelte
git commit -m "feat(webui): remove Datasets item from nav rail and add 307 redirect to /data"
```

---

### Task 3: Update Dataset Detail Subroute Back Link & Verify Test Suite

**Files:**
- Modify: `web/src/routes/datasets/[id]/+page.svelte`
- Test: `web/src/routes/datasets/[id]/DatasetDetailPage.test.ts`

**Interfaces:**
- Consumes: Nav link in `DatasetDetailPage`
- Produces: Back link pointing to `/data` (`"← Back to Data"`)

- [ ] **Step 1: Update back link in `web/src/routes/datasets/[id]/+page.svelte`**

Update `web/src/routes/datasets/[id]/+page.svelte` line 90:
```svelte
<a href="/data" class="btn-back">
  <ArrowLeft size={16} />
  <span>Back to Data</span>
</a>
```

- [ ] **Step 2: Update test in `web/src/routes/datasets/[id]/DatasetDetailPage.test.ts`**

Update `web/src/routes/datasets/[id]/DatasetDetailPage.test.ts`:
```ts
test('renders dataset detail header and upload button', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({
      data: {
        name: 'TestDataset',
        path: '/workspace/datasets/TestDataset',
        items: [
          {
            id: 'sample_01',
            image_name: 'sample_01.png',
            caption_name: 'sample_01.txt',
            caption_content: 'a beautiful cat',
          },
        ],
      },
      isLoading: false,
    }) as any
  );

  render(DatasetDetailPage, { data: { id: 'TestDataset' } });
  expect(screen.getByText('Back to Data')).toBeInTheDocument();
  expect(screen.getByText('Add Files')).toBeInTheDocument();
  expect(await screen.findByText('TestDataset')).toBeInTheDocument();
  expect(await screen.findByText('sample_01')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run full Vitest & Pytest test suites**

Run: `cd web && bun run test`
Expected: 110/110 PASS

Run: `PYTHONPATH=. pytest tests/webui/ -v`
Expected: 109/109 PASS

Run: `cd web && bun run build`
Expected: Build succeeds cleanly

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/datasets/[id]/+page.svelte web/src/routes/datasets/[id]/DatasetDetailPage.test.ts
git commit -m "feat(webui): update dataset detail back link to /data and verify full test suite"
```
