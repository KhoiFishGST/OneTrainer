<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import PathInput from '$lib/components/form/PathInput.svelte';
  import { Switch as Toggle } from '$lib/components/ui/switch/index.js';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import { Alert } from '$lib/components/ui/alert';
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
      throw err;
    }
  }
</script>

<div class="p-6 flex flex-col gap-6">
  <PageHeader title="Datasets" />

  <div class="flex flex-col gap-4 bg-card p-4 md:p-5 rounded-lg border border-border w-[740px] max-w-full box-border">
    <div class="flex items-center gap-4">
      <span class="text-sm font-medium text-muted-foreground whitespace-nowrap">Base Directory:</span>
      <div class="flex-1">
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
      <div class="h-px bg-border"></div>
      <div class="flex items-center gap-8 flex-wrap">
        <div class="flex items-center gap-2.5">
          <Toggle
            id="aspect_ratio_bucketing"
            value={Boolean(ctx.workspace.draft?.aspect_ratio_bucketing)}
            onChange={(val) => ctx.workspace.setRaw('aspect_ratio_bucketing', val)}
          />
          <label for="aspect_ratio_bucketing" class="text-sm text-foreground">Aspect Ratio Bucketing</label>
        </div>
        <div class="flex items-center gap-2.5">
          <Toggle
            id="latent_caching"
            value={Boolean(ctx.workspace.draft?.latent_caching)}
            onChange={(val) => ctx.workspace.setRaw('latent_caching', val)}
          />
          <label for="latent_caching" class="text-sm text-foreground">Latent Caching</label>
        </div>
        <div class="flex items-center gap-2.5">
          <Toggle
            id="clear_cache_before_training"
            value={Boolean(ctx.workspace.draft?.clear_cache_before_training)}
            onChange={(val) => ctx.workspace.setRaw('clear_cache_before_training', val)}
          />
          <label for="clear_cache_before_training" class="text-sm text-foreground">Clear cache before training</label>
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

<ResponsiveDialogDrawer
  bind:open={showCreateModal}
  onOpenChange={(val) => {
    if (!val) showCreateModal = false;
  }}
  title="Create New Dataset"
>
  <div class="flex flex-col gap-2 py-2">
    <label for="ds-name-input" class="text-sm font-medium">Dataset Name</label>
    <TextInput
      id="ds-name-input"
      placeholder="e.g. Dataset 1"
      value={newDatasetName}
      onInput={(val) => (newDatasetName = val)}
    />
    {#if createError}
      <Alert variant="destructive" class="text-xs m-0 text-destructive">{createError}</Alert>
    {/if}
  </div>

  {#snippet footer()}
    <div class="flex items-center justify-end gap-3 w-full">
      <Button
        type="button"
        variant="secondary"
        onclick={() => (showCreateModal = false)}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="default"
        onclick={handleCreateDataset}
      >
        Create
      </Button>
    </div>
  {/snippet}
</ResponsiveDialogDrawer>
