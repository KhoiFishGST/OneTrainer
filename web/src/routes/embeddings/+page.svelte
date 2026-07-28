<script lang="ts">
  import { Plus, ToggleLeft, ToggleRight } from '@lucide/svelte';
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import EmbeddingCard from '$lib/components/embeddings/EmbeddingCard.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import FormPageSkeleton from '$lib/components/loading/FormPageSkeleton.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Empty from '$lib/components/ui/empty/index.js';

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

  function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function createNewEmbedding(): Record<string, any> {
    return {
      uuid: generateUUID(),
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
      uuid: generateUUID(),
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
  <FormPageSkeleton label="Loading embeddings configuration" />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'Embeddings'} class="embeddings-header" />

    {#if !isEmbeddingSupported}
      <Alert class="embeddings-warning-alert bg-warning-surface text-warning border-warning-border flex items-start gap-3 rounded-lg p-4">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <div class="warning-text">
          Embeddings options are disabled because the selected Base Model Type (<strong>{modelType}</strong>)
          does not support Textual Inversion embeddings. Switch your Base Model to a supported architecture
          (e.g. Hunyuan Video, SDXL, SD 1.5, Flux 1) in <em>Model &gt; Base</em> to enable these settings.
        </div>
      </Alert>
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
              setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
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
                <Button
                  variant="secondary"
                  size="sm"
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
                </Button>
              {/if}

              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!isEmbeddingSupported}
                onclick={handleAddEmbedding}
              >
                <Plus size={16} />
                <span>Add Embedding</span>
              </Button>
            </div>
          </div>

          <!-- Additional Embeddings Cards -->
          {#if embeddingsList.length === 0}
            <Empty.Root class="border border-dashed p-8 rounded-lg bg-card text-center">
              <Empty.Title class="text-lg font-semibold">
                No Additional Embeddings
              </Empty.Title>
              <Empty.Description class="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Add an embedding placeholder to train new textual inversion tokens alongside your model.
              </Empty.Description>
              <Empty.Content>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={!isEmbeddingSupported}
                  onclick={handleAddEmbedding}
                >
                  <Plus size={16} />
                  <span>Add First Embedding</span>
                </Button>
              </Empty.Content>
            </Empty.Root>
          {:else}
            <div class="embeddings-grid">
              {#each embeddingsList as emb, idx (emb.uuid || idx)}
                <EmbeddingCard
                  embedding={ctx.workspace.draft.additional_embeddings[idx]}
                  index={idx}
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
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .warning-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .warning-text {
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .embeddings-fieldset {
    border: none;
    padding: 0;
    margin: 0;
    width: 100%;
  }

  .embeddings-fieldset:disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .embeddings-layout {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .list-section {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .list-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
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
    color: var(--foreground);
  }

  .count-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--primary);
    background: rgba(59, 130, 246, 0.15);
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
  }

  .bar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .embeddings-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
