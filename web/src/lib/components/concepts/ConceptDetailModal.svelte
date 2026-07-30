<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import SubNav from '$lib/components/layout/SubNav.svelte';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
  import DirectoryPicker from '$lib/components/directory/DirectoryPicker.svelte';
  import DatasetPickerModal from '$lib/components/datasets/DatasetPickerModal.svelte';
  import { normalizeConceptDraft } from './concept-draft';

  import ConceptGeneralFields from './ConceptGeneralFields.svelte';
  import ConceptImageFields from './ConceptImageFields.svelte';
  import ConceptTextFields from './ConceptTextFields.svelte';
  import ConceptStatsPanel from './ConceptStatsPanel.svelte';
  import AugmentationPreview from './AugmentationPreview.svelte';

  import { AlertCircle } from '@lucide/svelte';
  import { Alert } from '$lib/components/ui/alert';

  let {
    concept,
    isOpen = false,
    onSave,
    onClose,
    openDirectory,
  } = $props<{
    concept: Concept | null;
    isOpen: boolean;
    onSave: (updated: Concept) => Promise<void> | void;
    onClose: () => void;
    openDirectory?: (mode: 'file' | 'dir', currentPath?: string) => Promise<string | null>;
  }>();

  const conceptTabs = [
    { id: 'general', label: 'General' },
    { id: 'image', label: 'Image Augmentations' },
    { id: 'text', label: 'Text Augmentations' },
    { id: 'stats', label: 'Statistics' },
  ];

  let activeTab = $state<'general' | 'image' | 'text' | 'stats'>('general');
  let draft = $state<Concept | null>(null);

  let showDatasetPicker = $state(false);
  let showDirPicker = $state(false);
  let dirPickerPath = $state('/');
  let dirPickerMode = $state<'dir' | 'file'>('dir');
  let dirPickerTarget = $state<'concept' | 'prompt' | 'special_tags'>('concept');
  let showAugPreviewModal = $state(false);

  let isSaving = $state(false);
  let saveError = $state<string | null>(null);

  $effect(() => {
    if (concept && isOpen) {
      isSaving = false;
      saveError = null;
      const cloned: Concept = JSON.parse(JSON.stringify(concept));

      if (cloned.image_variations === undefined) cloned.image_variations = 1;
      if (cloned.text_variations === undefined) cloned.text_variations = 1;

      if (!cloned.image) {
        cloned.image = {
          enable_crop_jitter: true,
          enable_random_flip: false,
          enable_fixed_flip: false,
          enable_random_rotate: false,
          enable_fixed_rotate: false,
          random_rotate_max_angle: 0.0,
          enable_random_brightness: false,
          enable_fixed_brightness: false,
          random_brightness_max_strength: 0.0,
          enable_random_contrast: false,
          enable_fixed_contrast: false,
          random_contrast_max_strength: 0.0,
          enable_random_saturation: false,
          enable_fixed_saturation: false,
          random_saturation_max_strength: 0.0,
          enable_random_hue: false,
          enable_fixed_hue: false,
          random_hue_max_strength: 0.0,
          enable_resolution_override: false,
          resolution_override: '512',
          enable_random_circular_mask_shrink: false,
          enable_random_mask_rotate_crop: false,
        };
      }
      if (!cloned.text) {
        cloned.text = {
          prompt_source: 'sample',
          prompt_path: '',
          enable_tag_shuffling: false,
          tag_delimiter: ',',
          keep_tags_count: 1,
          tag_dropout_enable: false,
          tag_dropout_mode: 'FULL',
          tag_dropout_probability: 0.0,
          tag_dropout_special_tags_mode: 'NONE',
          tag_dropout_special_tags: '',
          tag_dropout_special_tags_regex: false,
          caps_randomize_enable: false,
          caps_randomize_mode: 'capslock, title, first, random',
          caps_randomize_probability: 0.0,
          caps_randomize_lowercase: false,
        };
      }
      draft = cloned;
      showAugPreviewModal = false;
    }
  });

  async function handleSave() {
    if (!draft || isSaving) return;
    saveError = null;
    isSaving = true;
    try {
      await onSave(normalizeConceptDraft(draft));
    } catch (err: any) {
      saveError = err?.message || 'Failed to save concept settings';
    } finally {
      isSaving = false;
    }
  }

  function handleBrowsePath(
    mode: 'dir' | 'file',
    target: 'concept' | 'prompt' | 'special_tags',
    currentPath: string
  ) {
    if (openDirectory) {
      openDirectory(mode, currentPath).then((selected: string | null) => {
        if (selected && draft) {
          if (target === 'prompt' && draft.text) {
            draft.text.prompt_path = selected;
          } else if (target === 'special_tags' && draft.text) {
            draft.text.tag_dropout_special_tags = selected;
          } else {
            draft.path = selected;
          }
        }
      });
      return;
    }

    dirPickerPath = currentPath || '/';
    dirPickerMode = mode;
    dirPickerTarget = target;
    showDirPicker = true;
  }
</script>

{#if isOpen && draft}
  <!--
    The height is stated twice on purpose. Plain `max-h-[90dvh]` is what the
    desktop Dialog branch needs -- and it is (0,1,0), so on the mobile Drawer
    branch it loses to drawer-content's own
    `data-[vaul-drawer-direction=bottom]:max-h-[80dvh]` at (0,2,0) and the
    editor silently capped at 80dvh instead of the 90 it asks for. The prefixed
    copy ties that specificity so ours wins there; see the same note in
    DirectoryPicker. Deleting either line changes a height. `max-w-4xl` needs no
    prefix: it only has to beat Dialog.Content's `sm:max-w-lg`, and the drawer
    card is deliberately inset-x-3 / max-w-md.
  -->
  <ResponsiveDialogDrawer
    open={isOpen}
    onOpenChange={(val) => {
      if (!val && !isSaving) onClose();
    }}
    title="Concept Configuration - {draft.name || draft.path || 'New Concept'}"
    class="max-w-4xl max-h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
    bodyClass="flex min-h-0 flex-col"
  >
    <div class="concept-modal-body">
      <div class="shrink-0">
        <SubNav
          items={conceptTabs}
          value={activeTab}
          onChange={(id) => (activeTab = id as any)}
          label="Concept section"
        />
      </div>

      <ScrollArea class="h-[520px] max-h-[60dvh] min-h-[96px]">
        <div class="tab-content-inner">
          {#if activeTab === 'general'}
            <ConceptGeneralFields
              bind:draft
              onBrowsePath={handleBrowsePath}
              onOpenDatasetPicker={() => (showDatasetPicker = true)}
            />
          {:else if activeTab === 'image' && draft.image}
            <ConceptImageFields
              bind:image={draft.image}
              onOpenPreview={() => (showAugPreviewModal = true)}
            />
          {:else if activeTab === 'text' && draft.text}
            <ConceptTextFields
              bind:text={draft.text}
              onBrowsePath={handleBrowsePath}
            />
          {:else if activeTab === 'stats'}
            <ConceptStatsPanel {draft} />
          {/if}
        </div>
      </ScrollArea>
    </div>

    {#snippet footer()}
      <div class="dialog-actions-footer">
        {#if saveError}
          <Alert variant="destructive" class="modal-save-error">
            <AlertCircle size={16} />
            <span>{saveError}</span>
          </Alert>
        {/if}
        <Button
          type="button"
          variant="secondary"
          disabled={isSaving}
          onclick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          disabled={isSaving}
          onclick={handleSave}
        >
          {isSaving ? 'Saving...' : 'Save Concept Settings'}
        </Button>
      </div>
    {/snippet}
  </ResponsiveDialogDrawer>

  {#if showAugPreviewModal}
    <AugmentationPreview
      {draft}
      bind:open={showAugPreviewModal}
      onClose={() => (showAugPreviewModal = false)}
    />
  {/if}

  {#if showDirPicker}
    <DirectoryPicker
      open={showDirPicker}
      initialPath={dirPickerPath || '/'}
      mode={dirPickerMode}
      onSelect={(selected) => {
        if (dirPickerTarget === 'prompt' && draft?.text) {
          draft.text.prompt_path = selected;
        } else if (dirPickerTarget === 'special_tags' && draft?.text) {
          draft.text.tag_dropout_special_tags = selected;
        } else if (draft) {
          draft.path = selected;
        }
        showDirPicker = false;
      }}
      onClose={() => (showDirPicker = false)}
    />
  {/if}

  <DatasetPickerModal
    open={showDatasetPicker}
    currentPath={draft?.path}
    onSelect={(selectedPath) => {
      if (draft) draft.path = selectedPath;
      showDatasetPicker = false;
    }}
    onClose={() => (showDatasetPicker = false)}
  />
{/if}

<style>
  .concept-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }

  .tab-content-inner {
    /*
      Vertical only. The 0.25rem horizontal component nested inside the drawer
      body's own px-4 for a 20px inset on mobile -- the same doubled inset that
      was dropped from DatasetPickerModal's p-2, so the two consumers are
      treated the same way.
    */
    padding: 0.5rem 0;
  }

  .dialog-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    width: 100%;
  }
</style>
