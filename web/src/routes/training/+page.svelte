<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import OptimizerSchedulerModal from '$lib/components/form/OptimizerSchedulerModal.svelte';
  import type { SchemaField } from '$lib/config/validation';
  import { SlidersHorizontal, Cpu, Activity } from 'lucide-svelte';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'training') ?? {
      id: 'training',
      label: 'Training',
      groups: [],
    }
  );

  let modalOpen = $state(false);
  let activeSubTab = $state<'general_opt' | 'components' | 'noise_loss'>('general_opt');

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
    <div class="page-header">
      <h1 class="page-title">{tab.label || 'Training'}</h1>
      <button
        type="button"
        class="opt-modal-btn"
        onclick={() => (modalOpen = true)}
      >
        Configure Optimizer / Scheduler
      </button>
    </div>

    <!-- Training Sub-Nav Tabs -->
    <div class="training-subnav-tabs">
      <button
        type="button"
        class="subnav-btn"
        class:active={activeSubTab === 'general_opt'}
        onclick={() => (activeSubTab = 'general_opt')}
      >
        <SlidersHorizontal size={16} />
        <span>General & Optimization</span>
      </button>
      <button
        type="button"
        class="subnav-btn"
        class:active={activeSubTab === 'components'}
        onclick={() => (activeSubTab = 'components')}
      >
        <Cpu size={16} />
        <span>Model Components & Architecture</span>
      </button>
      <button
        type="button"
        class="subnav-btn"
        class:active={activeSubTab === 'noise_loss'}
        onclick={() => (activeSubTab = 'noise_loss')}
      >
        <Activity size={16} />
        <span>Noise, Timesteps & Loss</span>
      </button>
    </div>

    <SchemaForm
      {tab}
      {activeSubTab}
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

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .training-subnav-tabs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--line, #2d3741);
    padding-bottom: 0.5rem;
  }

  .subnav-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .subnav-btn:hover {
    color: var(--text, #f8fafc);
    background-color: var(--panel-raised, #1d242c);
  }

  .subnav-btn.active {
    color: var(--color-text-title, var(--accent, #dd773b));
    background-color: var(--panel-raised, #1d242c);
    font-weight: 600;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #dd773b));
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
