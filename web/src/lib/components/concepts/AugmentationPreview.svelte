<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import { api } from '$lib/api/client';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';

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
  <ResponsiveDialogDrawer
    {open}
    onOpenChange={(val) => {
      if (!val) onClose();
    }}
    title="Image Augmentations Live Test - Sample #{previewIndex + 1}"
    class="max-w-2xl"
  >
    <div class="aug-preview-modal-body flex flex-col gap-4">
      <div class="preview-toolbar flex items-center">
        <label class="preview-toggle-lbl flex items-center gap-2 text-sm cursor-pointer" for="preview-augmentations">
          <Checkbox
            id="preview-augmentations"
            checked={previewAugmentations}
            onChange={(checked) => {
              previewAugmentations = checked;
              fetchAugPreview();
            }}
          />
          <span>Preview Augmentations</span>
        </label>
      </div>

      <div class="preview-display-box flex flex-col gap-3">
        <div class="preview-img-container relative w-full h-[320px] bg-muted border border-border rounded-lg flex items-center justify-center overflow-hidden">
          {#if previewLoading}
            <div class="preview-loading-overlay absolute inset-0 bg-black/60 text-foreground flex items-center justify-center text-sm font-medium z-10">
              Testing Pipeline...
            </div>
          {/if}

          {#if previewData?.image_data}
            <img
              src={previewData.image_data}
              alt="Augmented Preview"
              class="preview-img max-w-full max-h-full object-contain"
            />
          {:else}
            <img
              src="/api/concepts/preview-image?path={encodeURIComponent(
                draft.path || ''
              )}&include_subdirectories={draft.include_subdirectories}"
              alt="Concept Preview"
              class="preview-img max-w-full max-h-full object-contain"
            />
          {/if}

          <div class="nav-controls-bar absolute bottom-2 flex items-center gap-2 bg-black/75 px-2 py-1 rounded-full backdrop-blur-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-6 w-6 rounded-full bg-white/10 p-0 text-white hover:bg-white/20 disabled:opacity-40"
              disabled={previewIndex <= 0 || previewLoading}
              onclick={handlePrevPreview}
            >
              <ChevronLeft size={16} />
            </Button>
            <span class="nav-idx-lbl text-xs text-foreground font-semibold">Sample #{previewIndex + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-6 w-6 rounded-full bg-white/10 p-0 text-white hover:bg-white/20 disabled:opacity-40"
              disabled={previewLoading}
              onclick={handleNextPreview}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div class="preview-meta-container flex flex-col gap-2 bg-card p-3 border border-border rounded-lg text-xs">
          <div class="meta-row flex gap-2">
            <span class="meta-lbl text-muted-foreground font-medium">Filename:</span>
            <span class="meta-val text-foreground">{previewData?.filename || 'sample.png'}</span>
          </div>
          <div class="meta-col flex flex-col gap-1">
            <span class="meta-lbl text-muted-foreground font-medium">Augmented Prompt Output:</span>
            <div class="prompt-output-box bg-muted border border-border p-2 rounded font-mono text-xs break-all max-h-20 overflow-y-auto">
              {previewData?.prompt || '[No caption output]'}
            </div>
          </div>
        </div>
      </div>
    </div>

    {#snippet footer()}
      <div class="aug-preview-footer flex justify-end w-full">
        <Button
          type="button"
          variant="secondary"
          onclick={onClose}
        >
          Close Preview
        </Button>
      </div>
    {/snippet}
  </ResponsiveDialogDrawer>
{/if}
