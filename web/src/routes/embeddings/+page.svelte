<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';

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
      <SchemaForm
        {tab}
        hideGroupTitle={true}
        values={ctx.workspace.draft}
        issues={ctx.workspace.errors}
        setRaw={(path, val) => ctx.workspace?.setRaw(path, val)}
        openDirectory={ctx.openDirectory}
      />
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
