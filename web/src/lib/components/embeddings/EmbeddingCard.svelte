<script lang="ts">
  import { Trash2, Copy, Folder } from 'lucide-svelte';
  import { Switch as Toggle } from '$lib/components/ui/switch/index.js';
  import TimeInput from '$lib/components/form/TimeInput.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';

  interface EmbeddingConfig {
    uuid?: string;
    model_name?: string;
    placeholder?: string;
    token_count?: number;
    train?: boolean;
    is_output_embedding?: boolean;
    stop_training_after?: number;
    stop_training_after_unit?: string;
    initial_embedding_text?: string;
  }

  let {
    embedding = $bindable(),
    index = 0,
    disabled = false,
    onRemove = () => {},
    onClone = () => {},
    onOpenDirectory,
  } = $props<{
    embedding: EmbeddingConfig;
    index: number;
    disabled?: boolean;
    onRemove?: (index: number) => void;
    onClone?: (index: number) => void;
    onOpenDirectory?: (initialPath: string, callback?: (path: string) => void) => void;
  }>();

  function handleFilePick() {
    if (onOpenDirectory) {
      onOpenDirectory(embedding.model_name || '', (selectedPath: string) => {
        embedding.model_name = selectedPath;
      });
    }
  }
</script>

<div class="embedding-card" class:disabled>
  <div class="card-header">
    <div class="card-title-group">
      <span class="card-badge">#{index + 1}</span>
      <span class="card-title">{embedding.placeholder || '<embedding>'}</span>
    </div>

    <div class="card-actions">
      <Button
        type="button"
        class="action-btn clone-btn"
        title="Clone embedding"
        {disabled}
        onclick={() => onClone(index)}
      >
        <Copy size={15} />
        <span>Clone</span>
      </Button>
      <Button
        type="button"
        class="action-btn remove-btn"
        title="Remove embedding"
        {disabled}
        onclick={() => onRemove(index)}
      >
        <Trash2 size={15} />
        <span>Remove</span>
      </Button>
    </div>
  </div>

  <div class="card-body">
    <!-- Top Row: Base Embedding, Placeholder, Token Count -->
    <div class="fields-grid top-grid">
      <div class="field-item flex-2">
        <label for={`base-emb-${index}`} class="field-label">Base Embedding</label>
        <div class="input-with-button">
          <TextInput
            id={`base-emb-${index}`}
            type="text"
            class="text-input"
            placeholder="Leave empty to create new"
            value={embedding.model_name || ''}
            {disabled}
            onInput={(val) => (embedding.model_name = val)}
          />
          <Button
            type="button"
            class="browse-btn"
            title="Browse file"
            {disabled}
            onclick={handleFilePick}
          >
            <Folder size={15} />
          </Button>
        </div>
      </div>

      <div class="field-item flex-1">
        <label for={`placeholder-${index}`} class="field-label">Placeholder</label>
        <TextInput
          id={`placeholder-${index}`}
          type="text"
          class="text-input"
          placeholder="<embedding>"
          value={embedding.placeholder || ''}
          {disabled}
          onInput={(val) => (embedding.placeholder = val)}
        />
      </div>

      <div class="field-item flex-sm">
        <label for={`token-count-${index}`} class="field-label">Token Count</label>
        <NumberInput
          id={`token-count-${index}`}
          min="1"
          class="text-input"
          placeholder="Auto"
          value={embedding.token_count ?? ''}
          {disabled}
          onInput={(val) => {
            const num = Number(val);
            if (!isNaN(num)) {
              embedding.token_count = val === '' ? undefined : num;
            }
          }}
        />
      </div>
    </div>

    <!-- Bottom Row: Train, Output Embedding, Stop Training After, Initial Text -->
    <div class="fields-grid bottom-grid">
      <div class="field-item side-control">
        <span class="field-label">Train</span>
        <Toggle
          id={`train-${index}`}
          value={embedding.train ?? true}
          {disabled}
          onChange={(val) => (embedding.train = val)}
        />
      </div>

      <div class="field-item side-control">
        <span class="field-label">Output Embedding</span>
        <Toggle
          id={`output-emb-${index}`}
          value={embedding.is_output_embedding ?? false}
          {disabled}
          onChange={(val) => (embedding.is_output_embedding = val)}
        />
      </div>

      <div class="field-item flex-1">
        <label for={`stop-after-${index}`} class="field-label">Stop Training After</label>
        <TimeInput
          id={`stop-after-${index}`}
          value={embedding.stop_training_after ?? 0}
          unit={embedding.stop_training_after_unit ?? 'NEVER'}
          {disabled}
          onValueInput={(val) => (embedding.stop_training_after = Number(val) || 0)}
          onUnitChange={(unit) => (embedding.stop_training_after_unit = unit)}
        />
      </div>

      <div class="field-item flex-1">
        <label for={`initial-text-${index}`} class="field-label">Initial Embedding Text</label>
        <TextInput
          id={`initial-text-${index}`}
          type="text"
          class="text-input"
          placeholder="*"
          value={embedding.initial_embedding_text || ''}
          {disabled}
          onInput={(val) => (embedding.initial_embedding_text = val)}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .embedding-card {
    background-color: var(--color-bg-card, var(--panel, #181e25));
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    transition: border-color 0.15s ease;
  }

  .embedding-card:hover:not(.disabled) {
    border-color: var(--color-border-hover, #475569);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.06));
  }

  .card-title-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-muted, #94a3b8);
    background: var(--panel-raised, #252d37);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
  }

  .card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-title, var(--text, #f8fafc));
    font-family: monospace;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-actions :global(.action-btn) {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 0;
    padding: 0.375rem 0.625rem;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .card-actions :global(.clone-btn) {
    background: var(--panel-raised, #252d37);
    color: var(--text, #e2e8f0);
    border-color: var(--line, #334155);
  }

  .card-actions :global(.clone-btn:hover:not(:disabled)) {
    background: var(--accent-soft, rgba(59, 130, 246, 0.15));
    color: var(--accent, #3b82f6);
    border-color: var(--accent, #3b82f6);
  }

  .card-actions :global(.remove-btn) {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.25);
  }

  .card-actions :global(.remove-btn:hover:not(:disabled)) {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .card-actions :global(.action-btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .fields-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.875rem;
    align-items: flex-end;
  }

  .field-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .flex-2 {
    flex: 2;
    min-width: 220px;
  }

  .flex-1 {
    flex: 1;
    min-width: 160px;
  }

  .flex-sm {
    width: 90px;
  }

  .side-control {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 140px;
    height: 38px;
    padding: 0 0.5rem;
    background: var(--panel-raised, rgba(255, 255, 255, 0.02));
    border: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.05));
    border-radius: 6px;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted, #94a3b8);
  }

  .embedding-card :global(.text-input) {
    min-width: 0;
    height: 38px;
    padding: 0 0.75rem;
    background-color: var(--input-bg, #0f1419);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .embedding-card :global(.text-input:focus:not(:disabled)) {
    border-color: var(--accent, #3b82f6);
  }

  .embedding-card :global(.text-input:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-with-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .input-with-button :global(.text-input) {
    flex: 1;
  }

  .input-with-button :global(.browse-btn) {
    height: 38px;
    width: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--panel-raised, #252d37);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--muted, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .input-with-button :global(.browse-btn:hover:not(:disabled)) {
    color: var(--text, #f8fafc);
    border-color: var(--accent, #3b82f6);
  }
</style>
