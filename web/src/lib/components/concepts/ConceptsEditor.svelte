<script lang="ts">
  import Select from '../form/ValueSelect.svelte';
  import AddCard from '../collections/AddItemCard.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '../ui/input/index.js';
  import { Checkbox } from '../ui/checkbox/index.js';
  import { Badge } from '../ui/badge/index.js';
  import * as Card from '../ui/card/index.js';
  import * as DropdownMenu from '../ui/dropdown-menu/index.js';
  import * as AlertDialog from '../ui/alert-dialog/index.js';
  import * as Empty from '../ui/empty/index.js';
  import {
    Plus,
    Trash2,
    Edit2,
    Copy,
    Search,
    Folder,
    Eye,
    EyeOff,
    MoreVertical,
  } from 'lucide-svelte';
  import type { Concept } from '$lib/api/types';
  import ConceptDetailModal from './ConceptDetailModal.svelte';

  let {
    concepts = $bindable([]),
    onChange,
    disabled = false,
    openDirectory,
  }: {
    concepts?: Concept[];
    onChange?: (concepts: Concept[]) => Promise<void> | void;
    disabled?: boolean;
    openDirectory?: (mode: 'file' | 'dir', currentPath?: string) => Promise<string | null>;
  } = $props();

  let searchQuery = $state('');
  let typeFilter = $state<'ALL' | 'STANDARD' | 'VALIDATION' | 'PRIOR_PREDICTION'>('ALL');
  let showDisabled = $state(true);

  let editingIndex = $state<number | null>(null);
  let isModalOpen = $state(false);

  let deleteTargetIndex = $state<number | null>(null);

  function notifyChange(newConcepts: Concept[]): Promise<void> | void {
    concepts = newConcepts;
    return onChange?.(newConcepts);
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
    if (!original) return;
    const clone: Concept = JSON.parse(JSON.stringify(original));
    clone.name = `${original.name || 'Concept'} (Copy)`;
    const updated = [...concepts, clone];
    notifyChange(updated);
  }

  function handleRemoveConcept(index: number) {
    const updated = concepts.filter((_, i) => i !== index);
    notifyChange(updated);
    deleteTargetIndex = null;
  }

  async function handleSaveConcept(updatedConcept: Concept) {
    let updatedList: Concept[];
    if (editingIndex !== null && editingIndex >= 0 && editingIndex < concepts.length) {
      updatedList = concepts.map((c, i) => (i === editingIndex ? updatedConcept : c));
    } else {
      updatedList = [...concepts, updatedConcept];
    }
    await notifyChange(updatedList);
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
        <TextInput
          type="search"
          placeholder="Search concepts by name or directory path..."
          value={searchQuery}
          onInput={(v) => (searchQuery = v)}
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
          onChange={(v: any) => (typeFilter = v)}
        />
      </div>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-row controls-row">
      <label class="checkbox-toggle">
        <Checkbox
          value={showDisabled}
          onChange={(val) => (showDisabled = val)}
        />
        <span>Show Disabled</span>
      </label>

      <Button
        type="button"
        variant="secondary"
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
      </Button>
    </div>
  </div>

  <!-- Empty State composition -->
  {#if filteredConcepts.length === 0}
    <Empty.Root class="border border-dashed p-8 rounded-lg bg-card text-center">
      <Empty.Media>
        <Folder size={48} class="text-muted-foreground mx-auto mb-2" />
      </Empty.Media>
      <Empty.Title class="text-lg font-semibold">
        {concepts.length === 0 ? 'No concepts configured' : 'No concepts match the search criteria'}
      </Empty.Title>
      <Empty.Description class="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        {concepts.length === 0
          ? 'Add a concept to define training datasets, prompts, image augmentations, and repeats.'
          : 'Try adjusting your search filter or enabling "Show Disabled".'}
      </Empty.Description>
      {#if concepts.length === 0}
        <Empty.Content>
          <Button
            type="button"
            variant="default"
            {disabled}
            onclick={handleAddConcept}
          >
            <Plus size={16} />
            <span>Add First Concept</span>
          </Button>
        </Empty.Content>
      {/if}
    </Empty.Root>
  {:else}
    <!-- Cards Grid View -->
    <div class="concepts-grid">
      <AddCard label="Add Concept" {disabled} onClick={handleAddConcept} />

      {#each filteredConcepts as { concept, originalIndex } (originalIndex)}
        <Card.Root
          class="concept-card {concept.enabled === false ? 'disabled' : ''}"
          onclick={() => handleEditConcept(originalIndex)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEditConcept(originalIndex);
            }
          }}
          role="button"
          tabindex={0}
        >
          <!-- Preview Thumbnail -->
          <div class="thumbnail-wrapper">
            <img
              src="/api/concepts/preview-image?path={encodeURIComponent(concept.path || '')}&include_subdirectories={concept.include_subdirectories}"
              alt="Concept Thumbnail"
              class="concept-thumbnail"
            />
            <Badge variant="outline" class="type-badge">
              {concept.type || 'STANDARD'}
            </Badge>
          </div>

          <!-- Card Content -->
          <Card.Content class="card-content">
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
                <Checkbox
                  value={concept.enabled !== false}
                  onChange={(checked) => {
                    const updated = concepts.map((c, i) =>
                      i === originalIndex ? { ...c, enabled: checked } : c
                    );
                    notifyChange(updated);
                  }}
                />
              </div>
            </div>

            <p class="concept-path" title={concept.path}>
              {concept.path || 'No directory path set'}
            </p>

            <div class="concept-meta">
              <Badge variant="secondary" class="meta-tag">Balancing: {concept.balancing ?? 1}x ({concept.balancing_strategy || 'REPEATS'})</Badge>
              <Badge variant="secondary" class="meta-tag">Loss Wt: {concept.loss_weight ?? 1}</Badge>
            </div>

            <!-- Card Actions -->
            <div class="card-actions">
              <Button
                type="button"
                variant="secondary"
                class="btn-action edit"
                title="Edit Concept Settings"
                onclick={(e) => {
                  e.stopPropagation();
                  handleEditConcept(originalIndex);
                }}
              >
                <Edit2 size={15} />
                <span>Edit</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                class="btn-action clone"
                title="Duplicate Concept"
                onclick={(e) => {
                  e.stopPropagation();
                  handleCloneConcept(originalIndex);
                }}
              >
                <Copy size={15} />
                <span>Clone</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                class="btn-action delete"
                title="Delete Concept"
                onclick={(e) => {
                  e.stopPropagation();
                  deleteTargetIndex = originalIndex;
                }}
              >
                <Trash2 size={15} />
              </Button>

              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  onclick={(e) => e.stopPropagation()}
                  class="dropdown-trigger-btn"
                  title="More actions"
                >
                  <MoreVertical size={16} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item onclick={() => handleEditConcept(originalIndex)}>
                    <Edit2 size={14} class="mr-2" />
                    <span>Edit Concept</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onclick={() => handleCloneConcept(originalIndex)}>
                    <Copy size={14} class="mr-2" />
                    <span>Duplicate</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    class="text-destructive focus:text-destructive"
                    onclick={() => (deleteTargetIndex = originalIndex)}
                  >
                    <Trash2 size={14} class="mr-2" />
                    <span>Delete</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </Card.Content>
        </Card.Root>
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

  <!-- Delete Confirmation Dialog -->
  {#if deleteTargetIndex !== null}
    <AlertDialog.Root open={deleteTargetIndex !== null} onOpenChange={(val) => { if (!val) deleteTargetIndex = null; }}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Delete Concept?</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to delete concept "{concepts[deleteTargetIndex]?.name || 'Untitled'}"? This action cannot be undone.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel onclick={() => deleteTargetIndex = null}>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onclick={() => { if (deleteTargetIndex !== null) handleRemoveConcept(deleteTargetIndex); }}>
            Delete
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
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
    background: var(--card, #181e25);
    border: 1px solid var(--border, #2d3741);
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
    background: var(--border, #2d3741);
    width: 100%;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--muted, #14191f);
    border: 1px solid var(--border, #2d3741);
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    flex: 1;
    min-width: 220px;
  }

  /* Bits UI boundary: style TextInput child component */
  .search-box :global(.text-input) {
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--foreground, #f8fafc);
    font-size: 0.875rem;
    width: 100%;
    padding: 0;
    box-shadow: none;
  }

  .filter-select-wrapper {
    min-width: 150px;
  }

  .checkbox-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--foreground, #e6ebef);
    cursor: pointer;
  }

  .concepts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  /* Bits UI boundary: style Card root component */
  :global(.concept-card) {
    display: flex;
    flex-direction: row !important;
    background: var(--card, #181e25);
    border: 1px solid var(--border, #2d3741);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s ease, transform 0.15s ease;
    cursor: pointer;
  }

  /* Bits UI boundary: style Card hover state */
  :global(.concept-card:hover) {
    border-color: var(--primary, #3b82f6);
  }

  /* Bits UI boundary: style Card disabled state */
  :global(.concept-card.disabled) {
    opacity: 0.6;
  }

  .thumbnail-wrapper {
    width: 130px;
    position: relative;
    background: var(--muted, #14191f);
    flex-shrink: 0;
  }

  .concept-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Bits UI boundary: style Type Badge component */
  :global(.type-badge) {
    position: absolute;
    top: 6px;
    left: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
    background: rgba(0, 0, 0, 0.7) !important;
    color: var(--primary, #3b82f6) !important;
    border: 1px solid rgba(59, 130, 246, 0.4) !important;
  }

  /* Bits UI boundary: style Card Content component */
  :global(.card-content) {
    flex: 1;
    padding: 0.875rem 1rem !important;
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
    color: var(--primary, #3b82f6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .concept-path {
    margin: 0;
    font-size: 0.75rem;
    color: var(--muted-foreground, #94a3b8);
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

  /* Bits UI boundary: style Meta Tag Badge component */
  :global(.meta-tag) {
    font-size: 0.6875rem !important;
    padding: 0.15rem 0.4rem !important;
    border-radius: 4px !important;
    background: var(--muted, #1d242c) !important;
    color: var(--foreground, #f8fafc) !important;
    border: 1px solid var(--border, #2d3741) !important;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid var(--border, #2d3741);
  }

  /* Bits UI boundary: style action Button component */
  .card-actions :global(.btn-action) {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 0;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--border, #2d3741);
    background: var(--card, #1d242c);
    color: var(--foreground, #f8fafc);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  /* Bits UI boundary: style action Button component hover state */
  .card-actions :global(.btn-action:hover) {
    background: var(--border, #2d3741);
  }

  /* Bits UI boundary: style delete Button component hover state */
  .card-actions :global(.btn-action.delete:hover) {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border-color: #ef4444;
  }

  /* Bits UI boundary: style Dropdown trigger Button component */
  :global(.dropdown-trigger-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.3rem;
    border-radius: 4px;
    border: 1px solid var(--border, #2d3741);
    background: var(--card, #1d242c);
    color: var(--muted-foreground, #94a3b8);
    cursor: pointer;
  }

  /* Bits UI boundary: style Dropdown trigger Button component hover state */
  :global(.dropdown-trigger-btn:hover) {
    color: var(--foreground, #f8fafc);
    background: var(--border, #2d3741);
  }
</style>
