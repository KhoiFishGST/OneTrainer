<script lang="ts">
  import { Plus, Trash2 } from 'lucide-svelte';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import PathInput from '$lib/components/form/PathInput.svelte';
  import { getRouteContext } from '$lib/config/context';
  import {
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
    // context not available in isolated test
  }

  const datasetsQuery = createDatasetsQuery();
  const createMutation = createCreateDatasetMutation();
  const deleteMutation = createDeleteDatasetMutation();

  let datasets = $derived(datasetsQuery.data?.datasets || []);
  let baseDir = $derived(datasetsQuery.data?.base_dir || 'workspace/datasets');
  let resolvedBaseDir = $derived(datasetsQuery.data?.resolved_base_dir || '');
  let loading = $derived(datasetsQuery.isLoading);
  let showCreateModal = $state(false);
  let newDatasetName = $state('');
  let createError = $state<string | null>(null);

  function handleBaseDirChange(newPath: string) {
    if (ctx?.workspace) {
      ctx.workspace.setRaw('datasets_dir', newPath);
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

    // OS safe name regex: alphanumeric, spaces, hyphens, underscores
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

<div class="datasets-page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Datasets</h1>
      <p class="page-subtitle">Create and manage image & caption datasets</p>
    </div>
  </div>

  <div class="base-dir-bar">
    <span class="base-dir-label">Base Directory:</span>
    <div class="base-dir-input-wrapper">
      <PathInput
        id="base-datasets-dir"
        value={baseDir}
        mode="dir"
        onInput={handleBaseDirChange}
        onChange={handleBaseDirChange}
      />
      {#if resolvedBaseDir && resolvedBaseDir !== baseDir}
        <span class="resolved-path-hint" title="Resolved server filesystem path">
          Server path: {resolvedBaseDir}
        </span>
      {/if}
    </div>
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
          <img src={ds.thumbnail_url} alt={ds.name} class="thumbnail-img" />
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
          <span class="count-badge">{ds.image_count} images</span>
          <span class="dot-separator">•</span>
          <span class="count-badge">{ds.caption_count} captions</span>
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
  onClose={() => { showCreateModal = false; createError = null; }}
  onApply={handleCreateDataset}
>
  <div class="modal-form-content">
    <label for="ds-name-input" class="form-label">Dataset Name</label>
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
  .datasets-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text, #f8fafc);
    margin: 0;
  }

  .page-subtitle {
    color: var(--muted, #8995a1);
    font-size: 0.875rem;
    margin: 0.25rem 0 0 0;
  }

  .base-dir-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--panel, #182026);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--line, #2d3741);
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

  .datasets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .card {
    background: var(--panel, #182026);
    border: 1px solid var(--line, #2d3741);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .card:hover {
    transform: translateY(-2px);
    border-color: var(--accent, #3b82f6);
  }

  .add-card {
    min-height: 200px;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    cursor: pointer;
    background: transparent;
    border: 2px dashed var(--line, #2d3741);
    color: var(--muted, #8995a1);
  }

  .add-card:hover {
    border-color: var(--accent, #3b82f6);
    color: var(--accent, #3b82f6);
  }

  .add-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-label {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .thumbnail-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: #0f1419;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 60%);
    padding: 0.75rem;
  }

  .dataset-name {
    color: #ffffff;
    font-weight: 600;
    font-size: 1rem;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }

  .btn-delete {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: #ef4444;
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dataset-card:hover .btn-delete {
    opacity: 1;
  }

  .btn-delete:hover {
    background: rgba(239, 68, 68, 0.8);
    color: #ffffff;
  }

  .card-footer {
    padding: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--muted, #8995a1);
  }

  .dot-separator {
    color: var(--line, #2d3741);
  }

  .modal-form-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text, #f8fafc);
  }

  .text-input {
    padding: 0.5rem 0.75rem;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--accent, #3b82f6);
  }

  .error-text {
    color: #ef4444;
    font-size: 0.8125rem;
    margin: 0;
  }
</style>
