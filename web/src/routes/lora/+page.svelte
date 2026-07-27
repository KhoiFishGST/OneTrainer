<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'lora_embedding' || t.id === 'lora' || t.id === 'lora-embedding') ?? {
      id: 'lora_embedding',
      label: 'LoRA',
      groups: [],
    }
  );

  type LoraSubTab = 'lora' | 'loha' | 'oft' | 'lokr';

  const subnavTabs: Array<{ id: LoraSubTab; label: string; peftType: string }> = [
    { id: 'lora', label: 'LoRA', peftType: 'LORA' },
    { id: 'loha', label: 'LoHa', peftType: 'LOHA' },
    { id: 'oft', label: 'OFT v2', peftType: 'OFT_2' },
    { id: 'lokr', label: 'LoKr', peftType: 'LOKR' },
  ];

  let activeSubTab = $state<LoraSubTab>('lora');

  const trainingMethod = $derived(ctx.workspace?.draft?.training_method ?? 'FINE_TUNE');
  const isLoraActive = $derived(trainingMethod === 'LORA');

  function handleTabClick(subtab: { id: LoraSubTab; peftType: string }) {
    activeSubTab = subtab.id;
    if (ctx.workspace && isLoraActive) {
      ctx.workspace.setRaw('peft_type', subtab.peftType);
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
      <h1 class="page-title">{tab.label || 'LoRA'}</h1>
    </div>

    {#if !isLoraActive}
      <div class="disabled-warning-banner" role="alert">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <div class="warning-text">
          LoRA / PEFT options are disabled because the current training method is <strong>{trainingMethod}</strong>.
          Switch your Training Method to <strong>LORA</strong> in <em>Training &gt; Base</em> to enable editing these settings.
        </div>
      </div>
    {/if}

    <!-- Connected Text-Only LoRA Sub-Nav Tabs -->
    <fieldset class="lora-fieldset" disabled={!isLoraActive}>
      <div class="lora-tab-container">
        <div class="lora-subnav-tabs" role="tablist">
          {#each subnavTabs as subtab (subtab.id)}
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === subtab.id}
              class="subnav-btn"
              class:active={activeSubTab === subtab.id}
              onclick={() => handleTabClick(subtab)}
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
    </fieldset>
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

  .disabled-warning-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background-color: var(--color-warning-bg, rgba(234, 179, 8, 0.12));
    border: 1px solid var(--color-warning-border, rgba(234, 179, 8, 0.3));
    color: var(--color-warning-text, #fde047);
    padding: 0.875rem 1rem;
    border-radius: 6px;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.4;
    max-width: 740px;
  }

  .warning-icon {
    font-size: 1.125rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .warning-text strong {
    color: var(--text-emphasis, #ffffff);
  }

  .lora-fieldset {
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
    transition: opacity 0.2s ease, filter 0.2s ease;
  }

  .lora-fieldset:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }

  .lora-fieldset:disabled button,
  .lora-fieldset:disabled :global(input),
  .lora-fieldset:disabled :global(select) {
    pointer-events: none;
    cursor: not-allowed;
  }

  .lora-tab-container {
    display: flex;
    flex-direction: column;
    width: 740px;
    max-width: 100%;
  }

  .lora-subnav-tabs {
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
