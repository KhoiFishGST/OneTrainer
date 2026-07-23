<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Folder, ChevronDown, ChevronRight, Layers } from 'lucide-svelte';
  import PathInput from '$lib/components/form/PathInput.svelte';
  import { api } from '$lib/api/client';
  import type { Concept, FileSystemEntry } from '$lib/api/types';

  let {
    concepts = $bindable([]),
    onChange,
    disabled = false,
  }: {
    concepts?: Concept[];
    onChange?: (concepts: Concept[]) => void;
    disabled?: boolean;
  } = $props();

  let activeTabMap = $state<Record<number, 'fields' | 'preview'>>({});
  let previewCache = $state<Record<string, { loading: boolean; error: string | null; files: FileSystemEntry[] }>>({});
  let expandedDetailsMap = $state<Record<number, boolean>>({});

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];

  function notifyChange(newConcepts: Concept[]) {
    concepts = newConcepts;
    onChange?.(newConcepts);
  }

  function addConcept() {
    const defaultConcept: Concept = {
      instance_prompt: '',
      class_prompt: '',
      dataset_directory: '',
      class_dataset_directory: '',
      enabled: true,
      repeats: 1,
      include_subdirectories: false,
    };
    const updated = [...concepts, defaultConcept];
    notifyChange(updated);
  }

  function removeConcept(index: number) {
    const updated = concepts.filter((_, i) => i !== index);
    notifyChange(updated);
  }

  function moveConcept(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= concepts.length) return;

    const updated = [...concepts];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    notifyChange(updated);
  }

  function updateConceptField(index: number, field: keyof Concept, value: any) {
    const updated = concepts.map((c, i) => {
      if (i === index) {
        return { ...c, [field]: value };
      }
      return c;
    });
    notifyChange(updated);

    if (field === 'dataset_directory' && value) {
      loadPreviewFiles(value);
    }
  }

  async function loadPreviewFiles(dirPath: string) {
    if (!dirPath || previewCache[dirPath]?.loading) return;
    
    previewCache[dirPath] = { loading: true, error: null, files: [] };
    try {
      const res = await api.listDirectory(dirPath, 'file', IMAGE_EXTENSIONS);
      const files = (res.entries || []).filter((entry) => {
        if (entry.is_dir) return false;
        const name = entry.name.toLowerCase();
        return IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
      });
      previewCache[dirPath] = { loading: false, error: null, files };
    } catch (err: any) {
      previewCache[dirPath] = {
        loading: false,
        error: err.message || 'Failed to load preview images',
        files: [],
      };
    }
  }

  function toggleDetails(index: number) {
    expandedDetailsMap[index] = !expandedDetailsMap[index];
  }
</script>

<div class="concepts-editor">
  <div class="editor-header">
    <div class="header-title">
      <span class="icon-title"><Layers size={20} /></span>
      <h3>Concepts ({concepts.length})</h3>
    </div>
    <button
      type="button"
      class="btn btn-primary add-concept-btn"
      {disabled}
      onclick={addConcept}
    >
      <Plus size={16} />
      <span>Add Concept</span>
    </button>
  </div>

  {#if concepts.length === 0}
    <div class="empty-state">
      <span class="empty-icon"><Folder size={40} /></span>
      <p class="empty-title">No concepts configured</p>
      <p class="empty-sub">Add a concept to define instance prompts, dataset directories, and training parameters.</p>
      <button
        type="button"
        class="btn btn-secondary"
        {disabled}
        onclick={addConcept}
      >
        <Plus size={16} />
        <span>Add First Concept</span>
      </button>
    </div>
  {:else}
    <div class="concepts-list">
      {#each concepts as concept, index (index)}
        <div class="concept-card" class:disabled={!concept.enabled}>
          <div class="card-header">
            <div class="card-header-left">
              <span class="concept-badge">#{index + 1}</span>
              <span class="concept-title">
                {concept.instance_prompt || concept.name || 'Untitled Concept'}
              </span>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="icon-btn"
                aria-label="Move Up"
                title="Move Up"
                disabled={disabled || index === 0}
                onclick={() => moveConcept(index, 'up')}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                class="icon-btn"
                aria-label="Move Down"
                title="Move Down"
                disabled={disabled || index === concepts.length - 1}
                onclick={() => moveConcept(index, 'down')}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                class="icon-btn danger"
                aria-label="Remove Concept"
                title="Remove Concept"
                {disabled}
                onclick={() => removeConcept(index)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div class="card-body">
            <div class="form-grid">
              <div class="form-group">
                <label for={`instance-prompt-${index}`} class="form-label">Instance Prompt</label>
                <input
                  id={`instance-prompt-${index}`}
                  type="text"
                  class="form-input"
                  placeholder="e.g. photo of sks dog"
                  value={concept.instance_prompt ?? ''}
                  {disabled}
                  oninput={(e) => updateConceptField(index, 'instance_prompt', (e.target as HTMLInputElement).value)}
                />
              </div>

              <div class="form-group">
                <label for={`class-prompt-${index}`} class="form-label">Class Prompt</label>
                <input
                  id={`class-prompt-${index}`}
                  type="text"
                  class="form-input"
                  placeholder="e.g. photo of a dog"
                  value={concept.class_prompt ?? ''}
                  {disabled}
                  oninput={(e) => updateConceptField(index, 'class_prompt', (e.target as HTMLInputElement).value)}
                />
              </div>

              <div class="form-group full-width">
                <PathInput
                  id={`dataset-dir-${index}`}
                  label="Dataset Directory"
                  value={concept.dataset_directory ?? ''}
                  mode="dir"
                  {disabled}
                  placeholder="/path/to/dataset/images"
                  onChange={(val) => updateConceptField(index, 'dataset_directory', val)}
                />
              </div>

              <div class="form-group full-width">
                <PathInput
                  id={`class-dataset-dir-${index}`}
                  label="Class Dataset Directory (Optional)"
                  value={concept.class_dataset_directory ?? ''}
                  mode="dir"
                  {disabled}
                  placeholder="/path/to/class/images"
                  onChange={(val) => updateConceptField(index, 'class_dataset_directory', val)}
                />
              </div>
            </div>

            <!-- Preview & Advanced Settings Section -->
            <div class="card-footer">
              {#if concept.dataset_directory}
                <div class="dataset-preview-panel">
                  <div class="preview-header">
                    <div class="preview-info">
                      <ImageIcon size={16} />
                      <span class="preview-title">Dataset Preview</span>
                      {#if previewCache[concept.dataset_directory]}
                        {#if previewCache[concept.dataset_directory].loading}
                          <span class="status-badge loading">Scanning...</span>
                        {:else if previewCache[concept.dataset_directory].error}
                          <span class="status-badge error">{previewCache[concept.dataset_directory].error}</span>
                        {:else}
                          <span class="status-badge count">
                            {previewCache[concept.dataset_directory].files.length} images found
                          </span>
                        {/if}
                      {:else}
                        <button
                          type="button"
                          class="btn-link"
                          onclick={() => loadPreviewFiles(concept.dataset_directory!)}
                        >
                          Load preview
                        </button>
                      {/if}
                    </div>
                  </div>

                  {#if previewCache[concept.dataset_directory]?.files?.length}
                    <div class="preview-grid">
                      {#each previewCache[concept.dataset_directory].files.slice(0, 8) as file}
                        <div class="thumbnail-card" title={file.name}>
                          <div class="thumb-icon-wrapper">
                            <ImageIcon size={20} class="thumb-icon" />
                          </div>
                          <span class="thumb-name">{file.name}</span>
                        </div>
                      {/each}
                      {#if previewCache[concept.dataset_directory].files.length > 8}
                        <div class="more-images-card">
                          +{previewCache[concept.dataset_directory].files.length - 8} more
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Advanced options toggle -->
              <div class="advanced-toggle">
                <button
                  type="button"
                  class="toggle-btn"
                  onclick={() => toggleDetails(index)}
                >
                  {#if expandedDetailsMap[index]}
                    <ChevronDown size={16} />
                  {:else}
                    <ChevronRight size={16} />
                  {/if}
                  <span>Advanced Parameters</span>
                </button>
              </div>

              {#if expandedDetailsMap[index]}
                <div class="advanced-options">
                  <div class="form-grid compact">
                    <div class="form-group">
                      <label for={`repeats-${index}`} class="form-label">Repeats / Balancing</label>
                      <input
                        id={`repeats-${index}`}
                        type="number"
                        step="1"
                        min="1"
                        class="form-input"
                        value={concept.repeats ?? 1}
                        {disabled}
                        oninput={(e) => updateConceptField(index, 'repeats', Number((e.target as HTMLInputElement).value))}
                      />
                    </div>

                    <div class="form-group">
                      <label for={`loss-weight-${index}`} class="form-label">Loss Weight</label>
                      <input
                        id={`loss-weight-${index}`}
                        type="number"
                        step="0.1"
                        min="0"
                        class="form-input"
                        value={concept.loss_weight ?? 1.0}
                        {disabled}
                        oninput={(e) => updateConceptField(index, 'loss_weight', Number((e.target as HTMLInputElement).value))}
                      />
                    </div>

                    <div class="form-group checkbox-group">
                      <label class="checkbox-label">
                        <input
                          type="checkbox"
                          checked={concept.include_subdirectories ?? false}
                          {disabled}
                          onchange={(e) => updateConceptField(index, 'include_subdirectories', (e.target as HTMLInputElement).checked)}
                        />
                        <span>Include Subdirectories</span>
                      </label>
                    </div>

                    <div class="form-group checkbox-group">
                      <label class="checkbox-label">
                        <input
                          type="checkbox"
                          checked={concept.enabled ?? true}
                          {disabled}
                          onchange={(e) => updateConceptField(index, 'enabled', (e.target as HTMLInputElement).checked)}
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .concepts-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--line, #e5e7eb);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-title h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text, #111827);
  }

  .icon-title {
    color: var(--accent, #2563eb);
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
    background: var(--accent, #2563eb);
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-secondary {
    background: var(--panel-raised, #f3f4f6);
    color: var(--text, #374151);
    border-color: var(--line, #d1d5db);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--line, #e5e7eb);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    border: 2px dashed var(--line, #e5e7eb);
    border-radius: 8px;
    background: var(--panel, #ffffff);
    text-align: center;
  }

  .empty-icon {
    color: var(--muted, #9ca3af);
    margin-bottom: 0.75rem;
  }

  .empty-title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text, #111827);
    margin: 0 0 0.25rem 0;
  }

  .empty-sub {
    font-size: 0.875rem;
    color: var(--muted, #6b7280);
    margin: 0 0 1.25rem 0;
    max-width: 400px;
  }

  .concepts-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .concept-card {
    border: 1px solid var(--line, #e5e7eb);
    border-radius: 8px;
    background: var(--panel, #ffffff);
    overflow: hidden;
    transition: border-color 0.15s ease;
  }

  .concept-card.disabled {
    opacity: 0.65;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--panel-raised, #f9fafb);
    border-bottom: 1px solid var(--line, #e5e7eb);
  }

  .card-header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .concept-badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: var(--accent-soft, #dbeafe);
    color: var(--accent, #2563eb);
  }

  .concept-title {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--text, #111827);
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted, #6b7280);
    cursor: pointer;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--panel, #e5e7eb);
    color: var(--text, #111827);
  }

  .icon-btn.danger:hover:not(:disabled) {
    background: #fee2e2;
    color: #dc2626;
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .card-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .form-grid.compact {
    grid-template-columns: repeat(2, 1fr);
    align-items: center;
  }

  .full-width {
    grid-column: span 2;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text, #374151);
  }

  .form-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--line, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--panel, #ffffff);
    color: var(--text, #111827);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }

  .checkbox-group {
    justify-content: flex-end;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text, #374151);
    cursor: pointer;
  }

  .card-footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--line, #e5e7eb);
  }

  .dataset-preview-panel {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.75rem;
    background: var(--panel-raised, #f9fafb);
    border-radius: 6px;
    border: 1px solid var(--line, #e5e7eb);
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .preview-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text, #374151);
  }

  .preview-title {
    font-weight: 500;
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .status-badge.count {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.loading {
    background: #fef9c3;
    color: #854d0e;
  }

  .status-badge.error {
    background: #fee2e2;
    color: #991b1b;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--accent, #2563eb);
    font-size: 0.75rem;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
  }

  .thumbnail-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--panel, #ffffff);
    border: 1px solid var(--line, #e5e7eb);
    border-radius: 4px;
    text-align: center;
  }

  .thumb-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--panel-raised, #f3f4f6);
    border-radius: 4px;
    color: var(--muted, #6b7280);
  }

  .thumb-name {
    font-size: 0.6875rem;
    color: var(--muted, #6b7280);
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .more-images-card {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--accent, #2563eb);
    background: var(--accent-soft, #dbeafe);
    border-radius: 4px;
    padding: 0.5rem;
  }

  .advanced-toggle {
    display: flex;
  }

  .toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: none;
    border: none;
    color: var(--muted, #6b7280);
    font-size: 0.8125rem;
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .toggle-btn:hover {
    color: var(--text, #111827);
  }

  .advanced-options {
    padding: 0.75rem;
    background: var(--panel-raised, #f9fafb);
    border-radius: 6px;
    border: 1px solid var(--line, #e5e7eb);
  }
</style>
