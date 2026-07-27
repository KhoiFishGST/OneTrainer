<script lang="ts">
  import { onMount } from 'svelte';
  import { Archive, Save } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import { trainingStore } from '$lib/events/training-store';
  import { api } from '$lib/api/client';
  import {
    createRequestBackupMutation,
    createRequestSaveMutation,
  } from '$lib/api/queries';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Toast from '$lib/components/ui/Toast.svelte';
  import FormPageSkeleton from '$lib/components/ui/FormPageSkeleton.svelte';

  const ctx = getRouteContext();
  const backupMutation = createRequestBackupMutation();
  const saveMutation = createRequestSaveMutation();

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

  const status = $derived($trainingStore.status);
  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'backup') ?? {
      id: 'backup',
      label: 'Backup',
      groups: [],
    }
  );

  async function handleBackup() {
    try {
      await $backupMutation.mutateAsync();
      triggerToast('Model backup requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request backup', 'error');
    }
  }

  async function handleSave() {
    try {
      await $saveMutation.mutateAsync();
      triggerToast('Model save requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request model save', 'error');
    }
  }
</script>

{#if !ctx.workspace}
  <FormPageSkeleton />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'Backup'} class="backup-header">
      {#snippet actions()}
        <button
          type="button"
          class="btn btn-secondary"
          disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $backupMutation.isPending}
          onclick={handleBackup}
          title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate model backup checkpoint' : 'Active training run required to backup now'}
        >
          <Archive size={16} />
          <span>Backup Now</span>
        </button>

        <button
          type="button"
          class="btn btn-secondary"
          disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $saveMutation.isPending}
          onclick={handleSave}
          title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate model save' : 'Active training run required to save model now'}
        >
          <Save size={16} />
          <span>Save Model Now</span>
        </button>
      {/snippet}
    </PageHeader>

    {#if toast}
      <Toast
        message={toast.message}
        tone={toast.type}
        onDismiss={() => (toast = null)}
        class="backup-toast"
      />
    {/if}

    <SchemaForm
      {tab}
      values={ctx.workspace.draft}
      issues={ctx.workspace.errors}
      setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
      openDirectory={ctx.openDirectory}
    />
  </div>
{/if}

<style>
  .route-page {
    padding: 1.5rem;
  }

  :global(.backup-header) {
    margin-bottom: 1.5rem;
  }

  :global(.backup-toast) {
    margin-bottom: 1rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, opacity 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: var(--panel-raised, var(--control, #14191f));
    color: var(--text, #e6ebef);
    border-color: var(--line, #2d3741);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--line, #2d3741);
  }
</style>
