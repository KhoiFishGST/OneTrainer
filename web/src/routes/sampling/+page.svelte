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
  <div class="p-6 flex flex-col gap-6">
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

    <div class="mb-6 p-4 bg-card border border-border rounded-lg">
      <div class="flex items-center gap-3 flex-wrap">
        <label for="sample-config-select" class="text-sm font-semibold text-foreground whitespace-nowrap">
          Sample Definition File
        </label>
        <div class="min-w-[220px]">
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
          class="whitespace-nowrap"
          onclick={handleOpenAddConfigModal}
        >
          <Plus size={16} />
          <span>Add Config</span>
        </Button>
      </div>
    </div>

    <div class="options-panel w-[740px] max-w-full mb-8 box-border">
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

    <div>
      <div class="mb-4 pb-2 border-b border-border">
        <h2 class="text-lg font-semibold m-0 text-foreground">Sample Prompts ({samples.length})</h2>
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
  <div class="flex flex-col gap-2">
    <label for="new-config-filename-input" class="text-sm font-medium text-foreground">Filename</label>
    <TextInput
      id="new-config-filename-input"
      value={newConfigName}
      onInput={(val) => (newConfigName = val)}
      placeholder="e.g. portrait_samples.json"
    />
    {#if configModalError}
      <Alert variant="destructive" class="p-0 border-0 bg-transparent text-xs text-destructive">{configModalError}</Alert>
    {/if}
  </div>

  {#snippet footer()}
    <div class="flex items-center justify-end gap-3 w-full">
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
