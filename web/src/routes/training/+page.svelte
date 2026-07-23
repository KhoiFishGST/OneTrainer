<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import OptimizerSchedulerModal from '$lib/components/form/OptimizerSchedulerModal.svelte';
  import type { SchemaField } from '$lib/config/validation';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'training') ?? {
      id: 'training',
      label: 'Training',
      groups: [],
    }
  );

  let modalOpen = $state(false);

  const optimizerFields: SchemaField[] = [
    { id: 'learning_rate', keys: ['learning_rate'], label: 'Learning Rate', control: 'number' },
    { id: 'beta1', keys: ['optimizer_params', 'beta1'], label: 'Beta 1', control: 'number' },
    { id: 'beta2', keys: ['optimizer_params', 'beta2'], label: 'Beta 2', control: 'number' },
    { id: 'weight_decay', keys: ['optimizer_params', 'weight_decay'], label: 'Weight Decay', control: 'number' },
    { id: 'epsilon', keys: ['optimizer_params', 'epsilon'], label: 'Epsilon', control: 'number' },
  ];

  function handleSaveOptimizer(updatedValues: Record<string, any>) {
    if (ctx.workspace) {
      for (const [key, val] of Object.entries(updatedValues)) {
        ctx.workspace.setRaw(key, val);
      }
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
    <div class="header-row">
      <h1 class="page-title">{tab.label || 'Training'}</h1>
      <button
        type="button"
        class="opt-modal-btn"
        onclick={() => (modalOpen = true)}
      >
        Configure Optimizer / Scheduler
      </button>
    </div>

    <SchemaForm
      {tab}
      values={ctx.workspace.draft}
      issues={ctx.workspace.errors}
      setRaw={(path, val) => ctx.workspace?.setRaw(path, val)}
      openDirectory={ctx.openDirectory}
    />

    <OptimizerSchedulerModal
      bind:open={modalOpen}
      fields={optimizerFields}
      values={ctx.workspace.draft}
      onSave={handleSaveOptimizer}
    />
  </div>
{/if}

<style>
  .route-page {
    padding: 1.5rem;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text, #111827);
  }

  .opt-modal-btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-primary-text, #ffffff);
    background-color: var(--color-primary, #2563eb);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .opt-modal-btn:hover {
    background-color: var(--color-primary-hover, #1d4ed8);
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
