<script lang="ts">
  import { Trash2, Copy, Folder } from 'lucide-svelte';
  import { Switch as Toggle } from '$lib/components/ui/switch/index.js';
  import TimeInput from '$lib/components/form/TimeInput.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

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

  let showDeleteConfirm = $state(false);

  function handleFilePick() {
    if (onOpenDirectory) {
      onOpenDirectory(embedding.model_name || '', (selectedPath: string) => {
        embedding.model_name = selectedPath;
      });
    }
  }
</script>

<Card.Root class="embedding-card bg-card border border-border rounded-lg p-4 flex flex-col gap-3.5 transition-colors hover:border-slate-600 {disabled ? 'disabled opacity-50' : ''}">
  <Card.Header class="card-header flex items-center justify-between pb-3 pt-0 px-0 border-b border-border/60">
    <div class="card-title-group">
      <Badge variant="secondary" class="card-badge text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">#{index + 1}</Badge>
      <Card.Title class="card-title text-sm font-semibold text-foreground font-mono m-0">{embedding.placeholder || '<embedding>'}</Card.Title>
    </div>

    <div class="card-actions">
      <Button
        type="button"
        variant="outline"
        size="sm"
        title="Clone embedding"
        {disabled}
        onclick={() => onClone(index)}
      >
        <Copy size={15} />
        <span>Clone</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        class="bg-destructive/10 text-destructive border-destructive/25 hover:bg-destructive/20 hover:text-destructive"
        title="Remove embedding"
        {disabled}
        onclick={() => (showDeleteConfirm = true)}
      >
        <Trash2 size={15} />
        <span>Remove</span>
      </Button>
    </div>
  </Card.Header>

  <Card.Content class="card-body flex flex-col gap-3.5 p-0">
    <!-- Top Row: Base Embedding, Placeholder, Token Count -->
    <div class="fields-grid top-grid">
      <div class="field-item flex-2">
        <label for={`base-emb-${index}`} class="field-label">Base Embedding</label>
        <div class="input-with-button">
          <TextInput
            id={`base-emb-${index}`}
            type="text"
            placeholder="Leave empty to create new"
            value={embedding.model_name || ''}
            {disabled}
            onInput={(val) => (embedding.model_name = val)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
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
          placeholder="*"
          value={embedding.initial_embedding_text || ''}
          {disabled}
          onInput={(val) => (embedding.initial_embedding_text = val)}
        />
      </div>
    </div>
  </Card.Content>
</Card.Root>

{#if showDeleteConfirm}
  <AlertDialog.Root open={showDeleteConfirm} onOpenChange={(v) => { if (!v) showDeleteConfirm = false; }}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Remove Embedding?</AlertDialog.Title>
        <AlertDialog.Description>
          Are you sure you want to remove embedding #{index + 1} ({embedding.placeholder || '<embedding>'})?
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={() => showDeleteConfirm = false}>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action onclick={() => { showDeleteConfirm = false; onRemove(index); }}>
          Remove
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

<style>
  .card-title-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    background: var(--muted, rgba(255, 255, 255, 0.02));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.05));
    border-radius: 6px;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground, #94a3b8);
  }

  .input-with-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
