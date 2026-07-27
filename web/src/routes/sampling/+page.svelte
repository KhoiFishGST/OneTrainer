<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles, Plus } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import Select from '$lib/components/form/Select.svelte';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import SampleDetailModal from '$lib/components/sampling/SampleDetailModal.svelte';
  import SamplePromptTable from '$lib/components/sampling/SamplePromptTable.svelte';
  import { trainingStore } from '$lib/events/training-store';
  import { api } from '$lib/api/client';
  import {
    createRequestSampleMutation,
    createSamplesQuery,
    createUpdateSamplesMutation,
    createSampleFilesQuery,
    createCreateSampleFileMutation,
  } from '$lib/api/queries';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Toast from '$lib/components/ui/Toast.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import FormPageSkeleton from '$lib/components/ui/FormPageSkeleton.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import TextInput from '$lib/components/form/TextInput.svelte';

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

  let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);

  function triggerToast(message: string, type: 'success' | 'error' = 'success') {
    toast = { message, type };
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
    const updated = samples.map((s: any, i: number) => (i === index ? updatedSample : s));
    try {
      await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
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

  async function handleDeleteSample(index: number) {
    const updated = samples.filter((_: any, i: number) => i !== index);
    try {
      await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
      triggerToast('Sample prompt deleted', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to delete sample prompt', 'error');
    }
  }

  async function handleSaveSample(savedSample: any) {
    let updated: any[];
    if (modalMode === 'add' || editingIndex === -1) {
      const { webui_id: _, ...newSample } = savedSample;
      updated = [...samples, newSample];
    } else {
      updated = samples.map((s: any, i: number) => (i === editingIndex ? savedSample : s));
    }
    isModalOpen = false;
    try {
      await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
      triggerToast(modalMode === 'add' ? 'Sample prompt added' : 'Sample prompt saved', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to save sample prompt', 'error');
    }
  }
</script>

{#if !ctx.workspace}
  <FormPageSkeleton />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'Sampling'} class="sampling-header">
      {#snippet actions()}
        <Button
          variant="secondary"
          class="btn btn-secondary"
          disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $sampleMutation.isPending}
          onclick={handleSample}
          title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate sample image generation' : 'Active training run required to sample now'}
        >
          <Sparkles size={16} />
          <span>Sample Now</span>
        </Button>
      {/snippet}
    </PageHeader>

    {#if toast}
      <Toast
        message={toast.message}
        tone={toast.type}
        onDismiss={() => (toast = null)}
        class="sampling-toast"
      />
    {/if}

    <div class="config-bar">
      <div class="config-selector">
        <label for="sample-config-select" class="config-label">Sample Configuration:</label>
        <div class="select-wrapper">
          <Select
            id="sample-config-select"
            value={currentConfigFile}
            options={sampleFileOptions.length > 0 ? sampleFileOptions : [{ value: 'samples.json', label: 'samples.json' }]}
            onChange={handleSelectConfigFile}
          />
        </div>
        <Button
          variant="secondary"
          class="btn btn-secondary add-config-btn"
          onclick={handleOpenAddConfigModal}
        >
          <Plus size={16} />
          <span>+ Add Config</span>
        </Button>
      </div>
    </div>

    <div class="options-panel">
      <SchemaForm
        {tab}
        values={ctx.workspace.draft}
        issues={ctx.workspace.errors}
        setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
        openDirectory={ctx.openDirectory}
      />
    </div>

    <div class="section-divider">
      <h2 class="section-title">Sample Prompts ({samples.length})</h2>
    </div>

    {#if queued}
      <Alert tone="info" class="sampling-queued-alert">
        Sample prompt changes are queued for the next sampling batch.
      </Alert>
    {/if}

    <SamplePromptTable
      {samples}
      onUpdate={handleUpdateSample}
      onEditModal={handleEditSample}
      onClone={handleCloneSample}
      onDelete={handleDeleteSample}
      onAdd={handleAddSample}
    />
  </div>
{/if}

<ModalDialog
  open={isConfigModalOpen}
  title="Add Sample Configuration"
  applyText="Create File"
  cancelText="Cancel"
  onClose={() => (isConfigModalOpen = false)}
  onApply={handleCreateConfigFile}
>
  <div class="config-modal-body">
    <label for="new-config-name" class="modal-label">Configuration Name</label>
    <TextInput
      id="new-config-name"
      placeholder="e.g. portrait_samples.json"
      value={newConfigName}
      onInput={(val) => (newConfigName = val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCreateConfigFile();
        }
      }}
    />
    {#if configModalError}
      <Alert tone="error" class="modal-error">{configModalError}</Alert>
    {/if}
  </div>
</ModalDialog>

<SampleDetailModal
  open={isModalOpen}
  sample={editingSample}
  mode={modalMode}
  onSave={handleSaveSample}
  onClose={() => (isModalOpen = false)}
/>

<style>
  .route-page {
    padding: 1.5rem;
  }

  .route-page :global(.sampling-header) {
    margin-bottom: 1.5rem;
  }

  .route-page :global(.sampling-toast) {
    margin-bottom: 1rem;
  }

  .route-page :global(.sampling-queued-alert) {
    display: block;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    margin-bottom: 1rem;
    background-color: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: var(--accent, #60a5fa);
  }

  .route-page :global(.btn) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 0;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, opacity 0.15s ease;
  }

  .route-page :global(.btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .route-page :global(.btn-secondary) {
    background-color: var(--panel-raised, var(--control, #14191f));
    color: var(--text, #e6ebef);
    border-color: var(--line, #2d3741);
  }

  .route-page :global(.btn-secondary:hover:not(:disabled)) {
    background-color: var(--line, #2d3741);
  }

  .config-bar {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
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
    color: var(--text, #e6ebef);
    white-space: nowrap;
  }

  .select-wrapper {
    min-width: 220px;
  }

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
    border-bottom: 1px solid var(--line, #2d3741);
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    color: var(--text, #f8fafc);
  }

  .config-modal-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .config-modal-body :global(.text-input) {
    min-width: 0;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--line, #2d3741);
    background: var(--control, #14191f);
    color: var(--text, #e6ebef);
    font-size: 0.875rem;
    box-sizing: border-box;
  }

  .config-modal-body :global(.text-input:focus) {
    outline: none;
    border-color: var(--accent, #3b82f6);
    box-shadow: none;
  }

  .modal-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text, #e6ebef);
  }

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
