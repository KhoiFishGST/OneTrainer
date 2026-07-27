<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'general') ?? {
      id: 'general',
      label: 'General',
      groups: [],
    }
  );

  type GeneralSubTab = 'workspace' | 'debug' | 'tensors' | 'hardware';

  const subnavTabs: Array<{ id: GeneralSubTab; label: string }> = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'debug', label: 'Debug' },
    { id: 'tensors', label: 'Tensors' },
    { id: 'hardware', label: 'Hardware' },
  ];

  let activeSubTab = $state<GeneralSubTab>('workspace');
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
      <h1 class="page-title">{tab.label || 'General'}</h1>
    </div>

    <!-- Connected Text-Only General Sub-Nav Tabs -->
    <div class="general-tab-container">
      <div class="general-subnav-tabs" role="tablist">
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
          setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
          openDirectory={ctx.openDirectory}
        />
      </div>
    </div>
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
    margin-bottom: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .general-tab-container {
    display: flex;
    flex-direction: column;
    width: 740px;
    max-width: 100%;
  }

  .general-subnav-tabs {
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
