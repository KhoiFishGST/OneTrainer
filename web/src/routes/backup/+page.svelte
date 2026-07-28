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
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import FormPageSkeleton from '$lib/components/loading/FormPageSkeleton.svelte';
  import { Button } from '$lib/components/ui/button';
  import { toast as sonnerToast } from 'svelte-sonner';

  const ctx = getRouteContext();
  const backupMutation = createRequestBackupMutation();
  const saveMutation = createRequestSaveMutation();

  let toastMessage = $state<{ message: string; type: 'success' | 'error' } | null>(null);

  function triggerToast(message: string, type: 'success' | 'error' = 'success') {
    toastMessage = { message, type };
    if (type === 'error') {
      sonnerToast.error(message);
    } else {
      sonnerToast.success(message);
    }
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
        <Button
          variant="secondary"
          class="btn btn-secondary"
          disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $backupMutation.isPending}
          onclick={handleBackup}
          title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate model backup checkpoint' : 'Active training run required to backup now'}
        >
          <Archive size={16} />
          <span>Backup Now</span>
        </Button>

        <Button
          variant="secondary"
          class="btn btn-secondary"
          disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $saveMutation.isPending}
          onclick={handleSave}
          title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate model save' : 'Active training run required to save model now'}
        >
          <Save size={16} />
          <span>Save Model Now</span>
        </Button>
      {/snippet}
    </PageHeader>

    {#if toastMessage}
      <div role="status" class="sr-only">
        {toastMessage.message}
      </div>
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

  /* Bits UI boundary: style backup header component */
  .route-page :global(.backup-header) {
    margin-bottom: 1.5rem;
  }

  /* Bits UI boundary: style backup toast component */
  .route-page :global(.backup-toast) {
    margin-bottom: 1rem;
  }

  /* Bits UI boundary: style Button component */
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
</style>
