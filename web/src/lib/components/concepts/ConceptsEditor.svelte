<script lang="ts">
  import Select from '../form/Select.svelte';
  import AddCard from '../ui/AddCard.svelte';
  import { Plus, Trash2, Edit2, Copy, Search, Layers, Folder, Eye, EyeOff } from 'lucide-svelte';
  import type { Concept } from '$lib/api/types';
  import ConceptDetailModal from './ConceptDetailModal.svelte';

  let {
    concepts = $bindable([]),
    onChange,
    disabled = false,
    openDirectory,
  }: {
    concepts?: Concept[];
    onChange?: (concepts: Concept[]) => void;
    disabled?: boolean;
    openDirectory?: (mode: 'file' | 'dir', currentPath?: string) => Promise<string | null>;
  } = $props();

  let searchQuery = $state('');
  let typeFilter = $state<'ALL' | 'STANDARD' | 'VALIDATION' | 'PRIOR_PREDICTION'>('ALL');
  let showDisabled = $state(true);

  let editingIndex = $state<number | null>(null);
  let isModalOpen = $state(false);

  function notifyChange(newConcepts: Concept[]) {
    concepts = newConcepts;
    onChange?.(newConcepts);
  }

  function handleAddConcept() {
    const newConcept: Concept = {
      name: `Concept ${concepts.length + 1}`,
      path: '',
      enabled: true,
      type: 'STANDARD',
      include_subdirectories: false,
      balancing: 1.0,
      balancing_strategy: 'REPEATS',
      loss_weight: 1.0,
      image: {
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
      },
      text: {
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
      },
    };
    editingIndex = concepts.length;
    concepts = [...concepts, newConcept];
    isModalOpen = true;
  }

  function handleEditConcept(index: number) {
    editingIndex = index;
    isModalOpen = true;
  }

  function handleCloneConcept(index: number) {
    const original = concepts[index];
    const clone: Concept = JSON.parse(JSON.stringify(original));
    clone.name = `${original.name || 'Concept'} (Copy)`;
    const updated = [...concepts, clone];
    notifyChange(updated);
  }

  function handleRemoveConcept(index: number) {
    const updated = concepts.filter((_, i) => i !== index);
    notifyChange(updated);
  }

  function handleSaveConcept(updatedConcept: Concept) {
    if (editingIndex !== null && editingIndex >= 0 && editingIndex < concepts.length) {
      const updatedList = concepts.map((c, i) => (i === editingIndex ? updatedConcept : c));
      notifyChange(updatedList);
    } else {
      notifyChange([...concepts, updatedConcept]);
    }
    isModalOpen = false;
    editingIndex = null;
  }

  function toggleAllEnabled() {
    const anyEnabled = concepts.some((c) => c.enabled !== false);
    const targetState = !anyEnabled;
    const updated = concepts.map((c) => ({ ...c, enabled: targetState }));
    notifyChange(updated);
  }

  const filteredConcepts = $derived(
    concepts
      .map((concept, originalIndex) => ({ concept, originalIndex }))
      .filter(({ concept }) => {
        if (!showDisabled && concept.enabled === false) return false;

        if (typeFilter !== 'ALL' && (concept.type || 'STANDARD') !== typeFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const name = (concept.name || '').toLowerCase();
          const path = (concept.path || '').toLowerCase();
          return name.includes(q) || path.includes(q);
        }

        return true;
      })
  );
</script>

<div class="concepts-editor" data-testid="concepts-editor">
  <!-- Toolbar & Filter Controls Header -->
  <div class="toolbar-header">
    <div class="toolbar-row main-row">
      <div class="search-box">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          placeholder="Search concepts by name or directory path..."
          bind:value={searchQuery}
        />
      </div>

      <div class="filter-select-wrapper">
        <Select
          ariaLabel="Filter concept types"
          value={typeFilter}
          options={[
            { value: 'ALL', label: 'All Types' },
            { value: 'STANDARD', label: 'STANDARD' },
            { value: 'VALIDATION', label: 'VALIDATION' },
            { value: 'PRIOR_PREDICTION', label: 'PRIOR_PREDICTION' },
          ]}
          onChange={(v) => (typeFilter = v)}
        />
      </div>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-row controls-row">
      <label class="checkbox-toggle">
        <input type="checkbox" bind:checked={showDisabled} />
        <span>Show Disabled</span>
      </label>

      <button
        type="button"
        class="btn btn-secondary"
        {disabled}
        onclick={toggleAllEnabled}
        title="Toggle enable/disable for all concepts"
      >
        {#if concepts.some((c) => c.enabled !== false)}
          <EyeOff size={16} />
          <span>Disable All</span>
        {:else}
          <Eye size={16} />
          <span>Enable All</span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Cards Grid View -->
  {#if filteredConcepts.length === 0}
    <div class="empty-state">
      <Folder size={48} class="empty-icon" />
      <p class="empty-title">
        {concepts.length === 0 ? 'No concepts configured' : 'No concepts match the search criteria'}
      </p>
      <p class="empty-sub">
        {concepts.length === 0
          ? 'Add a concept to define training datasets, prompts, image augmentations, and repeats.'
          : 'Try adjusting your search filter or enabling "Show Disabled".'}
      </p>
      {#if concepts.length === 0}
        <button
          type="button"
          class="btn btn-primary"
          {disabled}
          onclick={handleAddConcept}
        >
          <Plus size={16} />
          <span>Add First Concept</span>
        </button>
      {/if}
    </div>
  {:else}
    <div class="concepts-grid">
      <AddCard label="Add Concept" {disabled} onClick={handleAddConcept} />

      {#each filteredConcepts as { concept, originalIndex } (originalIndex)}
        <div
          class="concept-card"
          class:disabled={concept.enabled === false}
          role="button"
          tabindex="0"
          onclick={() => handleEditConcept(originalIndex)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEditConcept(originalIndex);
            }
          }}
        >
          <!-- Preview Thumbnail -->
          <div class="thumbnail-wrapper">
            <img
              src="/api/concepts/preview-image?path={encodeURIComponent(concept.path || '')}&include_subdirectories={concept.include_subdirectories}"
              alt="Concept Thumbnail"
              class="concept-thumbnail"
            />
            <span class="type-badge {concept.type || 'STANDARD'}">
              {concept.type || 'STANDARD'}
            </span>
          </div>

          <!-- Card Content -->
          <div class="card-content">
            <div class="card-title-bar">
              <h4 class="concept-name" title={concept.name || concept.path}>
                {concept.name || (concept.path ? concept.path.split('/').pop() : 'Untitled Concept')}
              </h4>
              <div
                class="toggle-wrapper"
                role="presentation"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
              >
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={concept.enabled !== false}
                    onchange={(e) => {
                      e.stopPropagation();
                      const updated = concepts.map((c, i) =>
                        i === originalIndex ? { ...c, enabled: (e.target as HTMLInputElement).checked } : c
                      );
                      notifyChange(updated);
                    }}
                  />
                  <span class="switch-slider"></span>
                </label>
              </div>
            </div>

            <p class="concept-path" title={concept.path}>
              {concept.path || 'No directory path set'}
            </p>

            <div class="concept-meta">
              <span class="meta-tag">Balancing: {concept.balancing ?? 1}x ({concept.balancing_strategy || 'REPEATS'})</span>
              <span class="meta-tag">Loss Wt: {concept.loss_weight ?? 1}</span>
            </div>

            <!-- Card Actions -->
            <div class="card-actions">
              <button
                type="button"
                class="btn-action edit"
                title="Edit Concept Settings"
                onclick={(e) => {
                  e.stopPropagation();
                  handleEditConcept(originalIndex);
                }}
              >
                <Edit2 size={15} />
                <span>Edit</span>
              </button>

              <button
                type="button"
                class="btn-action clone"
                title="Duplicate Concept"
                onclick={(e) => {
                  e.stopPropagation();
                  handleCloneConcept(originalIndex);
                }}
              >
                <Copy size={15} />
                <span>Clone</span>
              </button>

              <button
                type="button"
                class="btn-action delete"
                title="Delete Concept"
                onclick={(e) => {
                  e.stopPropagation();
                  handleRemoveConcept(originalIndex);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Concept Edit Modal -->
  {#if editingIndex !== null}
    <ConceptDetailModal
      concept={concepts[editingIndex] || null}
      isOpen={isModalOpen}
      onSave={handleSaveConcept}
      onClose={() => {
        isModalOpen = false;
        editingIndex = null;
      }}
      {openDirectory}
    />
  {/if}
</div>

<style>
  .concepts-editor {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }

  .toolbar-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--panel, #181e25);
    border: 1px solid var(--line, #2d3741);
    padding: 1.25rem;
    border-radius: 8px;
    width: 740px;
    max-width: 100%;
    box-sizing: border-box;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    width: 100%;
  }

  .main-row {
    justify-content: space-between;
  }

  .controls-row {
    justify-content: space-between;
  }

  .toolbar-divider {
    height: 1px;
    background: var(--line, #2d3741);
    width: 100%;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    flex: 1;
    min-width: 220px;
  }

  .search-icon {
    color: var(--muted, #94a3b8);
  }

  .search-box input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
    width: 100%;
  }

  .filter-select-wrapper {
    min-width: 150px;
  }

  .checkbox-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text, #e6ebef);
    cursor: pointer;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1.5rem;
    border: 2px dashed var(--line, #2d3741);
    border-radius: 8px;
    background: var(--panel, #181e25);
    text-align: center;
  }

  .empty-icon {
    color: var(--muted, #94a3b8);
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
    margin: 0 0 0.25rem 0;
  }

  .empty-sub {
    font-size: 0.875rem;
    color: var(--muted, #94a3b8);
    margin: 0 0 1.5rem 0;
    max-width: 420px;
  }

  .concepts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }


  .concept-card {
    display: flex;
    background: var(--panel, #181e25);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s ease, transform 0.15s ease;
    cursor: pointer;
  }

  .concept-card:hover {
    border-color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .concept-card.disabled {
    opacity: 0.6;
  }

  .thumbnail-wrapper {
    width: 130px;
    position: relative;
    background: var(--control, #14191f);
    flex-shrink: 0;
  }

  .concept-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .type-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    background: rgba(0, 0, 0, 0.7);
    color: var(--accent, #3b82f6);
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .card-content {
    flex: 1;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .card-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .concept-name {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-title, var(--accent, #3b82f6));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toggle-switch input {
    cursor: pointer;
  }

  .concept-path {
    margin: 0;
    font-size: 0.75rem;
    color: var(--muted, #94a3b8);
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .concept-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .meta-tag {
    font-size: 0.6875rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--panel-raised, #1d242c);
    color: var(--text, #f8fafc);
    border: 1px solid var(--line, #2d3741);
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid var(--line, #2d3741);
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line, #2d3741);
    background: var(--panel-raised, #1d242c);
    color: var(--text, #f8fafc);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-action:hover {
    background: var(--line, #2d3741);
  }

  .btn-action.delete:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border-color: #ef4444;
  }
</style>
