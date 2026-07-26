<script lang="ts">
  import type { GalleryRunModel, GalleryVariant } from '../../api/types';
  import { galleryImageUrl } from '../../api/client';
  import GalleryImageViewer, { type GallerySelection } from './GalleryImageViewer.svelte';

  let {
    gallery = null,
    loading = false,
    error = null,
    title,
  }: {
    gallery?: GalleryRunModel | null;
    loading?: boolean;
    error?: Error | string | null;
    title?: string;
  } = $props();

  let selection = $state<GallerySelection | null>(null);
  let isViewerOpen = $state(false);

  const sortedBatches = $derived.by(() => {
    if (!gallery || !gallery.batches) return [];
    return gallery.batches.slice().sort((a, b) => a.id - b.id);
  });

  const errorMessage = $derived.by(() => {
    if (!error) return null;
    return typeof error === 'string' ? error : error.message;
  });

  function formatVariant(variant: GalleryVariant): string {
    if (variant === 'ema') return 'EMA';
    if (variant === 'non_ema') return 'Non-EMA';
    if (variant === 'base') return 'Base';
    return variant;
  }

  function getSeedLabel(promptDef: any): string {
    if (!promptDef) return '';
    if (promptDef.random_seed === true) return 'Random';
    if (promptDef.seed !== undefined && promptDef.seed !== null) return String(promptDef.seed);
    return '';
  }

  function openViewer(batchId: number, promptId: string, variant: GalleryVariant) {
    selection = { batchId, promptId, variant };
    isViewerOpen = true;
  }

  function closeViewer() {
    isViewerOpen = false;
    selection = null;
  }
</script>

<div class="sample-gallery-container" data-testid="sample-gallery">
  {#if title}
    <h2 class="gallery-title">{title}</h2>
  {/if}

  {#if loading}
    <div class="gallery-state loading-state">
      <p class="state-text">Loading sample gallery...</p>
    </div>
  {:else if errorMessage}
    <div class="gallery-state error-state">
      <p class="state-text">{errorMessage}</p>
    </div>
  {:else if !gallery || !sortedBatches || sortedBatches.length === 0}
    <div class="gallery-state empty-state">
      <p class="state-text">No samples yet</p>
    </div>
  {:else}
    <div class="checkpoints-list">
      {#each sortedBatches as batch (batch.id ?? batch.batch_id ?? 1)}
        {@const revision = gallery.revisions ? gallery.revisions[batch.prompt_revision_id] : null}
        {@const promptIds = batch.expected_prompt_ids ?? (batch.samples ? Array.from(new Set(batch.samples.map((s) => s.webui_prompt_id).filter(Boolean))) : [])}
        {@const expectedVariants = batch.expected_variants ?? ['ema']}
        <div class="checkpoint-row" data-testid="checkpoint-row">
          <div class="checkpoint-header">
            <span class="checkpoint-label">
              Epoch {batch.epoch ?? batch.progress?.epoch ?? 0} {'\u00b7'} Step {batch.global_step ?? batch.progress?.global_step ?? 0}
            </span>
          </div>

          {#each expectedVariants as variant (variant)}
            <div class="variant-subrow">
              {#if expectedVariants.length > 1}
                <h4 class="variant-label">{formatVariant(variant)}</h4>
              {/if}

              <div
                class="variant-grid"
                data-testid="variant-grid"
                style={`--prompt-columns: ${Math.max(promptIds.length, 1)}`}
              >
                {#each promptIds as promptId (promptId)}
                  {@const promptDef = revision?.prompts?.find((p) => p.webui_id === promptId)}
                  {@const sample = batch.samples?.find((s) => s.webui_prompt_id === promptId && s.variant === variant)}
                  {@const status = sample ? sample.status : 'unavailable'}

                  <div class="sample-slot-container">
                    {#if status === 'ready' && sample}
                      {@const thumbUrl = gallery.run?.key ? galleryImageUrl(gallery.run.key, sample.thumbnail_filename || sample.filename || '') : ''}
                      <button
                        type="button"
                        class="sample-card ready-card"
                        aria-label={`Open sample ${promptDef?.prompt || promptId}`}
                        onclick={() => openViewer(batch.id, promptId, variant)}
                      >
                        <div class="thumbnail-wrapper">
                          {#if thumbUrl}
                            <img
                              src={thumbUrl}
                              alt={promptDef?.prompt || 'sample prompt'}
                              loading="lazy"
                              class="thumbnail-img"
                            />
                          {/if}
                          <div class="card-overlay">
                            {#if promptDef}
                              <div class="overlay-meta">
                                {#if promptDef.width && promptDef.height}
                                  <span class="meta-tag">{promptDef.width}{'\u00d7'}{promptDef.height}</span>
                                {/if}
                                {#if promptDef.diffusion_steps !== undefined}
                                  <span class="meta-tag">{promptDef.diffusion_steps} steps</span>
                                {/if}
                                {#if promptDef.cfg_scale !== undefined}
                                  <span class="meta-tag">CFG {promptDef.cfg_scale}</span>
                                {/if}
                                {#if getSeedLabel(promptDef)}
                                  <span class="meta-tag">Seed {getSeedLabel(promptDef)}</span>
                                {/if}
                              </div>
                            {/if}
                          </div>
                        </div>
                        {#if promptDef?.prompt}
                          <p class="prompt-caption" title={promptDef.prompt}>
                            {promptDef.prompt}
                          </p>
                        {/if}
                      </button>
                    {:else}
                      <div class="sample-card non-ready-card status-{status}">
                        <div class="status-placeholder">
                          {#if status === 'pending'}
                            <span class="status-text">Generating...</span>
                          {:else if status === 'error'}
                            <span class="status-text">{sample?.error || sample?.thumbnail_error || 'Gallery error'}</span>
                          {:else}
                            <span class="status-text">Unavailable</span>
                          {/if}
                        </div>
                        {#if promptDef?.prompt}
                          <p class="prompt-caption" title={promptDef.prompt}>
                            {promptDef.prompt}
                          </p>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  {#if isViewerOpen && selection && gallery}
    <GalleryImageViewer
      open={isViewerOpen}
      {gallery}
      {selection}
      onClose={closeViewer}
    />
  {/if}
</div>

<style>
  .sample-gallery-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }

  .gallery-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .gallery-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--muted);
  }

  .error-state {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
  }

  .state-text {
    font-size: 0.95rem;
    margin: 0;
  }

  .checkpoints-list {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .checkpoint-row {
    content-visibility: auto;
    contain-intrinsic-size: 1px 300px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 1rem;
  }

  .checkpoint-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--line);
  }

  .checkpoint-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .variant-subrow {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .variant-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    margin: 0.25rem 0 0 0;
  }

  .variant-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 280px));
    gap: 1rem;
  }

  .sample-slot-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 280px;
  }

  .sample-card {
    display: flex;
    flex-direction: column;
    background: var(--control);
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    text-align: left;
    width: 100%;
    padding: 0;
  }

  .ready-card {
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .ready-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .thumbnail-wrapper {
    position: relative;
    aspect-ratio: 1;
    width: 100%;
    background: #000000;
    overflow: hidden;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 50%);
    display: flex;
    align-items: flex-end;
    padding: 0.5rem;
    opacity: 0.9;
    transition: opacity 0.15s ease;
  }

  .ready-card:hover .card-overlay {
    opacity: 1;
  }

  .overlay-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .meta-tag {
    font-size: 0.7rem;
    font-weight: 500;
    background: rgba(0, 0, 0, 0.7);
    color: #ffffff;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .non-ready-card {
    opacity: 0.85;
  }

  .status-placeholder {
    aspect-ratio: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--control);
    border-bottom: 1px solid var(--line);
    padding: 0.5rem;
    text-align: center;
  }

  .status-text {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--muted);
  }

  .status-error .status-text {
    color: #ef4444;
  }

  .status-pending .status-text {
    color: var(--accent);
  }

  .prompt-caption {
    font-size: 0.8125rem;
    color: var(--text);
    padding: 0.6rem 0.75rem;
    margin: 0;
    line-height: 1.3;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
  }

  @media (max-width: 768px) {
    .variant-grid {
      grid-template-columns: repeat(min(var(--prompt-columns, 1), 2), minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .variant-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
