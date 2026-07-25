<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import { trainingStore } from '$lib/events/training-store';
  import { api } from '$lib/api/client';
  import { createRequestSampleMutation } from '$lib/api/queries';

  const ctx = getRouteContext();
  const sampleMutation = createRequestSampleMutation();

  let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
  let toastTimeout: any;

  function triggerToast(message: string, type: 'success' | 'error' = 'success') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast = { message, type };
    toastTimeout = setTimeout(() => {
      toast = null;
    }, 4000);
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
    ctx.schema?.tabs?.find((t) => t.id === 'sampling') ?? {
      id: 'sampling',
      label: 'Sampling',
      groups: [],
    }
  );

  async function handleSample() {
    try {
      await $sampleMutation.mutateAsync();
      triggerToast('Sample generation requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request sample', 'error');
    }
  }
</script>

{#if !ctx.workspace}
  <div class="skeleton-container" aria-label="Loading configuration">
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
  </div>
{:else}
  <div class="route-page">
    <div class="page-header">
      <h1 class="page-title">{tab.label || 'Sampling'}</h1>
      <div class="header-actions">
        <button
          type="button"
          class="btn btn-secondary"
          disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $sampleMutation.isPending}
          onclick={handleSample}
          title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate sample image generation' : 'Active training run required to sample now'}
        >
          <Sparkles size={16} />
          <span>Sample Now</span>
        </button>
      </div>
    </div>

    {#if toast}
      <div class="toast-banner {toast.type} toast-{toast.type}" role="status">
        {toast.message}
      </div>
    {/if}

    <SchemaForm
      {tab}
      values={ctx.workspace.draft}
      issues={ctx.workspace.errors}
      setRaw={(path, val) => ctx.workspace?.setRaw(path, val)}
      openDirectory={ctx.openDirectory}
    />
  </div>
{/if}

<style>
  .route-page {
    padding: 1.5rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  .toast-banner {
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .toast-banner.success,
  .toast-success {
    background-color: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .toast-banner.error,
  .toast-error {
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
  }

  .skeleton-row {
    height: 3rem;
    background: var(--color-skeleton, #e5e7eb);
    border-radius: 6px;
    animation: pulse 1.5s infinite ease-in-out;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
