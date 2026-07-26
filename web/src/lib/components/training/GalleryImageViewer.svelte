<script lang="ts">
  import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-svelte';
  import ModalDialog from '../ui/ModalDialog.svelte';
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
          b.expected_prompt_ids.includes(promptId) &&
          b.expected_variants.includes(variant)
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

<ModalDialog
  {open}
  width="wide"
  showFooter={false}
  {onClose}
  onKeyDown={handleViewerKeyDown}
  data-batch-id={selection?.batchId}
  data-prompt-id={selection?.promptId}
  data-variant={selection?.variant}
>
  {#if activeEntry}
    <div class="viewer-container">
      <div class="viewer-header-info">
        <span class="checkpoint-title">
          Epoch {activeEntry.batch.epoch} {'\u00b7'} Step {activeEntry.batch.global_step}
        </span>
        {#if isRevisionBoundary}
          <span class="revision-boundary-badge">
            Prompt changed at this checkpoint
          </span>
        {/if}
      </div>

      <div class="viewer-main-content">
        <div
          class="viewer-image-stage"
          role="region"
          aria-label="Image viewer stage"
          ontouchstart={handleTouchStart}
          ontouchend={handleTouchEnd}
        >
          {#if currentImageUrl}
            <img
              src={currentImageUrl}
              alt="Sample Epoch {activeEntry.batch.epoch} Step {activeEntry.batch.global_step}"
              class="viewer-image"
            />
          {:else}
            <div class="viewer-no-image">No Image Available</div>
          {/if}

          <button
            type="button"
            class="nav-btn nav-btn-prev"
            aria-label="Previous checkpoint"
            disabled={activeReadyIndex <= 0}
            onclick={() => navigate(-1)}
          >
            <ChevronLeft size={24} />
          </button>

          <button
            type="button"
            class="nav-btn nav-btn-next"
            aria-label="Next checkpoint"
            disabled={activeReadyIndex < 0 || activeReadyIndex >= readyEntries.length - 1}
            onclick={() => navigate(1)}
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div class="viewer-sidebar">
          {#if activeEntry.prompt}
            <div class="metadata-section">
              <h4 class="section-title">Prompt</h4>
              <p class="prompt-text">{activeEntry.prompt.prompt}</p>

              {#if activeEntry.prompt.negative_prompt}
                <h4 class="section-title">Negative Prompt</h4>
                <p class="prompt-text negative">{activeEntry.prompt.negative_prompt}</p>
              {/if}
            </div>

            <div class="metadata-grid">
              <div class="meta-item">
                <span class="meta-label">Dimensions</span>
                <span class="meta-value">{activeEntry.prompt.width}x{activeEntry.prompt.height}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Steps</span>
                <span class="meta-value">{activeEntry.prompt.diffusion_steps}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">CFG Scale</span>
                <span class="meta-value">{activeEntry.prompt.cfg_scale}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Scheduler</span>
                <span class="meta-value">{activeEntry.prompt.noise_scheduler || 'N/A'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Seed</span>
                <span class="meta-value">{seedLabel}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Variant</span>
                <span class="meta-value uppercase">{variant}</span>
              </div>
            </div>
          {/if}

          {#if currentImageUrl}
            <div class="original-link-container">
              <a
                href={currentImageUrl}
                target="_blank"
                rel="noreferrer"
                class="open-original-link"
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
</ModalDialog>

<style>
  .viewer-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    color: var(--text);
  }

  .viewer-header-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .checkpoint-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text);
  }

  .revision-boundary-badge {
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.3);
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
  }

  .viewer-main-content {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.25rem;
    min-height: 400px;
  }

  .viewer-image-stage {
    position: relative;
    background: #000000;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 400px;
    user-select: none;
  }

  .viewer-image {
    max-width: 100%;
    max-height: 65vh;
    object-fit: contain;
  }

  .viewer-no-image {
    color: var(--muted);
    font-size: 0.9rem;
  }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.6);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
  }

  .nav-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.85);
  }

  .nav-btn:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .nav-btn-prev {
    left: 12px;
  }

  .nav-btn-next {
    right: 12px;
  }

  .viewer-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background: var(--panel);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid var(--line);
    overflow-y: auto;
    max-height: 65vh;
  }

  .metadata-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0;
  }

  .prompt-text {
    font-size: 0.875rem;
    color: var(--text);
    line-height: 1.4;
    margin: 0;
    word-break: break-word;
    background: var(--control);
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--line);
  }

  .prompt-text.negative {
    color: var(--muted);
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .meta-label {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .meta-value {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
  }

  .uppercase {
    text-transform: uppercase;
  }

  .original-link-container {
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
    margin-top: auto;
  }

  .open-original-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--accent);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .open-original-link:hover {
    text-decoration: underline;
  }

  @media (max-width: 800px) {
    .viewer-main-content {
      grid-template-columns: 1fr;
    }
  }
</style>
