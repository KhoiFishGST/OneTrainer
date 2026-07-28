<script lang="ts">
  import type { GalleryRunModel, GalleryVariant } from '../../api/types';
  import { galleryImageUrl } from '../../api/client';
  import { uiPreferences } from '../../stores/ui-preferences';
  import Select from '../form/ValueSelect.svelte';
  import { Button } from '$lib/components/ui/button';
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

<div class="flex flex-col gap-6 w-full" data-testid="sample-gallery">
  <div class="flex flex-col bg-card border border-border rounded-lg overflow-hidden" data-testid="checkpoints-list">
    {#if title || showSortControl}
      <div class="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <h3 class="m-0 text-base font-semibold text-ring">{title || 'Sample Gallery'}</h3>

        {#if showSortControl && (!limit || limit > 1)}
          <div class="flex items-center gap-2">
            <label for="gallery-sort-select" class="text-xs font-medium text-muted-foreground">Sort</label>
            <Select
              id="gallery-sort-select"
              ariaLabel="Gallery sort order"
              value={effectiveSortOrder}
              options={[
                { value: 'asc', label: 'Oldest First (Asc)' },
                { value: 'desc', label: 'Newest First (Desc)' },
              ]}
              onChange={(val) => uiPreferences.setGallerySortOrder(val as 'asc' | 'desc')}
            />
          </div>
        {/if}
      </div>
    {/if}

    {#if loading}
      <div class="flex items-center justify-center py-12 px-6 bg-card border border-border rounded-lg text-muted-foreground">
        <p class="text-sm m-0">Loading sample gallery...</p>
      </div>
    {:else if errorMessage}
      <div class="flex items-center justify-center py-12 px-6 bg-destructive-surface border border-destructive/30 rounded-lg text-destructive">
        <p class="text-sm m-0">{errorMessage}</p>
      </div>
    {:else if !gallery || !sortedBatches || sortedBatches.length === 0}
      <div class="flex items-center justify-center py-12 px-6 bg-card border border-border rounded-lg text-muted-foreground">
        <p class="text-sm m-0">No samples yet</p>
      </div>
    {:else}
      {#each sortedBatches as batch (batch.id ?? batch.batch_id ?? 1)}
        {@const revision = gallery.revisions ? gallery.revisions[batch.prompt_revision_id] : null}
        {@const promptIds = batch.expected_prompt_ids ?? (batch.samples ? Array.from(new Set(batch.samples.map((s) => s.webui_prompt_id).filter(Boolean))) : [])}
        {@const expectedVariants = batch.expected_variants ?? ['ema']}
        <div class="[content-visibility:auto] [contain-intrinsic-size:1px_300px] flex flex-row items-stretch gap-2 p-3 border-b border-border last:border-b-0" data-testid="checkpoint-row">
          <div class="flex items-center justify-center [writing-mode:vertical-lr] rotate-180 bg-muted border border-border rounded-md px-1 py-2 select-none shrink-0">
            <span class="text-xs font-semibold text-foreground tracking-wider whitespace-nowrap">
              Epoch {batch.epoch ?? batch.progress?.epoch ?? 0} {'\u00b7'} Step {batch.global_step ?? batch.progress?.global_step ?? 0}
            </span>
          </div>

          <div class="flex-1 min-w-0 flex flex-col gap-2">
            {#each expectedVariants as variant (variant)}
              <div class="flex flex-col gap-1.5">
                {#if expectedVariants.length > 1}
                  <h4 class="text-xs font-semibold uppercase tracking-wider text-primary m-0.5 mt-0.5">{formatVariant(variant)}</h4>
                {/if}

                <div
                  class="variant-grid grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(180px,calc(20%-0.4rem))),1fr))] gap-2 max-md:grid-cols-2 max-sm:grid-cols-1"
                  data-testid="variant-grid"
                  style={`--prompt-columns: ${Math.max(promptIds.length, 1)}`}
                >
                  {#each promptIds as promptId (promptId)}
                    {@const promptDef = revision?.prompts?.find((p) => p.webui_id === promptId)}
                    {@const sample = batch.samples?.find((s) => s.webui_prompt_id === promptId && s.variant === variant)}
                    {@const status = sample ? sample.status : 'unavailable'}

                    <div class="flex flex-col w-full max-w-full">
                      {#if status === 'ready' && sample}
                        {@const thumbUrl = gallery.run?.key ? galleryImageUrl(gallery.run.key, sample.thumbnail_filename || sample.filename || '') : ''}
                        <Button
                          type="button"
                          variant="ghost"
                          class="sample-card ready-card group flex flex-col bg-muted border border-border rounded-md overflow-hidden text-left w-full p-0 h-auto cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
                          aria-label={`Open sample ${promptDef?.prompt || promptId}`}
                          onclick={() => openViewer(batch.id, promptId, variant)}
                        >
                          <div class="relative aspect-square w-full bg-black overflow-hidden">
                            {#if thumbUrl}
                              <img
                                src={thumbUrl}
                                alt={promptDef?.prompt || 'sample prompt'}
                                loading="lazy"
                                class="w-full h-full object-cover"
                              />
                            {/if}
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 opacity-90 transition-opacity group-hover:opacity-100">
                              {#if promptDef}
                                <div class="flex flex-wrap gap-1">
                                  {#if promptDef.width && promptDef.height}
                                    <span class="text-[0.7rem] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur border border-white/15">{promptDef.width}{'\u00d7'}{promptDef.height}</span>
                                  {/if}
                                  {#if promptDef.diffusion_steps !== undefined}
                                    <span class="text-[0.7rem] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur border border-white/15">{promptDef.diffusion_steps} steps</span>
                                  {/if}
                                  {#if promptDef.cfg_scale !== undefined}
                                    <span class="text-[0.7rem] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur border border-white/15">CFG {promptDef.cfg_scale}</span>
                                  {/if}
                                  {#if getSeedLabel(promptDef)}
                                    <span class="text-[0.7rem] font-medium bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur border border-white/15">Seed {getSeedLabel(promptDef)}</span>
                                  {/if}
                                </div>
                              {/if}
                            </div>
                          </div>
                        </Button>
                      {:else}
                        <div class="flex flex-col bg-muted border border-border rounded-md overflow-hidden text-left w-full p-0 opacity-85">
                          <div class="aspect-square w-full flex items-center justify-center bg-muted p-2 text-center">
                            {#if status === 'pending'}
                              <span class="text-xs font-medium text-primary">Generating...</span>
                            {:else if status === 'error'}
                              <span class="text-xs font-medium text-destructive">{sample?.error || sample?.thumbnail_error || 'Gallery error'}</span>
                            {:else}
                              <span class="text-xs font-medium text-muted-foreground">Unavailable</span>
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
