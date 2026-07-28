<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles, Plus } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import SampleDetailModal from '$lib/components/sampling/SampleDetailModal.svelte';
  import SamplePromptTable from '$lib/components/sampling/SamplePromptTable.svelte';
  import SamplePromptCards from '$lib/components/sampling/SamplePromptCards.svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import { trainingStore } from '$lib/events/training-store';
  import { api } from '$lib/api/client';
  import {
    createRequestSampleMutation,
    createSamplesQuery,
    createUpdateSamplesMutation,
    createSampleFilesQuery,
    createCreateSampleFileMutation,
  } from '$lib/api/queries';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import FormPageSkeleton from '$lib/components/loading/FormPageSkeleton.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import { toast as sonnerToast } from 'svelte-sonner';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';

  const ctx = getRouteContext();
  const sampleMutation = createRequestSampleMutation();
  const samplesQuery = createSamplesQuery(() => currentConfigFile);
  const updateSamplesMutation = createUpdateSamplesMutation();
  const sampleFilesQuery = createSampleFilesQuery();
  const createSampleFileMutation = createCreateSampleFileMutation();

  const samples = $derived(Array.isArray($samplesQuery.data) ? $samplesQuery.data : ($samplesQuery.data?.samples ?? []));
  const queued = $derived(!Array.isArray($samplesQuery.data) && Boolean($samplesQuery.data?.queued));

  const sampleFiles = $derived($sampleFilesQuery.data?.files ?? []);
  const sampleFileOptions = $derived(
    sampleFiles.map((f: string) => ({ value: f, label: f }))
  );

  let currentConfigFile = $derived(
    ctx.workspace?.draft?.sample_definition_file_name || 'samples.json'
  );

  let isModalOpen = $state(false);
  let editingSample = $state<any>(null);
  let editingIndex = $state<number>(-1);
  let modalMode = $state<'add' | 'edit'>('add');

  let isConfigModalOpen = $state(false);
  let newConfigName = $state('');
  let configModalError = $state('');

  let sampleToDeleteTarget = $state<any>(null);
  let isDeleteConfirmOpen = $state(false);
  let isDeletingSample = $state(false);
  let deleteSampleError = $state<string | null>(null);

  type SampleDraft = {
    width?: string;
    height?: string;
    seed?: string;
  };

  let drafts = $state<Record<string, SampleDraft>>({});
  let mobile = $derived(isMobile.current);

  function getSampleIdentity(sample: any, index: number): string {
    return sample?.webui_id ?? `sample_${index}`;
  }

  function resolveSampleIndex(target: any): number {
    if (!target) return -1;
    return samples.findIndex(
      (s: any) => s === target || (s.webui_id && s.webui_id === target.webui_id)
    );
  }

  function handleDraftChange(index: number, field: keyof SampleDraft, val: string) {
    const sample = samples[index];
    const identity = getSampleIdentity(sample, index);
    drafts[identity] = {
      ...drafts[identity],
      [field]: val,
    };
  }

  function triggerToast(message: string, type: 'success' | 'error' = 'success') {
    type === 'success' ? sonnerToast.success(message) : sonnerToast.error(message);
  }

  onMount(async () => {
    try {
      const statusData = await api.getTrainingStatus();
      if (statusData) trainingStore.setStatus(statusData);
    } catch {
      // ignore
    }
  });

  const rawTab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'sampling') ?? {
      id: 'sampling',
      label: 'Sampling',
      groups: [],
    }
  );

  const tab = $derived({
    ...rawTab,
    groups: (rawTab.groups || []).map((group: any) => ({
      ...group,
      fields: (group.fields || []).filter(
        (f: any) => f.id !== 'samples' && f.id !== 'sample_definition_file_name'
      ),
    })),
  });

  const status = $derived($trainingStore.status);

  async function handleSample() {
    try {
      await $sampleMutation.mutateAsync();
      triggerToast('Sample generation requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request sample', 'error');
    }
  }

  function handleSelectConfigFile(val: string) {
    if (ctx.workspace?.setRaw) {
      ctx.workspace.setRaw('sample_definition_file_name', val);
    }
  }

  function handleOpenAddConfigModal() {
    newConfigName = '';
    configModalError = '';
    isConfigModalOpen = true;
  }

  async function handleCreateConfigFile() {
    const name = newConfigName.trim();
    if (!name) {
      configModalError = 'Config name cannot be empty';
      return;
    }
    try {
      const res = await $createSampleFileMutation.mutateAsync(name);
      if (res?.filename) {
        if (ctx.workspace?.setRaw) {
          ctx.workspace.setRaw('sample_definition_file_name', res.filename);
        }
        triggerToast(`Sample config file created: ${res.filename}`, 'success');
      }
      isConfigModalOpen = false;
    } catch (err: any) {
      configModalError = err?.message || 'Failed to create sample config file';
    }
  }

  function handleAddSample() {
    editingSample = null;
    editingIndex = -1;
    modalMode = 'add';
    isModalOpen = true;
  }

  function handleEditSample(index: number) {
    editingSample = samples[index];
    editingIndex = index;
    modalMode = 'edit';
    isModalOpen = true;
  }

  async function handleUpdateSample(index: number, updatedSample: any) {
    const target = samples[index];
    const currentIndex = resolveSampleIndex(target);
    if (currentIndex === -1) {
      triggerToast('That sample prompt no longer exists', 'error');
      return;
    }
    const updated = samples.map((s: any, i: number) =>
      i === currentIndex ? updatedSample : s
    );
    try {
      await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
      const identity = getSampleIdentity(target, currentIndex);
      if (drafts[identity]) {
        delete drafts[identity];
      }
      triggerToast('Sample prompt updated', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to update sample prompt', 'error');
    }
  }

  async function handleCloneSample(index: number) {
    const target = samples[index];
    const { webui_id: _discardedWebuiId, ...clone } = structuredClone(target);
    const updated = [...samples, clone];
    try {
      await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
      triggerToast('Sample prompt cloned', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to clone sample prompt', 'error');
    }
  }

  function promptDeleteSample(index: number) {
    const target = samples[index];
    if (!target) return;
    sampleToDeleteTarget = target;
    deleteSampleError = null;
    isDeleteConfirmOpen = true;
  }

  async function confirmDeleteSample() {
    if (!sampleToDeleteTarget || isDeletingSample) return;
    deleteSampleError = null;
    isDeletingSample = true;

    const targetIndex = resolveSampleIndex(sampleToDeleteTarget);
    if (targetIndex === -1) {
      deleteSampleError = 'That sample prompt no longer exists';
      isDeletingSample = false;
      return;
    }
    const updated = samples.filter((_: any, i: number) => i !== targetIndex);

    try {
      await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
      const identity = getSampleIdentity(sampleToDeleteTarget, targetIndex);
      if (drafts[identity]) {
        delete drafts[identity];
      }
      isDeleteConfirmOpen = false;
      sampleToDeleteTarget = null;
      triggerToast('Sample prompt deleted', 'success');
    } catch (err: any) {
      deleteSampleError = err?.message || 'Failed to delete sample prompt';
    } finally {
      isDeletingSample = false;
    }
  }

  async function handleSaveSampleModal(sampleData: any) {
    let updated: any[];
    if (modalMode === 'add') {
      updated = [...samples, sampleData];
    } else {
      const currentIndex = resolveSampleIndex(editingSample);
      if (currentIndex === -1) {
        triggerToast('That sample prompt no longer exists', 'error');
        return;
      }
      updated = samples.map((s: any, i: number) =>
        i === currentIndex ? sampleData : s
      );
    }
    try {
      await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
      isModalOpen = false;
      triggerToast(
        modalMode === 'add' ? 'Sample prompt added' : 'Sample prompt updated',
        'success'
      );
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to save sample prompt', 'error');
    }
  }
</script>

{#if !ctx.workspace}
  <FormPageSkeleton label="Loading sampling configuration" />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'Sampling'}>
      {#snippet actions()}
        <Button
          type="button"
          variant="default"
          disabled={$sampleMutation.isPending || queued}
          onclick={handleSample}
        >
          <Sparkles size={16} />
          <span>{queued ? 'Sample Queued' : $sampleMutation.isPending ? 'Requesting...' : 'Sample Now'}</span>
        </Button>
      {/snippet}
    </PageHeader>

    {#if queued}
      <Alert role="status" class="queued-alert">
        <span>Sample prompt changes are queued for the next sampling batch.</span>
      </Alert>
    {/if}

    <div class="config-bar">
      <div class="config-selector">
        <label for="sample-config-select" class="config-label">
          Sample Definition File
        </label>
        <div class="select-wrapper">
          <Select
            id="sample-config-select"
            value={currentConfigFile}
            options={sampleFileOptions}
            onChange={handleSelectConfigFile}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          class="add-config-btn"
          onclick={handleOpenAddConfigModal}
        >
          <Plus size={16} />
          <span>Add Config</span>
        </Button>
      </div>
    </div>

    <div class="options-panel">
      {#if (tab.groups?.length ?? 0) > 0}
        <SchemaForm
          {tab}
          values={ctx.workspace.draft}
          issues={ctx.workspace.errors}
          setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
          openDirectory={ctx.openDirectory}
        />
      {/if}
    </div>

    <div class="prompts-section">
      <div class="section-divider">
        <h2 class="section-title">Sample Prompts ({samples.length})</h2>
      </div>

      {#if mobile}
        <SamplePromptCards
          {samples}
          {drafts}
          onUpdate={handleUpdateSample}
          onDraftChange={handleDraftChange}
          onEditModal={handleEditSample}
          onClone={handleCloneSample}
          onDelete={promptDeleteSample}
          onAdd={handleAddSample}
        />
      {:else}
        <SamplePromptTable
          {samples}
          {drafts}
          onUpdate={handleUpdateSample}
          onDraftChange={handleDraftChange}
          onEditModal={handleEditSample}
          onClone={handleCloneSample}
          onDelete={promptDeleteSample}
          onAdd={handleAddSample}
        />
      {/if}
    </div>
  </div>
{/if}

<ResponsiveDialogDrawer
  open={isConfigModalOpen}
  onOpenChange={(val) => {
    if (!val) isConfigModalOpen = false;
  }}
  title="New Sample Definition File"
  class="max-w-md"
>
  <div class="config-modal-body">
    <label for="new-config-filename-input" class="modal-label">Filename</label>
    <TextInput
      id="new-config-filename-input"
      value={newConfigName}
      onInput={(val) => (newConfigName = val)}
      placeholder="e.g. portrait_samples.json"
    />
    {#if configModalError}
      <Alert variant="destructive" class="modal-error">{configModalError}</Alert>
    {/if}
  </div>

  {#snippet footer()}
    <div class="dialog-actions-footer">
      <Button
        type="button"
        variant="secondary"
        onclick={() => (isConfigModalOpen = false)}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="default"
        onclick={handleCreateConfigFile}
      >
        Create File
      </Button>
    </div>
  {/snippet}
</ResponsiveDialogDrawer>

{#if isModalOpen}
  <SampleDetailModal
    open={isModalOpen}
    sample={editingSample}
    mode={modalMode}
    onSave={handleSaveSampleModal}
    onClose={() => (isModalOpen = false)}
  />
{/if}

{#if isDeleteConfirmOpen}
  <AlertDialog.Root open={isDeleteConfirmOpen} onOpenChange={(v) => { if (!v && !isDeletingSample) isDeleteConfirmOpen = false; }}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Delete Sample Prompt?</AlertDialog.Title>
        <AlertDialog.Description>
          Are you sure you want to delete this sample prompt?
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if deleteSampleError}
        <Alert variant="destructive" class="my-2">
          <span>{deleteSampleError}</span>
        </Alert>
      {/if}
      <AlertDialog.Footer>
        <AlertDialog.Cancel disabled={isDeletingSample} onclick={() => (isDeleteConfirmOpen = false)}>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action disabled={isDeletingSample} onclick={confirmDeleteSample}>
          Delete
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

<style>
  .dialog-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    width: 100%;
  }

  .route-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Bits UI boundary: style disabled Button component */
  .route-page :global(.btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Bits UI boundary: style secondary Button component */
  .route-page :global(.btn-secondary) {
    background-color: var(--card, #14191f);
    color: var(--foreground, #e6ebef);
    border-color: var(--border, #2d3741);
  }

  /* Bits UI boundary: style secondary Button component hover state */
  .route-page :global(.btn-secondary:hover:not(:disabled)) {
    background-color: var(--border, #2d3741);
  }

  .config-bar {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--card, #1d242c);
    border: 1px solid var(--border, #2d3741);
    border-radius: 8px;
  }

  .config-selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .config-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--foreground, #e6ebef);
    white-space: nowrap;
  }

  .select-wrapper {
    min-width: 220px;
  }

  /* Bits UI boundary: style add config Button component */
  .config-selector :global(.add-config-btn) {
    white-space: nowrap;
  }

  .options-panel {
    width: 740px;
    max-width: 100%;
    margin-bottom: 2rem;
    box-sizing: border-box;
  }

  .section-divider {
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border, #2d3741);
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    color: var(--foreground, #f8fafc);
  }

  .config-modal-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Bits UI boundary: style TextInput child component */
  .config-modal-body :global(.text-input) {
    min-width: 0;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border, #2d3741);
    background: var(--muted, #14191f);
    color: var(--foreground, #e6ebef);
    font-size: 0.875rem;
    box-sizing: border-box;
  }

  /* Bits UI boundary: style TextInput focus state */
  .config-modal-body :global(.text-input:focus) {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: none;
  }

  .modal-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground, #e6ebef);
  }

  /* Bits UI boundary: style modal error Alert component */
  .config-modal-body :global(.modal-error) {
    display: block;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-size: 0.8125rem;
    color: #f87171;
  }
</style>
