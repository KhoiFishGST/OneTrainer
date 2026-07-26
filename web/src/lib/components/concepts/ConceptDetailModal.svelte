<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import Select from '$lib/components/form/Select.svelte';
  import DatasetPickerModal from '$lib/components/datasets/DatasetPickerModal.svelte';
  import { Settings, Image as ImageIcon, FileText, BarChart2, Check, X, FolderKanban } from 'lucide-svelte';

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

  async function handleBrowsePath() {
    if (!openDirectory || !draft) return;
    const selected = await openDirectory('dir', draft.path || '');
    if (selected) draft.path = selected;
  }

  async function handleBrowsePromptPath() {
    if (!openDirectory || !draft || !draft.text) return;
    const selected = await openDirectory('file', draft.text.prompt_path || '');
    if (selected) draft.text.prompt_path = selected;
  }
</script>

{#if isOpen && draft}
  <ModalDialog open={isOpen} title="Concept Configuration - {draft.name || draft.path || 'New Concept'}" {onClose}>
    <div class="concept-modal-body">
      <!-- Tabs Header -->
      <div class="modal-nav-tabs">
        <button
          type="button"
          class="nav-tab"
          class:active={activeTab === 'general'}
          onclick={() => (activeTab = 'general')}
        >
          <Settings size={16} />
          <span>General</span>
        </button>
        <button
          type="button"
          class="nav-tab"
          class:active={activeTab === 'image'}
          onclick={() => (activeTab = 'image')}
        >
          <ImageIcon size={16} />
          <span>Image Augmentations</span>
        </button>
        <button
          type="button"
          class="nav-tab"
          class:active={activeTab === 'text'}
          onclick={() => (activeTab = 'text')}
        >
          <FileText size={16} />
          <span>Text Augmentations</span>
        </button>
        <button
          type="button"
          class="nav-tab"
          class:active={activeTab === 'stats'}
          onclick={() => (activeTab = 'stats')}
        >
          <BarChart2 size={16} />
          <span>Dataset Stats & Gallery</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="tab-content">
        {#if activeTab === 'general'}
          <div class="form-grid">
            <div class="form-row">
              <label for="concept-name">Concept Name</label>
              <input id="concept-name" type="text" bind:value={draft.name} placeholder="e.g. MyCharacter" />
            </div>

            <div class="form-row inline">
              <label for="concept-enabled">Enabled</label>
              <input id="concept-enabled" type="checkbox" bind:checked={draft.enabled} />
            </div>

            <div class="form-row">
              <label for="concept-type">Concept Type</label>
              <Select
                id="concept-type"
                value={draft.type}
                options={[
                  { value: 'STANDARD', label: 'STANDARD (Finetune training target)' },
                  { value: 'VALIDATION', label: 'VALIDATION (Validation dataset)' },
                  { value: 'PRIOR_PREDICTION', label: 'PRIOR_PREDICTION (Prior preservation regularization)' },
                ]}
                onChange={(v) => { if (draft) draft.type = v; }}
              />
            </div>

            <div class="form-row">
              <label for="concept-path">Dataset Directory Path</label>
              <div class="path-input-group">
                <input id="concept-path" type="text" bind:value={draft.path} placeholder="/path/to/dataset/images" />
                <button
                  type="button"
                  class="btn-select-dataset"
                  onclick={() => (showDatasetPicker = true)}
                >
                  <FolderKanban size={14} />
                  <span>Select Dataset</span>
                </button>
                {#if openDirectory}
                  <button type="button" class="btn-browse" onclick={handleBrowsePath}>Browse</button>
                {/if}
              </div>
            </div>

            <div class="form-row inline">
              <label for="concept-subdirs">Include Subdirectories</label>
              <input id="concept-subdirs" type="checkbox" bind:checked={draft.include_subdirectories} />
            </div>

            <div class="form-row">
              <label for="concept-prompt-source">Prompt Source</label>
              <Select
                id="concept-prompt-source"
                value={draft.text.prompt_source}
                options={[
                  { value: 'sample', label: 'From text file per sample (.txt / .caption)' },
                  { value: 'concept', label: 'From single text file' },
                  { value: 'filename', label: 'From image file name' },
                ]}
                onChange={(v) => { if (draft) draft.text.prompt_source = v; }}
              />
            </div>

            {#if draft.text.prompt_source === 'concept'}
              <div class="form-row">
                <label for="concept-prompt-path">Single Prompt File Path</label>
                <div class="path-input-group">
                  <input id="concept-prompt-path" type="text" bind:value={draft.text.prompt_path} placeholder="/path/to/prompts.txt" />
                  {#if openDirectory}
                    <button type="button" class="btn-browse" onclick={handleBrowsePromptPath}>Browse</button>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="form-row-group">
              <div class="form-row">
                <label for="concept-balancing">Balancing Value</label>
                <input id="concept-balancing" type="number" step="0.1" bind:value={draft.balancing} />
              </div>
              <div class="form-row">
                <label for="concept-balancing-strategy">Balancing Strategy</label>
                <Select
                  id="concept-balancing-strategy"
                  value={draft.balancing_strategy}
                  options={[
                    { value: 'REPEATS', label: 'REPEATS (Multiply dataset epoch count)' },
                    { value: 'SAMPLES', label: 'SAMPLES (Exact sample target count)' },
                  ]}
                  onChange={(v) => { if (draft) draft.balancing_strategy = v; }}
                />
              </div>
            </div>

            <div class="form-row">
              <label for="concept-loss-weight">Loss Weight</label>
              <input id="concept-loss-weight" type="number" step="0.05" bind:value={draft.loss_weight} />
            </div>
          </div>
        {:else if activeTab === 'image'}
          <div class="form-grid">
            <div class="form-row inline">
              <label for="aug-crop-jitter">Crop Jitter</label>
              <input id="aug-crop-jitter" type="checkbox" bind:checked={draft.image.enable_crop_jitter} />
            </div>

            <div class="form-row-group">
              <div class="form-row inline">
                <label for="aug-rand-flip">Random Flip</label>
                <input id="aug-rand-flip" type="checkbox" bind:checked={draft.image.enable_random_flip} />
              </div>
              <div class="form-row inline">
                <label for="aug-fix-flip">Fixed Flip</label>
                <input id="aug-fix-flip" type="checkbox" bind:checked={draft.image.enable_fixed_flip} />
              </div>
            </div>

            <div class="form-row-group">
              <div class="form-row inline">
                <label for="aug-rand-rot">Random Rotate</label>
                <input id="aug-rand-rot" type="checkbox" bind:checked={draft.image.enable_random_rotate} />
              </div>
              <div class="form-row">
                <label for="aug-rot-angle">Max Rotate Angle (°)</label>
                <input id="aug-rot-angle" type="number" step="1" bind:value={draft.image.random_rotate_max_angle} />
              </div>
            </div>

            <div class="form-row-group">
              <div class="form-row inline">
                <label for="aug-rand-bright">Random Brightness</label>
                <input id="aug-rand-bright" type="checkbox" bind:checked={draft.image.enable_random_brightness} />
              </div>
              <div class="form-row">
                <label for="aug-bright-strength">Max Brightness Strength</label>
                <input id="aug-bright-strength" type="number" step="0.05" bind:value={draft.image.random_brightness_max_strength} />
              </div>
            </div>

            <div class="form-row-group">
              <div class="form-row inline">
                <label for="aug-rand-contrast">Random Contrast</label>
                <input id="aug-rand-contrast" type="checkbox" bind:checked={draft.image.enable_random_contrast} />
              </div>
              <div class="form-row">
                <label for="aug-contrast-strength">Max Contrast Strength</label>
                <input id="aug-contrast-strength" type="number" step="0.05" bind:value={draft.image.random_contrast_max_strength} />
              </div>
            </div>

            <div class="form-row-group">
              <div class="form-row inline">
                <label for="aug-rand-res-override">Resolution Override</label>
                <input id="aug-rand-res-override" type="checkbox" bind:checked={draft.image.enable_resolution_override} />
              </div>
              <div class="form-row">
                <label for="aug-res-val">Target Resolution (e.g. 512, 1024x1024)</label>
                <input id="aug-res-val" type="text" bind:value={draft.image.resolution_override} />
              </div>
            </div>
          </div>
        {:else if activeTab === 'text'}
          <div class="form-grid">
            <div class="form-row inline">
              <label for="aug-tag-shuffle">Tag Shuffling</label>
              <input id="aug-tag-shuffle" type="checkbox" bind:checked={draft.text.enable_tag_shuffling} />
            </div>

            <div class="form-row-group">
              <div class="form-row">
                <label for="aug-tag-delim">Tag Delimiter</label>
                <input id="aug-tag-delim" type="text" bind:value={draft.text.tag_delimiter} placeholder="," />
              </div>
              <div class="form-row">
                <label for="aug-keep-tags">Keep Tags Count</label>
                <input id="aug-keep-tags" type="number" min="0" bind:value={draft.text.keep_tags_count} />
              </div>
            </div>

            <div class="form-row inline">
              <label for="aug-dropout-enable">Tag Dropout Enabled</label>
              <input id="aug-dropout-enable" type="checkbox" bind:checked={draft.text.tag_dropout_enable} />
            </div>

            {#if draft.text.tag_dropout_enable}
              <div class="form-row-group">
                <div class="form-row">
                  <label for="aug-dropout-mode">Dropout Mode</label>
                  <Select
                    id="aug-dropout-mode"
                    value={draft.text.tag_dropout_mode}
                    options={[
                      { value: 'FULL', label: 'FULL (Drop entire caption past kept tags)' },
                      { value: 'RANDOM', label: 'RANDOM (Drop individual tags with set probability)' },
                      { value: 'RANDOM WEIGHTED', label: 'RANDOM WEIGHTED (Linearly increase drop probability)' },
                    ]}
                    onChange={(v) => { if (draft) draft.text.tag_dropout_mode = v; }}
                  />
                </div>
                <div class="form-row">
                  <label for="aug-dropout-prob">Probability (0 to 1)</label>
                  <input id="aug-dropout-prob" type="number" step="0.05" min="0" max="1" bind:value={draft.text.tag_dropout_probability} />
                </div>
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

      <!-- Modal Actions -->
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick={onClose}>
          <X size={16} /> Cancel
        </button>
        <button type="button" class="btn btn-primary" onclick={handleSave}>
          <Check size={16} /> Save Concept Settings
        </button>
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

  .modal-nav-tabs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--line, #2d3741);
    padding-bottom: 0.5rem;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-tab:hover {
    color: var(--text, #f8fafc);
    background-color: var(--panel-raised, #1d242c);
  }

  .nav-tab.active {
    color: var(--color-text-title, var(--accent, #3b82f6));
    background-color: var(--panel-raised, #1d242c);
    font-weight: 600;
  }

  .tab-content {
    min-height: 380px;
    padding: 0.5rem 0;
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

  .form-row.inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .form-row label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text, #f8fafc);
  }

  .form-row input[type='text'],
  .form-row input[type='number'] {
    padding: 0.5rem 0.75rem;
    background-color: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
  }

  .path-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .path-input-group input {
    flex: 1;
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

  .btn-browse {
    padding: 0.5rem 0.75rem;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-browse:hover {
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

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line, #2d3741);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .btn-primary {
    background-color: var(--color-primary, var(--accent, #3b82f6));
    color: white;
  }

  .btn-secondary {
    background-color: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    color: var(--text, #f8fafc);
  }
</style>
