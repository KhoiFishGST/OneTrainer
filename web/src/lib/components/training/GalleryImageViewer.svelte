<script lang="ts">
  import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-svelte';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { GalleryRunModel, GalleryVariant } from '../../api/types';
  import { galleryImageUrl } from '../../api/client';

  export interface GallerySelection {
    batchId: number;
    promptId: string;
    variant: GalleryVariant;
  }

  let {
    open = false,
    gallery,
    selection = null,
    onClose,
  }: {
    open: boolean;
    gallery: GalleryRunModel;
    selection: GallerySelection | null;
    onClose: () => void;
  } = $props();

  let activeBatchId = $state<number | null>(null);

  $effect(() => {
    if (selection) {
      activeBatchId = selection.batchId;
    }
  });

  const promptId = $derived(selection?.promptId);
  const variant = $derived(selection?.variant);

  const timelineEntries = $derived.by(() => {
    if (!gallery || !gallery.batches || !promptId || !variant) return [];

    return gallery.batches
      .filter(
        (b) =>
          (b.expected_prompt_ids || []).includes(promptId) &&
          (b.expected_variants || []).includes(variant)
      )
      .map((b) => {
        const sample =
          b.samples.find(
            (s) => s.webui_prompt_id === promptId && s.variant === variant
          ) || null;
        const status = sample ? sample.status : 'unavailable';
        const revision = gallery.revisions
          ? gallery.revisions[b.prompt_revision_id]
          : undefined;
        const prompt = revision?.prompts?.find((p) => p.webui_id === promptId);
        return {
          batch: b,
          sample,
          status,
          revision,
          prompt,
        };
      });
  });

  const readyEntries = $derived(
    timelineEntries.filter(
      (entry) => entry.status === 'ready' && entry.sample?.filename
    )
  );

  const activeReadyIndex = $derived(
    readyEntries.findIndex((entry) => entry.batch.id === activeBatchId)
  );

  const activeEntry = $derived(
    activeReadyIndex >= 0
      ? readyEntries[activeReadyIndex]
      : timelineEntries.find((e) => e.batch.id === activeBatchId) ??
        readyEntries[0] ??
        null
  );

  const isRevisionBoundary = $derived.by(() => {
    if (!activeEntry) return false;
    const activeTimelineIndex = timelineEntries.findIndex(
      (e) => e.batch.id === activeEntry.batch.id
    );
    if (activeTimelineIndex > 0) {
      return (
        timelineEntries[activeTimelineIndex].batch.prompt_revision_id !==
        timelineEntries[activeTimelineIndex - 1].batch.prompt_revision_id
      );
    }
    return false;
  });

  const currentImageUrl = $derived.by(() => {
    if (gallery?.run?.key && activeEntry?.sample?.filename) {
      return galleryImageUrl(gallery.run.key, activeEntry.sample.filename);
    }
    return '';
  });

  const seedLabel = $derived.by(() => {
    if (!activeEntry?.prompt) return '';
    if (activeEntry.prompt.random_seed === true) {
      return 'Random';
    }
    return activeEntry.prompt.seed !== undefined
      ? String(activeEntry.prompt.seed)
      : '';
  });

  function navigate(delta: -1 | 1): void {
    if (activeReadyIndex < 0 || readyEntries.length === 0) return;
    const nextIndex = activeReadyIndex + delta;
    if (nextIndex >= 0 && nextIndex < readyEntries.length) {
      activeBatchId = readyEntries[nextIndex].batch.id;
    }
  }

  function handleViewerKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigate(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigate(1);
    }
  }

  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }
  }

  function handleTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
        navigate(dx < 0 ? 1 : -1);
      }
    }
  }

  $effect(() => {
    if (!open || activeReadyIndex < 0 || !gallery?.run?.key) return;

    const runKey = gallery.run.key;
    const adjacentUrls: string[] = [];

    if (activeReadyIndex > 0) {
      const prevFilename = readyEntries[activeReadyIndex - 1]?.sample?.filename;
      if (prevFilename) adjacentUrls.push(galleryImageUrl(runKey, prevFilename));
    }

    if (activeReadyIndex < readyEntries.length - 1) {
      const nextFilename = readyEntries[activeReadyIndex + 1]?.sample?.filename;
      if (nextFilename) adjacentUrls.push(galleryImageUrl(runKey, nextFilename));
    }

    for (const url of adjacentUrls) {
      const img = new Image();
      img.src = url;
    }
  });
</script>

<ResponsiveDialogDrawer
  bind:open
  onOpenChange={(v) => { if (!v) onClose(); }}
  title="Sample Image Viewer"
  class="max-w-4xl"
  onkeydown={handleViewerKeyDown}
  data-batch-id={selection?.batchId}
  data-prompt-id={selection?.promptId}
  data-variant={selection?.variant}
>
  {#if activeEntry}
    <div class="flex flex-col gap-4 text-foreground">
      <div class="flex items-center gap-4 flex-wrap">
        <span class="text-xl font-semibold text-foreground">
          Epoch {activeEntry.batch.epoch ?? activeEntry.batch.progress?.epoch ?? 0} {'\u00b7'} Step {activeEntry.batch.global_step ?? activeEntry.batch.progress?.global_step ?? 0}
        </span>
        {#if isRevisionBoundary}
          <span class="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-xs font-medium px-2.5 py-1 rounded-full">
            Prompt changed at this checkpoint
          </span>
        {/if}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 min-h-[400px]">
        <div
          class="viewer-image-stage relative bg-black rounded-lg flex items-center justify-center overflow-hidden min-h-[400px] select-none"
          role="region"
          aria-label="Image viewer stage"
          ontouchstart={handleTouchStart}
          ontouchend={handleTouchEnd}
        >
          {#if currentImageUrl}
            <img
              src={currentImageUrl}
              alt="Sample Epoch {activeEntry.batch.epoch ?? activeEntry.batch.progress?.epoch ?? 0} Step {activeEntry.batch.global_step ?? activeEntry.batch.progress?.global_step ?? 0}"
              class="max-w-full max-h-[65vh] object-contain"
            />
          {:else}
            <div class="text-muted-foreground text-sm">No Image Available</div>
          {/if}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="absolute top-1/2 -translate-y-1/2 left-3 bg-black/60 text-white border border-white/20 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors hover:bg-black/85 disabled:opacity-25 disabled:cursor-not-allowed"
            aria-label="Previous checkpoint"
            disabled={activeReadyIndex <= 0}
            onclick={() => navigate(-1)}
          >
            <ChevronLeft size={24} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="absolute top-1/2 -translate-y-1/2 right-3 bg-black/60 text-white border border-white/20 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-colors hover:bg-black/85 disabled:opacity-25 disabled:cursor-not-allowed"
            aria-label="Next checkpoint"
            disabled={activeReadyIndex < 0 || activeReadyIndex >= readyEntries.length - 1}
            onclick={() => navigate(1)}
          >
            <ChevronRight size={24} />
          </Button>
        </div>

        <div class="flex flex-col gap-5 bg-card rounded-lg p-4 border border-border overflow-y-auto max-h-[65vh]">
          {#if activeEntry.prompt}
            <div class="flex flex-col gap-2">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground m-0">Prompt</h4>
              <p class="text-sm text-foreground leading-snug m-0 break-words bg-muted p-2.5 rounded-md border border-border">{activeEntry.prompt.prompt}</p>

              {#if activeEntry.prompt.negative_prompt}
                <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground m-0">Negative Prompt</h4>
                <p class="text-sm text-muted-foreground leading-snug m-0 break-words bg-muted p-2.5 rounded-md border border-border">{activeEntry.prompt.negative_prompt}</p>
              {/if}
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div class="flex flex-col gap-1">
                <span class="text-xs text-muted-foreground">Dimensions</span>
                <span class="text-sm font-medium text-foreground">{activeEntry.prompt.width}x{activeEntry.prompt.height}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-muted-foreground">Steps</span>
                <span class="text-sm font-medium text-foreground">{activeEntry.prompt.diffusion_steps}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-muted-foreground">CFG Scale</span>
                <span class="text-sm font-medium text-foreground">{activeEntry.prompt.cfg_scale}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-muted-foreground">Scheduler</span>
                <span class="text-sm font-medium text-foreground">{activeEntry.prompt.noise_scheduler || 'N/A'}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-muted-foreground">Seed</span>
                <span class="text-sm font-medium text-foreground">{seedLabel}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-muted-foreground">Variant</span>
                <span class="text-sm font-medium text-foreground uppercase">{variant}</span>
              </div>
            </div>
          {/if}

          {#if currentImageUrl}
            <div class="pt-2 border-t border-border mt-auto">
              <a
                href={currentImageUrl}
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline"
              >
                <ExternalLink size={16} />
                Open original
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</ResponsiveDialogDrawer>
