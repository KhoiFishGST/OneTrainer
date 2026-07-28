<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import PathInput from '$lib/components/form/PathInput.svelte';
  import { Switch as Toggle } from '$lib/components/ui/switch/index.js';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import Alert from '$lib/components/ui/Alert.svelte';
  import DatasetCollection from '$lib/components/datasets/DatasetCollection.svelte';
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
    ctx?.workspace?.draft?.datasets_dir ?? $datasetsQuery.data?.base_dir ?? 'training_datasets'
  );
  let showCreateModal = $state(false);
  let newDatasetName = $state('');
  let createError = $state<string | null>(null);
  let isDeleting = $derived($deleteMutation.isPending);

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

  async function handleDeleteDataset(name: string) {
    try {
      await $deleteMutation.mutateAsync(name);
    } catch (err) {
      console.error('Failed to delete dataset', err);
    }
  }
</script>

<div class="route-page">
  <PageHeader title="Datasets" />

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

  <DatasetCollection
    {datasets}
    onAdd={openCreateModal}
    onDelete={handleDeleteDataset}
    {isDeleting}
  />
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
    <TextInput
      id="ds-name-input"
      placeholder="e.g. Dataset 1"
      value={newDatasetName}
      onInput={(val) => (newDatasetName = val)}
    />
    {#if createError}
      <Alert tone="error" class="error-text">{createError}</Alert>
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

  .options-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--panel, #182026);
    padding: 1rem 1.25rem;
    border-radius: 8px;
    border: 1px solid var(--line, #2d3741);
    width: 740px;
    max-width: 100%;
    box-sizing: border-box;
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

  .create-modal-content :global(.error-text) {
    color: var(--danger, #ef4444);
    font-size: 0.75rem;
    margin: 0;
  }
</style>
