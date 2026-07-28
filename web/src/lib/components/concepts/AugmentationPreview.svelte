<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import { api } from '$lib/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';

  let {
    draft,
    open = $bindable(false),
    onClose,
  }: {
    draft: Concept;
    open: boolean;
    onClose: () => void;
  } = $props();

  let previewIndex = $state(0);
  let previewAugmentations = $state(false);
  let previewLoading = $state(false);
  let previewData = $state<{ image_data: string; filename: string; prompt: string } | null>(null);

  async function fetchAugPreview() {
    if (!draft) return;
    previewLoading = true;
    try {
      previewData = await api.previewConceptAugmentation(
        draft,
        previewIndex,
        previewAugmentations
      );
    } catch {
      // Gracefully handle preview error without unhandled rejection
    } finally {
      previewLoading = false;
    }
  }

  $effect(() => {
    if (open && draft) {
      fetchAugPreview();
    }
  });

  function handlePrevPreview() {
    if (previewIndex > 0) {
      previewIndex -= 1;
      fetchAugPreview();
    }
  }

  function handleNextPreview() {
    previewIndex += 1;
    fetchAugPreview();
  }
</script>

{#if open}
  <div class="aug-preview-backdrop" role="dialog" aria-modal="true" aria-label="Image Augmentations Live Test">
    <div class="aug-preview-dialog">
      <div class="aug-preview-header">
        <h3 class="aug-preview-title">Image Augmentations Live Test - Sample #{previewIndex + 1}</h3>
        <Button type="button" variant="ghost" size="icon" class="close-btn" onclick={onClose} aria-label="Close">
          <X size={18} />
        </Button>
      </div>

      <div class="aug-preview-modal-body">
        <div class="preview-toolbar">
          <label class="preview-toggle-lbl" for="preview-augmentations">
            <Checkbox
              id="preview-augmentations"
              value={previewAugmentations}
              onChange={(value) => {
                previewAugmentations = value;
                fetchAugPreview();
              }}
            />
            <span>Preview Augmentations</span>
          </label>
        </div>

        <div class="preview-display-box">
          <div class="preview-img-container">
            {#if previewLoading}
              <div class="preview-loading-overlay">Testing Pipeline...</div>
            {/if}

            {#if previewData?.image_data}
              <img
                src={previewData.image_data}
                alt="Augmented Preview"
                class="preview-img"
              />
            {:else}
              <img
                src="/api/concepts/preview-image?path={encodeURIComponent(
                  draft.path || ''
                )}&include_subdirectories={draft.include_subdirectories}"
                alt="Concept Preview"
                class="preview-img"
              />
            {/if}

            <div class="nav-controls-bar">
              <Button
                type="button"
                class="nav-arrow-btn"
                disabled={previewIndex <= 0 || previewLoading}
                onclick={handlePrevPreview}
              >
                <ChevronLeft size={16} />
              </Button>
              <span class="nav-idx-lbl">Sample #{previewIndex + 1}</span>
              <Button
                type="button"
                class="nav-arrow-btn"
                disabled={previewLoading}
                onclick={handleNextPreview}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          <div class="preview-meta-container">
            <div class="meta-row">
              <span class="meta-lbl">Filename:</span>
              <span class="meta-val">{previewData?.filename || 'sample.png'}</span>
            </div>
            <div class="meta-col">
              <span class="meta-lbl">Augmented Prompt Output:</span>
              <div class="prompt-output-box">
                {previewData?.prompt || '[No caption output]'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="aug-preview-footer">
        <Button
          type="button"
          variant="secondary"
          onclick={onClose}
        >
          Close Preview
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .aug-preview-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    backdrop-filter: blur(2px);
  }

  .aug-preview-dialog {
    background: var(--panel, #181e25);
    border: 1px solid var(--line, #2d3741);
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  }

  .aug-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--line, #2d3741);
  }

  .aug-preview-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--muted, #94a3b8);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: var(--text, #f8fafc);
    background: var(--panel-raised, #252d37);
  }

  .aug-preview-modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .preview-toolbar {
    display: flex;
    align-items: center;
  }

  .preview-toggle-lbl {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text, #f8fafc);
    cursor: pointer;
  }

  .preview-display-box {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .preview-img-container {
    position: relative;
    width: 100%;
    height: 320px;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .preview-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    color: var(--text, #f8fafc);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 500;
    z-index: 10;
  }

  .nav-controls-bar {
    position: absolute;
    bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.75);
    padding: 0.25rem 0.5rem;
    border-radius: 20px;
    backdrop-filter: blur(4px);
  }

  .nav-idx-lbl {
    font-size: 0.75rem;
    color: var(--text, #f8fafc);
    font-weight: 600;
  }

  .nav-controls-bar :global(.nav-arrow-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    min-height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    cursor: pointer;
  }

  .nav-controls-bar :global(.nav-arrow-btn:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .preview-meta-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--panel, #181e25);
    padding: 0.75rem;
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .meta-row {
    display: flex;
    gap: 0.5rem;
  }

  .meta-col {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-lbl {
    color: var(--muted, #94a3b8);
    font-weight: 500;
  }

  .meta-val {
    color: var(--text, #f8fafc);
  }

  .prompt-output-box {
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    padding: 0.5rem;
    border-radius: 4px;
    color: var(--text, #f8fafc);
    font-family: monospace;
    font-size: 0.75rem;
    word-break: break-all;
    max-height: 80px;
    overflow-y: auto;
  }

  .aug-preview-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--line, #2d3741);
    background: var(--panel-raised, #1d242c);
  }
</style>
