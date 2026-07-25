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

  const ctx: any = (() => {
    try {
      return getRouteContext();
    } catch {
      return null;
    }
  })();

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
    <h1 class="page-title">Datasets</h1>
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
            value={Boolean(ctx.workspace.draft?.aspect_ratio_bucketing)}
            onChange={(val) => ctx.workspace.setRaw('aspect_ratio_bucketing', val)}
          />
          <span class="toggle-label">Aspect Ratio Bucketing</span>
        </div>
        <div class="toggle-item">
          <Toggle
            id="latent_caching"
            value={Boolean(ctx.workspace.draft?.latent_caching)}
            onChange={(val) => ctx.workspace.setRaw('latent_caching', val)}
          />
          <span class="toggle-label">Latent Caching</span>
        </div>
        <div class="toggle-item">
          <Toggle
            id="clear_cache_before_training"
            value={Boolean(ctx.workspace.draft?.clear_cache_before_training)}
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
  bind:open={showCreateModal}
  title="Create New Dataset"
  applyText="Create"
  cancelText="Cancel"
  onClose={() => (showCreateModal = false)}
  onApply={handleCreateDataset}
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
</style>
