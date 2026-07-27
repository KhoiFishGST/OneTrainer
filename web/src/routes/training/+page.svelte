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

  type TrainingSubTab =
    | 'base'
    | 'execution'
    | 'text'
    | 'denoise'
    | 'layer'
    | 'noise'
    | 'masking'
    | 'loss';

  const subnavTabs: Array<{ id: TrainingSubTab; label: string }> = [
    { id: 'base', label: 'Base' },
    { id: 'execution', label: 'Execution' },
    { id: 'text', label: 'Text' },
    { id: 'denoise', label: 'Denoise' },
    { id: 'layer', label: 'Layer' },
    { id: 'noise', label: 'Noise' },
    { id: 'masking', label: 'Masking' },
    { id: 'loss', label: 'Loss' },
  ];

  let modalOpen = $state(false);
  let activeSubTab = $state<TrainingSubTab>('base');

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

    <!-- Connected Text-Only Training Sub-Nav Tabs -->
    <div class="training-tab-container">
      <div class="training-subnav-tabs" role="tablist">
        {#each subnavTabs as subtab (subtab.id)}
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === subtab.id}
            class="subnav-btn"
            class:active={activeSubTab === subtab.id}
            onclick={() => (activeSubTab = subtab.id)}
          >
            {subtab.label}
          </button>
        {/each}
      </div>

      <div class="tab-panel-body">
        <SchemaForm
          {tab}
          {activeSubTab}
          hideGroupTitle={true}
          values={ctx.workspace.draft}
          issues={ctx.workspace.errors}
          setRaw={(path, val) => ctx.workspace?.setRaw(path, val)}
          openDirectory={ctx.openDirectory}
        />
      </div>
    </div>

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

  .training-tab-container {
    display: flex;
    flex-direction: column;
    width: 740px;
    max-width: 100%;
  }

  .training-subnav-tabs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-bottom: 1px solid var(--color-border, var(--line, #2d3741));
    padding: 0 0.25rem;
  }

  .subnav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.875rem;
    border: 1px solid transparent;
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    background: transparent;
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: -1px;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .subnav-btn:hover {
    color: var(--text, #f8fafc);
    background-color: var(--panel-raised, #1d242c);
  }

  .subnav-btn.active {
    color: var(--color-text-title, var(--accent, #3b82f6));
    background-color: var(--color-bg-card, var(--panel, #181e25));
    border-color: var(--color-border, var(--line, #2d3741));
    border-bottom-color: var(--color-bg-card, var(--panel, #181e25));
    font-weight: 600;
  }

  .subnav-btn:hover {
    color: var(--text, #f8fafc);
    background-color: var(--panel-raised, #1d242c);
  }

  .subnav-btn.active {
    color: var(--color-text-title, var(--accent, #3b82f6));
    background-color: var(--panel-raised, #1d242c);
    font-weight: 600;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
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
