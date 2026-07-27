<script lang="ts">
  import { Plus, ToggleLeft, ToggleRight } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import EmbeddingCard from '$lib/components/embeddings/EmbeddingCard.svelte';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'embeddings') ?? {
      id: 'embeddings',
      label: 'Embeddings',
      groups: [],
    }
  );

  const EMBEDDING_SUPPORTED_MODELS = new Set([
    'STABLE_DIFFUSION_15',
    'STABLE_DIFFUSION_20',
    'STABLE_DIFFUSION_21',
    'STABLE_DIFFUSION_XL',
    'STABLE_DIFFUSION_3',
    'STABLE_CASCADE',
    'WUERSTCHEN',
    'PIXART',
    'FLUX_1',
    'SANA',
    'HUNYUAN_VIDEO',
    'HI_DREAM',
    'CHROMA',
  ]);

  const modelType = $derived(ctx.workspace?.draft?.model_type ?? 'STABLE_DIFFUSION_15');
  const trainingMethod = $derived(ctx.workspace?.draft?.training_method ?? 'FINE_TUNE');

  const isEmbeddingSupported = $derived(
    EMBEDDING_SUPPORTED_MODELS.has(modelType) || trainingMethod === 'EMBEDDING'
  );

  // List of additional embeddings bound to workspace draft
  const embeddingsList = $derived(
    Array.isArray(ctx.workspace?.draft?.additional_embeddings)
      ? (ctx.workspace.draft.additional_embeddings as Array<Record<string, any>>)
      : []
  );

  const allToggledOn = $derived(
    embeddingsList.length > 0 && embeddingsList.every((e) => e.train !== false)
  );

  function createNewEmbedding(): Record<string, any> {
    return {
      uuid: typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      model_name: '',
      placeholder: '<embedding>',
      token_count: 1,
      train: true,
      is_output_embedding: false,
      stop_training_after: 0,
      stop_training_after_unit: 'NEVER',
      initial_embedding_text: '*',
    };
  }

  function handleAddEmbedding() {
    if (!ctx.workspace) return;
    const current = [...embeddingsList, createNewEmbedding()];
    ctx.workspace.setRaw('additional_embeddings', current);
  }

  function handleRemoveEmbedding(index: number) {
    if (!ctx.workspace) return;
    const current = embeddingsList.filter((_, i) => i !== index);
    ctx.workspace.setRaw('additional_embeddings', current);
  }

  function handleCloneEmbedding(index: number) {
    if (!ctx.workspace) return;
    const source = embeddingsList[index] || {};
    const cloned = {
      ...JSON.parse(JSON.stringify(source)),
      uuid: typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    };
    const current = [...embeddingsList, cloned];
    ctx.workspace.setRaw('additional_embeddings', current);
  }

  function handleToggleAll() {
    if (!ctx.workspace) return;
    const newState = !allToggledOn;
    const updated = embeddingsList.map((e) => ({ ...e, train: newState }));
    ctx.workspace.setRaw('additional_embeddings', updated);
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
      <h1 class="page-title">{tab.label || 'Embeddings'}</h1>
    </div>

    {#if !isEmbeddingSupported}
      <div class="disabled-warning-banner" role="alert">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <div class="warning-text">
          Embeddings options are disabled because the selected Base Model Type (<strong>{modelType}</strong>)
          does not support Textual Inversion embeddings. Switch your Base Model to a supported architecture
          (e.g. Hunyuan Video, SDXL, SD 1.5, Flux 1) in <em>Model &gt; Base</em> to enable these settings.
        </div>
      </div>
    {/if}

    <fieldset class="embeddings-fieldset" disabled={!isEmbeddingSupported}>
      <div class="embeddings-layout">
        <!-- Global Embedding Parameters -->
        {#if (tab.groups?.length ?? 0) > 0}
          <div class="global-params-panel">
            <SchemaForm
              {tab}
              hideGroupTitle={true}
              values={ctx.workspace.draft}
              issues={ctx.workspace.errors}
              setRaw={(path, val) => ctx.workspace?.setRaw(path, val)}
              openDirectory={ctx.openDirectory}
            />
          </div>
        {/if}

        <!-- Additional Embeddings List Header & Action Bar -->
        <div class="list-section">
          <div class="list-action-bar">
            <div class="list-title-group">
              <h2 class="list-title">Additional Embeddings</h2>
              <span class="count-badge">{embeddingsList.length}</span>
            </div>

            <div class="bar-actions">
              {#if embeddingsList.length > 0}
                <button
                  type="button"
                  class="secondary-btn"
                  title={allToggledOn ? 'Disable training for all embeddings' : 'Enable training for all embeddings'}
                  disabled={!isEmbeddingSupported}
                  onclick={handleToggleAll}
                >
                  {#if allToggledOn}
                    <ToggleLeft size={16} />
                    <span>Disable All</span>
                  {:else}
                    <ToggleRight size={16} />
                    <span>Enable All</span>
                  {/if}
                </button>
              {/if}

              <button
                type="button"
                class="primary-btn"
                disabled={!isEmbeddingSupported}
                onclick={handleAddEmbedding}
              >
                <Plus size={16} />
                <span>Add Embedding</span>
              </button>
            </div>
          </div>

          <!-- Embeddings Grid / Cards -->
          {#if embeddingsList.length === 0}
            <div class="empty-embeddings-card">
              <p class="empty-title">No Additional Embeddings</p>
              <p class="empty-desc">
                Click <strong>+ Add Embedding</strong> to add textual inversion embedding configurations to your training run.
              </p>
              <button
                type="button"
                class="primary-btn mt-2"
                disabled={!isEmbeddingSupported}
                onclick={handleAddEmbedding}
              >
                <Plus size={16} />
                <span>Add Embedding</span>
              </button>
            </div>
          {:else}
            <div class="embeddings-grid">
              {#each embeddingsList as embedding, i (embedding.uuid || i)}
                <EmbeddingCard
                  bind:embedding={embeddingsList[i]}
                  index={i}
                  disabled={!isEmbeddingSupported}
                  onRemove={handleRemoveEmbedding}
                  onClone={handleCloneEmbedding}
                  onOpenDirectory={ctx.openDirectory}
                />
              {/each}
            </div>
          {/if}
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

  .embeddings-fieldset {
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
    transition: opacity 0.2s ease, filter 0.2s ease;
  }

  .embeddings-fieldset:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }

  .embeddings-fieldset:disabled :global(button),
  .embeddings-fieldset:disabled :global(input),
  .embeddings-fieldset:disabled :global(select) {
    pointer-events: none;
    cursor: not-allowed;
  }

  .embeddings-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 740px;
    max-width: 100%;
  }

  .list-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .list-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--panel, #181e25);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
  }

  .list-title-group {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .list-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--text, #f8fafc);
  }

  .count-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--accent, #3b82f6);
    background: var(--accent-soft, rgba(59, 130, 246, 0.15));
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
  }

  .bar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .primary-btn,
  .secondary-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 34px;
    padding: 0 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .primary-btn {
    background: var(--accent, #3b82f6);
    color: #ffffff;
  }

  .primary-btn:hover:not(:disabled) {
    background: var(--accent-hover, #2563eb);
  }

  .secondary-btn {
    background: var(--panel-raised, #252d37);
    color: var(--text, #e2e8f0);
    border-color: var(--line, #334155);
  }

  .secondary-btn:hover:not(:disabled) {
    background: var(--line, #334155);
  }

  .primary-btn:disabled,
  .secondary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .empty-embeddings-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1.5rem;
    background: var(--panel, #181e25);
    border: 1px dashed var(--line, #2d3741);
    border-radius: 8px;
    text-align: center;
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.375rem 0;
    color: var(--text, #f8fafc);
  }

  .empty-desc {
    font-size: 0.84rem;
    color: var(--muted, #94a3b8);
    margin: 0 0 1rem 0;
    max-width: 420px;
  }

  .mt-2 {
    margin-top: 0.5rem;
  }

  .embeddings-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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
