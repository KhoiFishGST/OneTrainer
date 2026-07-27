<script lang="ts">
  import type { GalleryRunModel, GalleryVariant } from '../../api/types';
  import { galleryImageUrl } from '../../api/client';
  import { uiPreferences } from '../../stores/ui-preferences';
  import GalleryImageViewer, { type GallerySelection } from './GalleryImageViewer.svelte';

  let {
    gallery = null,
    loading = false,
    error = null,
    title,
    sortOrder,
    limit = null,
    showSortControl = true,
  }: {
    gallery?: GalleryRunModel | null;
    loading?: boolean;
    error?: Error | string | null;
    title?: string;
    sortOrder?: 'desc' | 'asc';
    limit?: number | null;
    showSortControl?: boolean;
  } = $props();

  let selection = $state<GallerySelection | null>(null);
  let isViewerOpen = $state(false);

  const effectiveSortOrder = $derived(sortOrder ?? $uiPreferences.gallerySortOrder);

  const sortedBatches = $derived.by(() => {
    if (!gallery?.batches) return [];
    const batches = [...gallery.batches];
    batches.sort((a, b) => {
      const epochA = a.epoch ?? a.progress?.epoch ?? 0;
      const epochB = b.epoch ?? b.progress?.epoch ?? 0;
      if (epochA !== epochB) {
        return effectiveSortOrder === 'asc' ? epochA - epochB : epochB - epochA;
      }
      const stepA = a.global_step ?? a.progress?.global_step ?? 0;
      const stepB = b.global_step ?? b.progress?.global_step ?? 0;
      if (stepA !== stepB) {
        return effectiveSortOrder === 'asc' ? stepA - stepB : stepB - stepA;
      }
      return effectiveSortOrder === 'asc' ? a.id - b.id : b.id - a.id;
    });
    return limit && limit > 0 ? batches.slice(0, limit) : batches;
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
  <div class="gallery-single-panel" data-testid="checkpoints-list">
    {#if title || showSortControl}
      <div class="panel-header">
        <h3 class="panel-title">{title || 'Sample Gallery'}</h3>

        {#if showSortControl && (!limit || limit > 1)}
          <div class="sort-control">
            <label for="gallery-sort-select" class="sort-label">Sort</label>
            <select
              id="gallery-sort-select"
              aria-label="Gallery sort order"
              class="sort-select"
              value={effectiveSortOrder}
              onchange={(e) => uiPreferences.setGallerySortOrder((e.target as HTMLSelectElement).value as 'asc' | 'desc')}
            >
              <option value="asc">Oldest First (Asc)</option>
              <option value="desc">Newest First (Desc)</option>
            </select>
          </div>
        {/if}
      </div>
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
      {#each sortedBatches as batch (batch.id ?? batch.batch_id ?? 1)}
        {@const revision = gallery.revisions ? gallery.revisions[batch.prompt_revision_id] : null}
        {@const promptIds = batch.expected_prompt_ids ?? (batch.samples ? Array.from(new Set(batch.samples.map((s) => s.webui_prompt_id).filter(Boolean))) : [])}
        {@const expectedVariants = batch.expected_variants ?? ['ema']}
        <div class="checkpoint-row" data-testid="checkpoint-row">
          <div class="epoch-badge-col">
            <span class="epoch-badge-text">
              Epoch {batch.epoch ?? batch.progress?.epoch ?? 0} {'\u00b7'} Step {batch.global_step ?? batch.progress?.global_step ?? 0}
            </span>
          </div>

          <div class="checkpoint-content-col">
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
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>

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

  .gallery-single-panel {
    display: flex;
    flex-direction: column;
    background: var(--panel, #1e293b);
    border: 1px solid var(--line, #334155);
    border-radius: 8px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--line, #334155);
  }

  .panel-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sort-label {
    font-size: 0.8125rem;
    color: var(--muted, #94a3b8);
    font-weight: 500;
  }

  .sort-select {
    background-color: var(--control, #0f172a);
    color: var(--text, #f8fafc);
    border: 1px solid var(--line, #334155);
    border-radius: 4px;
    padding: 0.25rem 0.6rem;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .sort-select:hover {
    border-color: var(--accent, #3b82f6);
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

  .gallery-single-panel {
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }

  .checkpoint-row {
    content-visibility: auto;
    contain-intrinsic-size: 1px 300px;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 1rem;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid var(--line);
  }

  .checkpoint-row:last-child {
    border-bottom: none;
  }

  .epoch-badge-col {
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: vertical-lr;
    transform: rotate(180deg);
    background: var(--control);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.75rem 0.375rem;
    user-select: none;
    flex-shrink: 0;
  }

  .epoch-badge-text {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .checkpoint-content-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
    grid-template-columns: repeat(auto-fill, minmax(min(100%, max(180px, calc(20% - 0.8rem))), 1fr));
    gap: 1rem;
  }

  .sample-slot-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
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
