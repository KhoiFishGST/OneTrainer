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
      <!-- Tabs Header -->
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
          <div class="form-grid">
            <div class="form-row-group">
              <Field id="concept-name" label="Concept Name">
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
              <Field id="concept-enabled" label="Enabled" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={d.enabled}
                    {ariaDescribedBy}
                    onChange={(val) => { d.enabled = val; }}
                  />
                {/snippet}
              </Field>
            </div>

            <Field id="concept-type" label="Concept Type">
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

            <Field id="concept-path" label="Dataset Directory Path">
              {#snippet children({ id, ariaDescribedBy })}
                <DirectoryInput
                  {id}
                  value={d.path || ''}
                  {ariaDescribedBy}
                  onInput={(val) => { d.path = val; }}
                  onOpenDirectory={openDirectory ? (path, cb) => openDirectory('dir', path).then((s: string | null) => s && (cb ? cb(s) : (d.path = s))) : undefined}
                  placeholder="/path/to/dataset/images"
                />
              {/snippet}
            </Field>

            <div class="form-row-group align-center">
              <div class="form-row">
                <button
                  type="button"
                  class="btn-select-dataset"
                  onclick={() => (showDatasetPicker = true)}
                >
                  <FolderKanban size={14} />
                  <span>Select Dataset</span>
                </button>
              </div>
              <Field id="concept-subdirs" label="Include Subdirectories" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={d.include_subdirectories}
                    {ariaDescribedBy}
                    onChange={(val) => { d.include_subdirectories = val; }}
                  />
                {/snippet}
              </Field>
            </div>

            <div class="form-row-group">
              <Field id="concept-prompt-source" label="Prompt Source">
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
              <Field id="concept-balancing-strategy" label="Balancing Strategy">
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
            </div>

            {#if d.text.prompt_source === 'concept'}
              <Field id="concept-prompt-path" label="Single Prompt File Path">
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

            <div class="form-row-group">
              <Field id="concept-balancing" label="Balancing Value">
                {#snippet children({ id, ariaDescribedBy })}
                  <NumberInput
                    {id}
                    value={d.balancing}
                    {ariaDescribedBy}
                    onInput={(val) => { d.balancing = parseFloat(val) || 0; }}
                  />
                {/snippet}
              </Field>
              <Field id="concept-loss-weight" label="Loss Weight">
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
          </div>
        {:else if activeTab === 'image' && draft && draft.image}
          {@const img = draft.image}
          <div class="form-grid">
            <Field id="aug-crop-jitter" label="Crop Jitter" inline={true}>
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={img.enable_crop_jitter}
                  {ariaDescribedBy}
                  onChange={(val) => { img.enable_crop_jitter = val; }}
                />
              {/snippet}
            </Field>

            <div class="form-row-group">
              <Field id="aug-rand-flip" label="Random Flip" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={img.enable_random_flip}
                    {ariaDescribedBy}
                    onChange={(val) => { img.enable_random_flip = val; }}
                  />
                {/snippet}
              </Field>
              <Field id="aug-fix-flip" label="Fixed Flip" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={img.enable_fixed_flip}
                    {ariaDescribedBy}
                    onChange={(val) => { img.enable_fixed_flip = val; }}
                  />
                {/snippet}
              </Field>
            </div>

            <div class="form-row-group">
              <Field id="aug-rand-rot" label="Random Rotate" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={img.enable_random_rotate}
                    {ariaDescribedBy}
                    onChange={(val) => { img.enable_random_rotate = val; }}
                  />
                {/snippet}
              </Field>
              <Field id="aug-rot-angle" label="Max Rotate Angle (°)">
                {#snippet children({ id, ariaDescribedBy })}
                  <NumberInput
                    {id}
                    value={img.random_rotate_max_angle}
                    {ariaDescribedBy}
                    onInput={(val) => { img.random_rotate_max_angle = parseFloat(val) || 0; }}
                  />
                {/snippet}
              </Field>
            </div>

            <div class="form-row-group">
              <Field id="aug-rand-bright" label="Random Brightness" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={img.enable_random_brightness}
                    {ariaDescribedBy}
                    onChange={(val) => { img.enable_random_brightness = val; }}
                  />
                {/snippet}
              </Field>
              <Field id="aug-bright-strength" label="Max Brightness Strength">
                {#snippet children({ id, ariaDescribedBy })}
                  <NumberInput
                    {id}
                    value={img.random_brightness_max_strength}
                    {ariaDescribedBy}
                    onInput={(val) => { img.random_brightness_max_strength = parseFloat(val) || 0; }}
                  />
                {/snippet}
              </Field>
            </div>

            <div class="form-row-group">
              <Field id="aug-rand-contrast" label="Random Contrast" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={img.enable_random_contrast}
                    {ariaDescribedBy}
                    onChange={(val) => { img.enable_random_contrast = val; }}
                  />
                {/snippet}
              </Field>
              <Field id="aug-contrast-strength" label="Max Contrast Strength">
                {#snippet children({ id, ariaDescribedBy })}
                  <NumberInput
                    {id}
                    value={img.random_contrast_max_strength}
                    {ariaDescribedBy}
                    onInput={(val) => { img.random_contrast_max_strength = parseFloat(val) || 0; }}
                  />
                {/snippet}
              </Field>
            </div>

            <div class="form-row-group">
              <Field id="aug-rand-res-override" label="Resolution Override" inline={true}>
                {#snippet children({ id, ariaDescribedBy })}
                  <Toggle
                    {id}
                    value={img.enable_resolution_override}
                    {ariaDescribedBy}
                    onChange={(val) => { img.enable_resolution_override = val; }}
                  />
                {/snippet}
              </Field>
              <Field id="aug-res-val" label="Target Resolution (e.g. 512, 1024x1024)">
                {#snippet children({ id, ariaDescribedBy })}
                  <TextInput
                    {id}
                    value={img.resolution_override || ''}
                    {ariaDescribedBy}
                    onInput={(val) => { img.resolution_override = val; }}
                  />
                {/snippet}
              </Field>
            </div>
          </div>
        {:else if activeTab === 'text' && draft && draft.text}
          {@const txt = draft.text}
          <div class="form-grid">
            <Field id="aug-tag-shuffle" label="Tag Shuffling" inline={true}>
              {#snippet children({ id, ariaDescribedBy })}
                <Toggle
                  {id}
                  value={txt.enable_tag_shuffling}
                  {ariaDescribedBy}
                  onChange={(val) => { txt.enable_tag_shuffling = val; }}
                />
              {/snippet}
            </Field>

            <div class="form-row-group">
              <Field id="aug-tag-delim" label="Tag Delimiter">
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
              <Field id="aug-keep-tags" label="Keep Tags Count">
                {#snippet children({ id, ariaDescribedBy })}
                  <NumberInput
                    {id}
                    value={txt.keep_tags_count}
                    {ariaDescribedBy}
                    onInput={(val) => { txt.keep_tags_count = parseInt(val, 10) || 0; }}
                  />
                {/snippet}
              </Field>
            </div>

            <Field id="aug-dropout-enable" label="Tag Dropout Enabled" inline={true}>
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
              <div class="form-row-group">
                <Field id="aug-dropout-mode" label="Dropout Mode">
                  {#snippet children({ id, ariaDescribedBy })}
                    <Select
                      {id}
                      value={txt.tag_dropout_mode}
                      options={[
                        { value: 'FULL', label: 'FULL (Drop entire caption past kept tags)' },
                        { value: 'RANDOM', label: 'RANDOM (Drop individual tags with set probability)' },
                        { value: 'RANDOM WEIGHTED', label: 'RANDOM WEIGHTED (Linearly increase drop probability)' },
                      ]}
                      {ariaDescribedBy}
                      onChange={(v) => { txt.tag_dropout_mode = v; }}
                    />
                  {/snippet}
                </Field>
                <Field id="aug-dropout-prob" label="Probability (0 to 1)">
                  {#snippet children({ id, ariaDescribedBy })}
                    <NumberInput
                      {id}
                      value={txt.tag_dropout_probability}
                      {ariaDescribedBy}
                      onInput={(val) => { txt.tag_dropout_probability = parseFloat(val) || 0; }}
                    />
                  {/snippet}
                </Field>
              </div>
            {/if}
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
    gap: 1.25rem;
  }

  .subnav-tabs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--color-border, var(--line, #2d3741));
    margin-bottom: 0.5rem;
  }

  .subnav-btn {
    padding: 0.5rem 1rem;
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
    background-color: var(--panel-raised, #1d242c);
    border-color: var(--color-border, var(--line, #2d3741));
    border-bottom-color: var(--panel-raised, #1d242c);
  }

  .tab-content {
    height: 480px;
    max-height: 480px;
    overflow-y: auto;
    padding: 0.5rem 0.25rem;
    box-sizing: border-box;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .btn-select-dataset {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--color-text-title, var(--accent, #3b82f6));
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-select-dataset:hover {
    background: var(--line, #2d3741);
  }

  .stats-preview-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .preview-hero {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    padding: 1.25rem;
    border-radius: 8px;
  }

  .hero-thumbnail {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--line, #2d3741);
    background-color: var(--control, #14191f);
  }

  .hero-info {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .hero-info h4 {
    margin: 0;
    font-size: 1.125rem;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .path-sub {
    font-size: 0.8125rem;
    color: var(--muted, #94a3b8);
    word-break: break-all;
  }

  .type-badge {
    align-self: flex-start;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-text-title, var(--accent, #3b82f6));
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
</style>
