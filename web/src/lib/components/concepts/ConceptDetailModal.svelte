<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import Field from '$lib/components/form/Field.svelte';
  import TextInput from '$lib/components/form/TextInput.svelte';
  import NumberInput from '$lib/components/form/NumberInput.svelte';
  import Toggle from '$lib/components/form/Toggle.svelte';
  import DirectoryInput from '$lib/components/form/DirectoryInput.svelte';
  import Select from '$lib/components/form/Select.svelte';
  import DatasetPickerModal from '$lib/components/datasets/DatasetPickerModal.svelte';
  import { FolderKanban } from 'lucide-svelte';

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

  $effect(() => {
    if (concept && isOpen) {
      // Create deep clone for local editing
      const cloned = JSON.parse(JSON.stringify(concept));
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
    }
  });

  function handleSave() {
    if (draft) {
      onSave(draft);
    }
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
      <!-- Connected Text-Only Subnav Tabs -->
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
          Dataset Stats & Gallery
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
                  onInput={(val) => { d.name = val; }}
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
                  onChange={(val) => { d.enabled = val; }}
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
                    { value: 'PRIOR_PREDICTION', label: 'PRIOR_PREDICTION (Prior preservation regularization)' },
                  ]}
                  {ariaDescribedBy}
                  onChange={(v) => { d.type = v; }}
                />
              {/snippet}
            </Field>

            <Field id="concept-path" label="Path" tooltip="Path where the training data is located">
              {#snippet children({ id, ariaDescribedBy })}
                <div class="directory-picker-row">
                  <DirectoryInput
                    {id}
                    value={d.path || ''}
                    {ariaDescribedBy}
                    onInput={(val) => { d.path = val; }}
                    onOpenDirectory={openDirectory ? (path, cb) => openDirectory('dir', path).then((s: string | null) => s && (cb ? cb(s) : (d.path = s))) : undefined}
                    placeholder="/path/to/dataset/images"
                  />
                  <button
                    type="button"
                    class="btn-select-dataset"
                    onclick={() => (showDatasetPicker = true)}
                  >
                    <FolderKanban size={15} />
                    <span>Select Dataset</span>
                  </button>
                </div>
              {/snippet}
            </Field>

            <Field id="concept-subdirs" label="Include Subdirectories" tooltip="Includes images from subdirectories into the dataset">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={d.include_subdirectories}
                  {ariaDescribedBy}
                  onChange={(val) => { d.include_subdirectories = val; }}
                />
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
                  onChange={(v) => { d.text.prompt_source = v; }}
                />
              {/snippet}
            </Field>

            {#if d.text.prompt_source === 'concept'}
              <Field id="concept-prompt-path" label="Prompt Path" tooltip="Path to single text file containing training prompts">
                {#snippet children({ id, ariaDescribedBy })}
                  <DirectoryInput
                    {id}
                    value={d.text.prompt_path || ''}
                    {ariaDescribedBy}
                    onInput={(val) => { d.text.prompt_path = val; }}
                    onOpenDirectory={openDirectory ? (path, cb) => openDirectory('file', path).then((s: string | null) => s && (cb ? cb(s) : (d.text.prompt_path = s))) : undefined}
                    placeholder="/path/to/prompts.txt"
                  />
                {/snippet}
              </Field>
            {/if}

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
                  onChange={(v) => { d.balancing_strategy = v; }}
                />
              {/snippet}
            </Field>

            <Field id="concept-balancing" label="Balancing Value" tooltip="The number of samples/repeats used during training">
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={d.balancing}
                  {ariaDescribedBy}
                  onInput={(val) => { d.balancing = parseFloat(val) || 0; }}
                />
              {/snippet}
            </Field>

            <Field id="concept-loss-weight" label="Loss Weight" tooltip="The loss multiplier for this concept">
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={d.loss_weight}
                  {ariaDescribedBy}
                  onInput={(val) => { d.loss_weight = parseFloat(val) || 0; }}
                />
              {/snippet}
            </Field>
          </div>
        {:else if activeTab === 'image' && draft && draft.image}
          {@const img = draft.image}
          <div class="form-stack">
            <Field id="aug-crop-jitter" label="Crop Jitter" tooltip="Enables random cropping of samples">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_crop_jitter}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_crop_jitter = val; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-rand-flip" label="Random Flip" tooltip="Randomly flip the sample during training">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_random_flip}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_random_flip = val; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-fix-flip" label="Fixed Flip" tooltip="Fixed flip during training">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_fixed_flip}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_fixed_flip = val; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-rand-rot" label="Random Rotation" tooltip="Randomly rotates the sample during training">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_random_rotate}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_random_rotate = val; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-rot-angle" label="Max Rotation Angle (°)" tooltip="Maximum angle for random rotation">
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={img.random_rotate_max_angle}
                  {ariaDescribedBy}
                  onInput={(val) => { img.random_rotate_max_angle = parseFloat(val) || 0; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-rand-bright" label="Random Brightness" tooltip="Randomly adjusts brightness during training">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_random_brightness}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_random_brightness = val; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-bright-strength" label="Max Brightness Strength" tooltip="Maximum brightness strength adjustment">
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={img.random_brightness_max_strength}
                  {ariaDescribedBy}
                  onInput={(val) => { img.random_brightness_max_strength = parseFloat(val) || 0; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-rand-contrast" label="Random Contrast" tooltip="Randomly adjusts contrast during training">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_random_contrast}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_random_contrast = val; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-contrast-strength" label="Max Contrast Strength" tooltip="Maximum contrast strength adjustment">
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={img.random_contrast_max_strength}
                  {ariaDescribedBy}
                  onInput={(val) => { img.random_contrast_max_strength = parseFloat(val) || 0; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-rand-res-override" label="Resolution Override" tooltip="Override resolution for this concept">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_resolution_override}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_resolution_override = val; }}
                />
              {/snippet}
            </Field>

            {#if img.enable_resolution_override}
              <Field id="aug-res-val" label="Target Resolution" tooltip="Target resolution in format <width>x<height> or 512">
                {#snippet children({ id, ariaDescribedBy })}
                  <TextInput
                    {id}
                    value={img.resolution_override || ''}
                    {ariaDescribedBy}
                    onInput={(val) => { img.resolution_override = val; }}
                  />
                {/snippet}
              </Field>
            {/if}
          </div>
        {:else if activeTab === 'text' && draft && draft.text}
          {@const txt = draft.text}
          <div class="form-stack">
            <Field id="aug-tag-shuffle" label="Tag Shuffling" tooltip="Enables tag shuffling">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={txt.enable_tag_shuffling}
                  {ariaDescribedBy}
                  onChange={(val) => { txt.enable_tag_shuffling = val; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-tag-delim" label="Tag Delimiter" tooltip="The delimiter between tags">
              {#snippet children({ id, ariaDescribedBy })}
                <TextInput
                  {id}
                  value={txt.tag_delimiter || ','}
                  {ariaDescribedBy}
                  onInput={(val) => { txt.tag_delimiter = val; }}
                  placeholder=","
                />
              {/snippet}
            </Field>

            <Field id="aug-keep-tags" label="Keep Tag Count" tooltip="Number of tags at start of caption that are not shuffled or dropped">
              {#snippet children({ id, ariaDescribedBy })}
                <NumberInput
                  {id}
                  value={txt.keep_tags_count}
                  {ariaDescribedBy}
                  onInput={(val) => { txt.keep_tags_count = parseInt(val, 10) || 0; }}
                />
              {/snippet}
            </Field>

            <Field id="aug-dropout-enable" label="Tag Dropout" tooltip="Enables random dropout for tags in captions">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={txt.tag_dropout_enable}
                  {ariaDescribedBy}
                  onChange={(val) => { txt.tag_dropout_enable = val; }}
                />
              {/snippet}
            </Field>

            {#if txt.tag_dropout_enable}
              <Field id="aug-dropout-mode" label="Dropout Mode" tooltip="FULL: drop entire caption past kept tags; RANDOM: drop individual tags; RANDOM WEIGHTED: linearly increase drop probability">
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
                    onChange={(v) => { txt.tag_dropout_mode = v; }}
                  />
                {/snippet}
              </Field>

              <Field id="aug-dropout-prob" label="Probability" tooltip="Probability to drop tags (0 to 1)">
                {#snippet children({ id, ariaDescribedBy })}
                  <NumberInput
                    {id}
                    value={txt.tag_dropout_probability}
                    {ariaDescribedBy}
                    onInput={(val) => { txt.tag_dropout_probability = parseFloat(val) || 0; }}
                  />
                {/snippet}
              </Field>

              <Field id="aug-special-tags-mode" label="Special Dropout Tags" tooltip="Whitelist/blacklist mode for tag dropout">
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
                    onChange={(v) => { txt.tag_dropout_special_tags_mode = v; }}
                  />
                {/snippet}
              </Field>

              <Field id="aug-special-tags" label="Special Tags List" tooltip="List of tags for whitelist/blacklist">
                {#snippet children({ id, ariaDescribedBy })}
                  <TextInput
                    {id}
                    value={txt.tag_dropout_special_tags || ''}
                    {ariaDescribedBy}
                    onInput={(val) => { txt.tag_dropout_special_tags = val; }}
                  />
                {/snippet}
              </Field>

              <Field id="aug-special-tags-regex" label="Special Tags Regex" tooltip="Interpret special tags with regular expressions">
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={txt.tag_dropout_special_tags_regex}
                    {ariaDescribedBy}
                    onChange={(val) => { txt.tag_dropout_special_tags_regex = val; }}
                  />
                {/snippet}
              </Field>
            {/if}

            <Field id="aug-caps-randomize" label="Randomize Capitalization" tooltip="Enables randomization of capitalization for tags in caption">
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={txt.caps_randomize_enable}
                  {ariaDescribedBy}
                  onChange={(val) => { txt.caps_randomize_enable = val; }}
                />
              {/snippet}
            </Field>
          </div>
        {:else if activeTab === 'stats'}
          <div class="stats-preview-container">
            <div class="preview-hero">
              <img
                src="/api/concepts/preview-image?path={encodeURIComponent(draft.path || '')}&include_subdirectories={draft.include_subdirectories}"
                alt="Concept Preview"
                class="hero-thumbnail"
              />
              <div class="hero-info">
                <h4>{draft.name || draft.path || 'Untitled Concept'}</h4>
                <span class="path-sub">{draft.path || 'No directory path configured'}</span>
                <span class="badge type-badge">{draft.type || 'STANDARD'}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </ModalDialog>

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
    margin-bottom: 0.25rem;
  }

  .subnav-btn {
    padding: 0.5rem 0.875rem;
    border: 1px solid transparent;
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    background: transparent;
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: -1px;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .subnav-btn:hover {
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
    min-height: 440px;
    max-height: 480px;
    overflow-y: auto;
    padding: 0.5rem 0.25rem;
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
  }

  .directory-picker-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .directory-picker-row :global(.directory-input-wrapper) {
    flex: 1;
  }

  .btn-select-dataset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 38px;
    padding: 0 0.875rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--color-text-title, var(--accent, #3b82f6));
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .btn-select-dataset:hover {
    background: var(--line, #2d3741);
    color: var(--text, #ffffff);
  }

  .stats-preview-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem 0;
  }

  .preview-hero {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
  }

  .hero-thumbnail {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 6px;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
  }

  .hero-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .hero-info h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .path-sub {
    font-size: 0.8125rem;
    color: var(--muted, #94a3b8);
    word-break: break-all;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    width: fit-content;
  }

  .type-badge {
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-text-title, var(--accent, #3b82f6));
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
</style>
