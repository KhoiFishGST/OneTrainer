<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import { api } from '$lib/api/client';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import Field from '$lib/components/form/Field.svelte';
  import TextInput from '$lib/components/form/TextInput.svelte';
  import NumberInput from '$lib/components/form/NumberInput.svelte';
  import Toggle from '$lib/components/form/Toggle.svelte';
  import DirectoryInput from '$lib/components/form/DirectoryInput.svelte';
  import DirectoryPicker from '$lib/components/directory/DirectoryPicker.svelte';
  import Select from '$lib/components/form/Select.svelte';
  import DatasetPickerModal from '$lib/components/datasets/DatasetPickerModal.svelte';
  import {
    FolderKanban,
    FolderOpen,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Eye,
  } from 'lucide-svelte';

  let {
    concept,
    isOpen = false,
    onSave,
    onClose,
    openDirectory,
  } = $props<{
    concept: Concept | null;
    isOpen: boolean;
    onSave: (updated: Concept) => void;
    onClose: () => void;
    openDirectory?: (mode: 'file' | 'dir', currentPath?: string) => Promise<string | null>;
  }>();

  let activeTab = $state<'general' | 'image' | 'text' | 'stats'>('general');
  let draft = $state<Concept | null>(null);
  let showDatasetPicker = $state(false);

  let showDirPicker = $state(false);
  let dirPickerPath = $state('/');
  let dirPickerMode = $state<'dir' | 'file'>('dir');
  let dirPickerTarget = $state<'concept' | 'prompt' | 'special_tags'>('concept');

  // Layered Image Augmentation Preview Modal state
  let showAugPreviewModal = $state(false);
  let previewIndex = $state(0);
  let previewAugmentations = $state(false);
  let previewLoading = $state(false);
  let previewData = $state<{ image_data: string; filename: string; prompt: string } | null>(null);

  // Concept Stats state
  let statsLoading = $state(false);
  let statsData = $state<Record<string, any> | null>(null);

  $effect(() => {
    if (concept && isOpen) {
      const cloned = JSON.parse(JSON.stringify(concept));

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
      statsData = null;
      previewData = null;
      previewIndex = 0;
      showAugPreviewModal = false;
    }
  });

  async function fetchStats(advanced = false) {
    if (!draft?.path) return;
    statsLoading = true;
    try {
      statsData = await api.getConceptStats(
        draft.path,
        advanced,
        draft.include_subdirectories || false
      );
    } catch {
      // Ignore network errors gracefully
    } finally {
      statsLoading = false;
    }
  }

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
      // Ignore preview errors gracefully
    } finally {
      previewLoading = false;
    }
  }

  $effect(() => {
    if (activeTab === 'stats' && draft?.path) {
      if (!statsData) {
        fetchStats(false);
      }
    }
  });

  $effect(() => {
    if (showAugPreviewModal && draft) {
      fetchAugPreview();
    }
  });

  function handleSave() {
    if (draft) {
      onSave(draft);
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

  function formatBytes(bytes?: number): string {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatPixelText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${(arr[0] / 1000000).toFixed(2)} MP, ${arr[2] || ''}\n${arr[1] || ''}`;
  }

  function formatCaptionText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${arr[0]} chars, ${arr[2] || 0} words\n${arr[1] || ''}`;
  }

  function formatLengthText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${Math.round(arr[0])} frames\n${arr[1] || ''}`;
  }

  function formatFpsText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${Math.round(arr[0])} fps\n${arr[1] || ''}`;
  }

  function decimalToAspectRatio(val: number): string {
    if (!val) return '1:1';
    if (Math.abs(val - 1.0) < 0.02) return '1:1';
    if (Math.abs(val - 0.75) < 0.02) return '4:3';
    if (Math.abs(val - 1.333333) < 0.02) return '3:4';
    if (Math.abs(val - 0.5625) < 0.02) return '16:9';
    if (Math.abs(val - 1.777778) < 0.02) return '9:16';
    if (Math.abs(val - 0.5) < 0.02) return '2:1';
    if (Math.abs(val - 2.0) < 0.02) return '1:2';
    if (Math.abs(val - 0.666667) < 0.02) return '3:2';
    if (Math.abs(val - 1.5) < 0.02) return '2:3';
    if (Math.abs(val - 0.8) < 0.02) return '5:4';
    if (Math.abs(val - 1.25) < 0.02) return '4:5';
    return val.toFixed(2);
  }

  function getSmallestBuckets(buckets?: Record<string, number>): string {
    if (!buckets) return '-';
    const entries = Object.entries(buckets)
      .map(([k, v]) => ({ aspect: parseFloat(k), count: v }))
      .filter((b) => b.count > 0);
    if (entries.length === 0) return '-';
    const minVal = Math.min(...entries.map((e) => e.count));
    const minEntries = entries.filter((e) => e.count === minVal);
    return minEntries
      .map((e) => `aspect ${decimalToAspectRatio(e.aspect)} : ${e.count} img`)
      .join(', ');
  }
</script>

{#if isOpen && draft}
  <ModalDialog
    open={isOpen}
    title="Concept Configuration - {draft.name || draft.path || 'New Concept'}"
    applyText="Save Concept Settings"
    width="medium"
    onApply={handleSave}
    {onClose}
  >
    <div class="concept-modal-body">
      <!-- Subnav Tabs -->
      <div class="subnav-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'general'}
          class="subnav-btn"
          class:active={activeTab === 'general'}
          onclick={() => (activeTab = 'general')}
        >
          General
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'image'}
          class="subnav-btn"
          class:active={activeTab === 'image'}
          onclick={() => (activeTab = 'image')}
        >
          Image Augmentations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          class="subnav-btn"
          class:active={activeTab === 'text'}
          onclick={() => (activeTab = 'text')}
        >
          Text Augmentations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stats'}
          class="subnav-btn"
          class:active={activeTab === 'stats'}
          onclick={() => (activeTab = 'stats')}
        >
          Statistics
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="tab-content">
        {#if activeTab === 'general' && draft}
          {@const d = draft}
          <div class="form-stack">
            <Field id="concept-name" label="Name" tooltip="Name of the concept">
              {#snippet children({ id, ariaDescribedBy })}
                <TextInput
                  {id}
                  value={d.name || ''}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    d.name = val;
                  }}
                  placeholder="e.g. MyCharacter"
                />
              {/snippet}
            </Field>

            <Field id="concept-enabled" label="Enabled" tooltip="Enable or disable this concept">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={d.enabled}
                  {ariaDescribedBy}
                  onChange={(val) => {
                    d.enabled = val;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="concept-type"
              label="Concept Type"
              tooltip="STANDARD: Standard finetuning with sample as training target. VALIDATION: Use concept for validation instead of training. PRIOR_PREDICTION: Use sample to make a prediction using prior model as training target."
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Select
                  {id}
                  value={d.type}
                  options={[
                    { value: 'STANDARD', label: 'STANDARD (Finetune training target)' },
                    { value: 'VALIDATION', label: 'VALIDATION (Validation dataset)' },
                    {
                      value: 'PRIOR_PREDICTION',
                      label: 'PRIOR_PREDICTION (Prior preservation regularization)',
                    },
                  ]}
                  {ariaDescribedBy}
                  onChange={(v) => {
                    d.type = v;
                  }}
                />
              {/snippet}
            </Field>

            <Field id="concept-path" label="Path" tooltip="Path where the training data is located">
              {#snippet children({ id, ariaDescribedBy })}
                <div class="path-field-stack">
                  <TextInput
                    {id}
                    value={d.path || ''}
                    {ariaDescribedBy}
                    onInput={(val) => {
                      d.path = val;
                    }}
                    placeholder="/path/to/dataset/images"
                  />
                  <div class="path-action-row">
                    <label
                      class="subdir-toggle-inline"
                      title="Includes images from subdirectories into the dataset"
                    >
                      <Toggle
                        id="concept-subdirs-inline"
                        value={d.include_subdirectories}
                        onChange={(val) => {
                          d.include_subdirectories = val;
                        }}
                      />
                      <span>Subdirectories</span>
                    </label>
                    <button
                      type="button"
                      class="btn-path-action"
                      onclick={() => handleBrowsePath('dir', 'concept', d.path || '')}
                    >
                      <FolderOpen size={16} />
                      <span>Browse</span>
                    </button>
                    <button
                      type="button"
                      class="btn-path-action btn-accent-action"
                      onclick={() => (showDatasetPicker = true)}
                    >
                      <FolderKanban size={16} />
                      <span>Datasets</span>
                    </button>
                  </div>
                </div>
              {/snippet}
            </Field>

            <Field
              id="concept-prompt-source"
              label="Prompt Source"
              tooltip="The source for prompts used during training. When selecting 'From single text file', specify prompt file path below."
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Select
                  {id}
                  value={d.text.prompt_source}
                  options={[
                    { value: 'sample', label: 'From text file per sample (.txt / .caption)' },
                    { value: 'concept', label: 'From single text file' },
                    { value: 'filename', label: 'From image file name' },
                  ]}
                  {ariaDescribedBy}
                  onChange={(v) => {
                    d.text.prompt_source = v;
                  }}
                />
              {/snippet}
            </Field>

            {#if d.text.prompt_source === 'concept'}
              <Field
                id="concept-prompt-path"
                label="Prompt Path"
                tooltip="Path to single text file containing training prompts"
              >
                {#snippet children({ id, ariaDescribedBy })}
                  <DirectoryInput
                    {id}
                    value={d.text.prompt_path || ''}
                    {ariaDescribedBy}
                    buttonLabel="Browse"
                    onInput={(val) => {
                      d.text.prompt_path = val;
                    }}
                    onOpenDirectory={(curr) => handleBrowsePath('file', 'prompt', curr)}
                    placeholder="/path/to/prompts.txt"
                  />
                {/snippet}
              </Field>
            {/if}

            <Field
              id="concept-img-variations"
              label="Image Variations"
              tooltip="The number of different image versions to cache if latent caching is enabled."
            >
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={d.image_variations}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    d.image_variations = parseInt(val, 10) || 1;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="concept-text-variations"
              label="Text Variations"
              tooltip="The number of different text versions to cache if latent caching is enabled."
            >
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={d.text_variations}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    d.text_variations = parseInt(val, 10) || 1;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="concept-balancing-strategy"
              label="Balancing Strategy"
              tooltip="Use REPEATS to multiply concept, or SAMPLES to specify exact target count"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Select
                  {id}
                  value={d.balancing_strategy}
                  options={[
                    { value: 'REPEATS', label: 'REPEATS (Multiply dataset epoch count)' },
                    { value: 'SAMPLES', label: 'SAMPLES (Exact sample target count)' },
                  ]}
                  {ariaDescribedBy}
                  onChange={(v) => {
                    d.balancing_strategy = v;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="concept-balancing"
              label="Balancing Value"
              tooltip="The number of samples/repeats used during training"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={d.balancing}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    d.balancing = parseFloat(val) || 0;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="concept-loss-weight"
              label="Loss Weight"
              tooltip="The loss multiplier for this concept"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={d.loss_weight}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    d.loss_weight = parseFloat(val) || 0;
                  }}
                />
              {/snippet}
            </Field>
          </div>
        {:else if activeTab === 'image' && draft && draft.image}
          {@const img = draft.image}
          <div class="aug-tab-container">
            <!-- 2-Column Augmentations Matrix Table -->
            <div class="aug-matrix-wrapper">
              <div class="aug-matrix-header">
                <div class="col-lbl">Augmentation Feature</div>
                <div class="col-sw">Random</div>
                <div class="col-sw">Fixed</div>
                <div class="col-val">Value / Max Strength</div>
              </div>

              <!-- Crop Jitter -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Enables random cropping of samples">Crop Jitter</div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-crop-jitter"
                    value={img.enable_crop_jitter}
                    onChange={(v) => (img.enable_crop_jitter = v)}
                  />
                </div>
                <div class="col-sw">-</div>
                <div class="col-val">-</div>
              </div>

              <!-- Random / Fixed Flip -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Randomly or fixed flip sample during training">
                  Flip
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-rand-flip"
                    value={img.enable_random_flip}
                    onChange={(v) => (img.enable_random_flip = v)}
                  />
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-fixed-flip"
                    value={img.enable_fixed_flip}
                    onChange={(v) => (img.enable_fixed_flip = v)}
                  />
                </div>
                <div class="col-val">-</div>
              </div>

              <!-- Rotation -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Rotates the sample during training">Rotation</div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-rand-rot"
                    value={img.enable_random_rotate}
                    onChange={(v) => (img.enable_random_rotate = v)}
                  />
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-fixed-rot"
                    value={img.enable_fixed_rotate}
                    onChange={(v) => (img.enable_fixed_rotate = v)}
                  />
                </div>
                <div class="col-val">
                  <NumberInput
                    id="aug-matrix-rot-angle"
                    value={img.random_rotate_max_angle}
                    onInput={(v) => (img.random_rotate_max_angle = parseFloat(v) || 0)}
                    placeholder="Angle (°)"
                  />
                </div>
              </div>

              <!-- Brightness -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Adjusts brightness of sample during training">
                  Brightness
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-rand-bright"
                    value={img.enable_random_brightness}
                    onChange={(v) => (img.enable_random_brightness = v)}
                  />
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-fixed-bright"
                    value={img.enable_fixed_brightness}
                    onChange={(v) => (img.enable_fixed_brightness = v)}
                  />
                </div>
                <div class="col-val">
                  <NumberInput
                    id="aug-matrix-bright-strength"
                    value={img.random_brightness_max_strength}
                    onInput={(v) => (img.random_brightness_max_strength = parseFloat(v) || 0)}
                    placeholder="Max Strength"
                  />
                </div>
              </div>

              <!-- Contrast -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Adjusts contrast of sample during training">
                  Contrast
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-rand-contrast"
                    value={img.enable_random_contrast}
                    onChange={(v) => (img.enable_random_contrast = v)}
                  />
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-fixed-contrast"
                    value={img.enable_fixed_contrast}
                    onChange={(v) => (img.enable_fixed_contrast = v)}
                  />
                </div>
                <div class="col-val">
                  <NumberInput
                    id="aug-matrix-contrast-strength"
                    value={img.random_contrast_max_strength}
                    onInput={(v) => (img.random_contrast_max_strength = parseFloat(v) || 0)}
                    placeholder="Max Strength"
                  />
                </div>
              </div>

              <!-- Saturation -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Adjusts saturation of sample during training">
                  Saturation
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-rand-sat"
                    value={img.enable_random_saturation}
                    onChange={(v) => (img.enable_random_saturation = v)}
                  />
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-fixed-sat"
                    value={img.enable_fixed_saturation}
                    onChange={(v) => (img.enable_fixed_saturation = v)}
                  />
                </div>
                <div class="col-val">
                  <NumberInput
                    id="aug-matrix-sat-strength"
                    value={img.random_saturation_max_strength}
                    onInput={(v) => (img.random_saturation_max_strength = parseFloat(v) || 0)}
                    placeholder="Max Strength"
                  />
                </div>
              </div>

              <!-- Hue -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Adjusts hue of sample during training">Hue</div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-rand-hue"
                    value={img.enable_random_hue}
                    onChange={(v) => (img.enable_random_hue = v)}
                  />
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-fixed-hue"
                    value={img.enable_fixed_hue}
                    onChange={(v) => (img.enable_fixed_hue = v)}
                  />
                </div>
                <div class="col-val">
                  <NumberInput
                    id="aug-matrix-hue-strength"
                    value={img.random_hue_max_strength}
                    onInput={(v) => (img.random_hue_max_strength = parseFloat(v) || 0)}
                    placeholder="Max Strength"
                  />
                </div>
              </div>

              <!-- Circular Mask Generation -->
              <div class="aug-matrix-row">
                <div class="col-lbl" title="Automatically create circular masks for masked training">
                  Circular Mask Generation
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-circular-mask"
                    value={img.enable_random_circular_mask_shrink}
                    onChange={(v) => (img.enable_random_circular_mask_shrink = v)}
                  />
                </div>
                <div class="col-sw">-</div>
                <div class="col-val">-</div>
              </div>

              <!-- Random Rotate & Crop -->
              <div class="aug-matrix-row">
                <div
                  class="col-lbl"
                  title="Randomly rotate training samples and crop to masked region"
                >
                  Random Rotate & Crop
                </div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-rotate-crop"
                    value={img.enable_random_mask_rotate_crop}
                    onChange={(v) => (img.enable_random_mask_rotate_crop = v)}
                  />
                </div>
                <div class="col-sw">-</div>
                <div class="col-val">-</div>
              </div>

              <!-- Resolution Override -->
              <div class="aug-matrix-row">
                <div
                  class="col-lbl"
                  title="Override resolution for this concept in format <width>x<height>"
                >
                  Resolution Override
                </div>
                <div class="col-sw">-</div>
                <div class="col-sw">
                  <Toggle
                    id="aug-matrix-res-override-toggle"
                    value={img.enable_resolution_override}
                    onChange={(v) => (img.enable_resolution_override = v)}
                  />
                </div>
                <div class="col-val">
                  {#if img.enable_resolution_override}
                    <TextInput
                      id="aug-matrix-res-override-val"
                      value={img.resolution_override || ''}
                      onInput={(v) => (img.resolution_override = v)}
                      placeholder="512x512"
                    />
                  {:else}
                    <span class="muted-dash">-</span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Compact Bottom Action Bar for Preview Trigger -->
            <div class="aug-bottom-action-bar">
              <button
                type="button"
                class="btn-aug-preview-compact"
                onclick={() => (showAugPreviewModal = true)}
              >
                <Eye size={14} />
                <span>Preview</span>
              </button>
            </div>
          </div>
        {:else if activeTab === 'text' && draft && draft.text}
          {@const txt = draft.text}
          <div class="form-stack">
            <!-- Combined Tag Options Row (Tag Shuffling & Tag Dropout) -->
            <Field
              id="aug-tag-options"
              label="Tag Options"
              tooltip="Enable tag shuffling and/or tag dropout"
            >
              {#snippet children({ id: _id, ariaDescribedBy: _aria })}
                <div class="tag-options-row">
                  <label class="inline-toggle-item" title="Enables tag shuffling">
                    <Toggle
                      id="aug-tag-shuffle-inline"
                      value={txt.enable_tag_shuffling}
                      onChange={(val) => {
                        txt.enable_tag_shuffling = val;
                      }}
                    />
                    <span>Shuffling</span>
                  </label>

                  <label class="inline-toggle-item" title="Enables random dropout for tags in captions">
                    <Toggle
                      id="aug-tag-dropout-inline"
                      value={txt.tag_dropout_enable}
                      onChange={(val) => {
                        txt.tag_dropout_enable = val;
                      }}
                    />
                    <span>Dropout</span>
                  </label>
                </div>
              {/snippet}
            </Field>

            <Field id="aug-tag-delim" label="Tag Delimiter" tooltip="The delimiter between tags">
              {#snippet children({ id, ariaDescribedBy })}
                <TextInput
                  {id}
                  value={txt.tag_delimiter || ','}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    txt.tag_delimiter = val;
                  }}
                  placeholder=","
                />
              {/snippet}
            </Field>

            <Field
              id="aug-keep-tags"
              label="Keep Tag Count"
              tooltip="Number of tags at start of caption that are not shuffled or dropped"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={txt.keep_tags_count}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    txt.keep_tags_count = parseInt(val, 10) || 0;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="aug-dropout-mode"
              label="Dropout Mode"
              tooltip="FULL: drop entire caption past kept tags; RANDOM: drop individual tags; RANDOM WEIGHTED: linearly increase drop probability"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Select
                  {id}
                  value={txt.tag_dropout_mode}
                  options={[
                    { value: 'FULL', label: 'Full' },
                    { value: 'RANDOM', label: 'Random' },
                    { value: 'RANDOM WEIGHTED', label: 'Random Weighted' },
                  ]}
                  {ariaDescribedBy}
                  onChange={(v) => {
                    txt.tag_dropout_mode = v;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="aug-dropout-prob"
              label="Probability"
              tooltip="Probability to drop tags (0 to 1)"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={txt.tag_dropout_probability}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    txt.tag_dropout_probability = parseFloat(val) || 0;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="aug-special-tags-mode"
              label="Special Dropout Tags Mode"
              tooltip="Whitelist/blacklist mode for tag dropout"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Select
                  {id}
                  value={txt.tag_dropout_special_tags_mode}
                  options={[
                    { value: 'NONE', label: 'None' },
                    { value: 'BLACKLIST', label: 'Blacklist' },
                    { value: 'WHITELIST', label: 'Whitelist' },
                  ]}
                  {ariaDescribedBy}
                  onChange={(v) => {
                    txt.tag_dropout_special_tags_mode = v;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="aug-special-tags"
              label="Special Dropout Tags List"
              tooltip="List of tags for whitelist/blacklist or filepath to .txt/.csv file"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <DirectoryInput
                  {id}
                  value={txt.tag_dropout_special_tags || ''}
                  {ariaDescribedBy}
                  buttonLabel="Browse"
                  onInput={(val) => {
                    txt.tag_dropout_special_tags = val;
                  }}
                  onOpenDirectory={(curr) => handleBrowsePath('file', 'special_tags', curr)}
                  placeholder="tag1, tag2 or /path/to/tags.txt"
                />
              {/snippet}
            </Field>

            <Field
              id="aug-special-tags-regex"
              label="Special Tags Regex"
              tooltip="Interpret special tags with regular expressions"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={txt.tag_dropout_special_tags_regex}
                  {ariaDescribedBy}
                  onChange={(val) => {
                    txt.tag_dropout_special_tags_regex = val;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="aug-caps-randomize"
              label="Randomize Capitalization"
              tooltip="Enables randomization of capitalization for tags in caption"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={txt.caps_randomize_enable}
                  {ariaDescribedBy}
                  onChange={(val) => {
                    txt.caps_randomize_enable = val;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="aug-caps-lowercase"
              label="Force Lowercase"
              tooltip="Converts caption to lowercase before processing"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={txt.caps_randomize_lowercase}
                  {ariaDescribedBy}
                  onChange={(val) => {
                    txt.caps_randomize_lowercase = val;
                  }}
                />
              {/snippet}
            </Field>

            <Field
              id="aug-caps-mode"
              label="Capitalization Mode"
              tooltip="Comma-separated capitalization modes: capslock, title, first, random"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <TextInput
                  {id}
                  value={txt.caps_randomize_mode || ''}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    txt.caps_randomize_mode = val;
                  }}
                  placeholder="capslock, title, first, random"
                />
              {/snippet}
            </Field>

            <Field
              id="aug-caps-prob"
              label="Probability"
              tooltip="Probability to randomize capitalization (0 to 1)"
            >
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={txt.caps_randomize_probability}
                  {ariaDescribedBy}
                  onInput={(val) => {
                    txt.caps_randomize_probability = parseFloat(val) || 0;
                  }}
                />
              {/snippet}
            </Field>
          </div>
        {:else if activeTab === 'stats'}
          <div class="stats-tab-wrapper">
            <!-- Action Toolbar -->
            <div class="stats-toolbar">
              <button
                type="button"
                class="btn-stats-action"
                disabled={statsLoading}
                onclick={() => fetchStats(false)}
              >
                <RefreshCw size={14} class={statsLoading ? 'spin' : ''} />
                <span>Refresh Basic</span>
              </button>
              <button
                type="button"
                class="btn-stats-action btn-accent"
                disabled={statsLoading}
                onclick={() => fetchStats(true)}
              >
                <RefreshCw size={14} class={statsLoading ? 'spin' : ''} />
                <span>Refresh Advanced</span>
              </button>
              {#if statsData?.processing_time}
                <span class="proc-time-badge">{statsData.processing_time.toFixed(2)} s</span>
              {/if}
            </div>

            <!-- Stats Summary Cards Grid -->
            {#if statsData}
              <div class="stats-summary-grid">
                <div class="stat-card">
                  <span class="stat-label">Total Size</span>
                  <span class="stat-value">{formatBytes(statsData.file_size)}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Directories</span>
                  <span class="stat-value">{statsData.directory_count ?? 0}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Total Images</span>
                  <span class="stat-value">{statsData.image_count ?? 0}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Images with Masks</span>
                  <span class="stat-value">{statsData.image_with_mask_count ?? '-'}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Images with Captions</span>
                  <span class="stat-value">{statsData.image_with_caption_count ?? '-'}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Total Videos</span>
                  <span class="stat-value">{statsData.video_count ?? 0}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Videos with Captions</span>
                  <span class="stat-value">{statsData.video_with_caption_count ?? '-'}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Total Masks</span>
                  <span class="stat-value">{statsData.mask_count ?? 0}</span>
                </div>
                <div class="stat-card" class:highlight-warning={statsData.unpaired_masks > 0}>
                  <span class="stat-label">Unpaired Masks</span>
                  <span class="stat-value">{statsData.unpaired_masks ?? '-'}</span>
                </div>
                <div class="stat-card">
                  <span class="stat-label">Total Captions</span>
                  <span class="stat-value">
                    {statsData.subcaption_count > 0
                      ? `${statsData.caption_count} (${statsData.subcaption_count})`
                      : statsData.caption_count ?? 0}
                  </span>
                </div>
                <div class="stat-card" class:highlight-warning={statsData.unpaired_captions > 0}>
                  <span class="stat-label">Unpaired Captions</span>
                  <span class="stat-value">{statsData.unpaired_captions ?? '-'}</span>
                </div>
              </div>

              <!-- Pairing Warning Alerts -->
              {#if statsData.unpaired_masks > 0 || statsData.unpaired_captions > 0}
                <div class="pairing-alert-box">
                  <AlertTriangle size={18} />
                  <div class="alert-content">
                    {#if statsData.unpaired_masks > 0}
                      <span>Warning: {statsData.unpaired_masks} unpaired mask(s) found!</span>
                    {/if}
                    {#if statsData.unpaired_captions > 0}
                      <span>Warning: {statsData.unpaired_captions} unpaired caption file(s) found!</span>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Detailed Stats Tables -->
              <div class="stats-sections-grid">
                <!-- Resolution Info -->
                <div class="stats-section-box">
                  <h5>Resolution Metrics</h5>
                  <div class="stats-kv-stack">
                    <div class="kv-item">
                      <span class="kv-key">Max Pixels</span>
                      <span class="kv-val">{formatPixelText(statsData.max_pixels, statsData.image_count)}</span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Avg Pixels</span>
                      <span class="kv-val">{statsData.image_count > 0 && statsData.avg_pixels && statsData.avg_pixels > 0 ? `${(statsData.avg_pixels / 1000000).toFixed(2)} MP, ~${Math.round(Math.sqrt(statsData.avg_pixels))}w x ${Math.round(Math.sqrt(statsData.avg_pixels))}h` : '-'}</span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Min Pixels</span>
                      <span class="kv-val">{formatPixelText(statsData.min_pixels, statsData.image_count)}</span>
                    </div>
                  </div>
                </div>

                <!-- Video Length Metrics -->
                <div class="stats-section-box">
                  <h5>Video Length Metrics</h5>
                  <div class="stats-kv-stack">
                    <div class="kv-item">
                      <span class="kv-key">Max Length</span>
                      <span class="kv-val">{formatLengthText(statsData.max_length, statsData.video_count)}</span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Avg Length</span>
                      <span class="kv-val">{statsData.video_count > 0 && statsData.avg_length && statsData.avg_length > 0 ? `${Math.round(statsData.avg_length)} frames` : '-'}</span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Min Length</span>
                      <span class="kv-val">{formatLengthText(statsData.min_length, statsData.video_count)}</span>
                    </div>
                  </div>
                </div>

                <!-- Video FPS Metrics -->
                <div class="stats-section-box">
                  <h5>Video FPS Metrics</h5>
                  <div class="stats-kv-stack">
                    <div class="kv-item">
                      <span class="kv-key">Max FPS</span>
                      <span class="kv-val">{formatFpsText(statsData.max_fps, statsData.video_count)}</span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Avg FPS</span>
                      <span class="kv-val">{statsData.video_count > 0 && statsData.avg_fps && statsData.avg_fps > 0 ? `${Math.round(statsData.avg_fps)} fps` : '-'}</span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Min FPS</span>
                      <span class="kv-val">{formatFpsText(statsData.min_fps, statsData.video_count)}</span>
                    </div>
                  </div>
                </div>

                <!-- Caption Metrics -->
                <div class="stats-section-box">
                  <h5>Caption Metrics</h5>
                  <div class="stats-kv-stack">
                    <div class="kv-item">
                      <span class="kv-key">Max Caption Length</span>
                      <span class="kv-val">{formatCaptionText(statsData.max_caption_length, statsData.caption_count)}</span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Avg Caption Length</span>
                      <span class="kv-val">
                        {statsData.caption_count > 0 && statsData.avg_caption_length && Array.isArray(statsData.avg_caption_length)
                          ? `${Math.round(statsData.avg_caption_length[0] || 0)} chars, ${Math.round(statsData.avg_caption_length[1] || 0)} words`
                          : '-'}
                      </span>
                    </div>
                    <div class="kv-item">
                      <span class="kv-key">Min Caption Length</span>
                      <span class="kv-val">{formatCaptionText(statsData.min_caption_length, statsData.caption_count)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Aspect Bucketing & Histogram -->
              {#if statsData.aspect_buckets && Object.keys(statsData.aspect_buckets).length > 0}
                {@const buckets = Object.entries(statsData.aspect_buckets).map(([k, v]) => ({
                  aspect: parseFloat(k),
                  ratioStr: decimalToAspectRatio(parseFloat(k)),
                  count: Number(v) || 0,
                }))}
                {@const maxCount = Math.max(1, ...buckets.map((b) => b.count))}
                <div class="aspect-histogram-box">
                  <div class="aspect-header-row">
                    <h5>Aspect Bucketing</h5>
                    <div class="small-buckets-preview">
                      <span class="lbl">Smallest Buckets:</span>
                      <span class="val">{getSmallestBuckets(statsData.aspect_buckets)}</span>
                    </div>
                  </div>

                  <div class="histogram-chart-container">
                    <div class="histogram-bars-wrapper">
                      {#each buckets as b}
                        {@const pct = (b.count / maxCount) * 100}
                        <div class="bar-col">
                          <span class="bar-count-val">{b.count > 0 ? b.count : ''}</span>
                          <div class="bar-track">
                            <div class="bar-fill" style="height: {pct}%"></div>
                          </div>
                          <span class="bar-ratio-lbl">{b.ratioStr}</span>
                        </div>
                      {/each}
                    </div>

                    <div class="histogram-axis-markers">
                      <span class="axis-lbl">Wide</span>
                      <span class="axis-lbl">Square</span>
                      <span class="axis-lbl">Tall</span>
                    </div>
                  </div>
                </div>
              {/if}
            {:else}
              <div class="stats-placeholder-box">
                <RefreshCw size={24} class={statsLoading ? 'spin muted-icon' : 'muted-icon'} />
                {#if !draft?.path}
                  <span>Specify a valid concept dataset path in General tab to scan statistics.</span>
                {:else if statsLoading}
                  <span>Scanning concept statistics...</span>
                {:else}
                  <span>Click "Refresh Basic" or "Refresh Advanced" to scan concept statistics.</span>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </ModalDialog>

  <!-- Layered Image Augmentations Preview Modal -->
  {#if showAugPreviewModal}
    <ModalDialog
      open={showAugPreviewModal}
      title="Image Augmentations Live Test - Sample #{previewIndex + 1}"
      applyText="Close Preview"
      width="medium"
      onApply={() => (showAugPreviewModal = false)}
      onClose={() => (showAugPreviewModal = false)}
    >
      <div class="aug-preview-modal-body">
        <div class="preview-toolbar">
          <label class="preview-toggle-lbl">
            <input
              type="checkbox"
              bind:checked={previewAugmentations}
              onchange={fetchAugPreview}
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
              <button
                type="button"
                class="nav-arrow-btn"
                disabled={previewIndex <= 0 || previewLoading}
                onclick={handlePrevPreview}
              >
                <ChevronLeft size={16} />
              </button>
              <span class="nav-idx-lbl">Sample #{previewIndex + 1}</span>
              <button
                type="button"
                class="nav-arrow-btn"
                disabled={previewLoading}
                onclick={handleNextPreview}
              >
                <ChevronRight size={16} />
              </button>
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
    </ModalDialog>
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
  }

  .concept-modal-body :global(.text-input),
  .concept-modal-body :global(.number-input),
  .concept-modal-body :global(.select-input),
  .concept-modal-body :global(.directory-input-wrapper) {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box;
  }

  .subnav-tabs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border-bottom: 1px solid var(--color-border, var(--line, #2d3741));
    background-color: var(--color-bg-panel, var(--control, #14191f));
    padding: 0.25rem 0.5rem 0;
    border-radius: 6px 6px 0 0;
  }

  .subnav-btn {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted, #94a3b8);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .subnav-btn:hover:not(.active) {
    color: var(--text, #f8fafc);
    background-color: var(--panel-raised, #1d242c);
  }

  .subnav-btn.active {
    color: var(--color-text-title, var(--accent, #3b82f6));
    background-color: var(--color-bg-card, var(--panel, #181e25));
    border-color: var(--color-border, var(--line, #2d3741));
    border-bottom-color: var(--color-bg-card, var(--panel, #181e25));
  }

  .tab-content {
    height: 640px;
    min-height: 640px;
    max-height: 640px;
    overflow-y: auto;
    padding: 0.5rem 0.25rem;
    box-sizing: border-box;
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
  }

  .path-field-stack {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .path-action-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    width: 100%;
  }

  .subdir-toggle-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: auto;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, var(--text, #e6ebef));
    cursor: pointer;
  }

  .btn-path-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 38px;
    padding: 0 0.875rem;
    background: var(--color-bg-button, var(--control, #14191f));
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    color: var(--color-text, var(--text, #e6ebef));
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-path-action:hover {
    background: var(--color-bg-button-hover, var(--panel-raised, #1d242c));
    border-color: var(--color-primary, var(--accent, #3b82f6));
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .btn-path-action.btn-accent-action {
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .aug-tab-container {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .aug-bottom-action-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: 0.25rem;
  }

  .btn-aug-preview-compact {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.75rem;
    background: var(--accent, #3b82f6);
    border: 1px solid var(--accent, #3b82f6);
    border-radius: 5px;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-aug-preview-compact:hover {
    opacity: 0.9;
  }

  /* Tag Options Inline Row */
  .tag-options-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .inline-toggle-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text, #e6ebef);
    cursor: pointer;
  }

  /* 2-Column Augmentations Matrix Table */
  .aug-matrix-wrapper {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    overflow: hidden;
    background: var(--panel, #181e25);
  }

  .aug-matrix-header {
    display: grid;
    grid-template-columns: 1.8fr 0.8fr 0.8fr 1.6fr;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: var(--panel-raised, #1d242c);
    border-bottom: 1px solid var(--line, #2d3741);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted, #94a3b8);
  }

  .aug-matrix-header .col-sw {
    text-align: center;
  }

  .aug-matrix-row {
    display: grid;
    grid-template-columns: 1.8fr 0.8fr 0.8fr 1.6fr;
    gap: 0.5rem;
    align-items: center;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--line, #2d3741);
  }

  .aug-matrix-row:last-child {
    border-bottom: none;
  }

  .aug-matrix-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .col-lbl {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text, #e6ebef);
  }

  .col-sw {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted, #94a3b8);
  }

  .col-val {
    display: flex;
    align-items: center;
  }

  /* Stats Tab Dashboard */
  .stats-tab-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .stats-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-stats-action {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.875rem;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #e6ebef);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-stats-action.btn-accent {
    color: var(--accent, #3b82f6);
    border-color: var(--accent, #3b82f6);
  }

  .proc-time-badge {
    margin-left: auto;
    font-size: 0.75rem;
    font-family: monospace;
    color: var(--muted, #94a3b8);
  }

  .stats-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 0.75rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
  }

  .stat-card.highlight-warning {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
  }

  .stat-card.highlight-warning .stat-value {
    color: #fca5a5;
  }

  /* Aspect Histogram Styles */
  .aspect-histogram-box {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
  }

  .aspect-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .aspect-header-row h5 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .small-buckets-preview {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
  }

  .small-buckets-preview .lbl {
    color: var(--muted, #94a3b8);
    font-weight: 500;
  }

  .small-buckets-preview .val {
    color: var(--accent, #3b82f6);
    font-family: monospace;
    font-weight: 600;
  }

  .histogram-chart-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
  }

  .histogram-bars-wrapper {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 120px;
    gap: 0.25rem;
    padding-top: 1.25rem;
  }

  .bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
  }

  .bar-count-val {
    font-size: 0.6875rem;
    font-family: monospace;
    color: var(--accent, #3b82f6);
    font-weight: 600;
    min-height: 14px;
  }

  .bar-track {
    display: flex;
    align-items: flex-end;
    width: 100%;
    max-width: 24px;
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 3px 3px 0 0;
    overflow: hidden;
  }

  .bar-fill {
    width: 100%;
    background: var(--accent, #3b82f6);
    border-radius: 3px 3px 0 0;
    transition: height 0.3s ease;
  }

  .bar-ratio-lbl {
    font-size: 0.6875rem;
    color: var(--muted, #94a3b8);
    margin-top: 0.25rem;
  }

  .histogram-axis-markers {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.5rem 0;
    border-top: 1px solid var(--line, #2d3741);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--muted, #94a3b8);
  }

  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .pairing-alert-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #fca5a5;
    font-size: 0.8125rem;
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stats-sections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .stats-section-box {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
  }

  .stats-section-box h5 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .stats-kv-stack {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .kv-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8125rem;
  }

  .kv-key {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted, #94a3b8);
  }

  .kv-val {
    font-size: 0.8125rem;
    color: var(--text, #e6ebef);
    white-space: pre-wrap;
    font-family: monospace;
  }

  .stats-placeholder-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    background: var(--panel-raised, #1d242c);
    border: 1px dashed var(--line, #2d3741);
    border-radius: 8px;
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
  }

  /* Image Augmentation Preview Layered Modal */
  .aug-preview-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .preview-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .preview-toggle-lbl {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text, #e6ebef);
    cursor: pointer;
  }

  .preview-display-box {
    display: flex;
    gap: 1rem;
  }

  @media (max-width: 600px) {
    .preview-display-box {
      flex-direction: column;
    }
  }

  .preview-img-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 220px;
    flex-shrink: 0;
  }

  .preview-img {
    width: 220px;
    height: 220px;
    object-fit: contain;
    border-radius: 6px;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
  }

  .preview-loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8125rem;
    color: var(--accent, #3b82f6);
    border-radius: 6px;
  }

  .nav-controls-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nav-arrow-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 4px;
    color: var(--text, #e6ebef);
    cursor: pointer;
  }

  .nav-arrow-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nav-idx-lbl {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted, #94a3b8);
  }

  .preview-meta-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .meta-col {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .meta-lbl {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted, #94a3b8);
  }

  .meta-val {
    font-size: 0.8125rem;
    color: var(--text, #e6ebef);
    font-family: monospace;
  }

  .prompt-output-box {
    padding: 0.75rem;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: monospace;
    color: var(--text, #e6ebef);
    min-height: 120px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
