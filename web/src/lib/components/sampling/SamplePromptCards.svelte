<script lang="ts">
  import { Dices, Pencil, Copy, Trash2, Plus } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';

  let {
    samples = [],
    onUpdate = () => {},
    onEditModal = () => {},
    onClone = () => {},
    onDelete = () => {},
    onAdd = () => {},
  }: {
    samples?: any[];
    onUpdate?: (index: number, updatedSample: any) => void;
    onEditModal?: (index: number) => void;
    onClone?: (index: number) => void;
    onDelete?: (index: number) => void;
    onAdd?: () => void;
  } = $props();

  function handleToggleRandomSeed(index: number, currentSeed: number) {
    const nextSeed = currentSeed === -1 ? 42 : -1;
    onUpdate(index, { ...samples[index], seed: nextSeed });
  }

  function handleWidthChange(index: number, value: number | null | string) {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    onUpdate(index, { ...samples[index], width: isNaN(num) ? 512 : num });
  }

  function handleHeightChange(index: number, value: number | null | string) {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    onUpdate(index, { ...samples[index], height: isNaN(num) ? 512 : num });
  }

  function handleSeedChange(index: number, value: number | null | string) {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    onUpdate(index, { ...samples[index], seed: isNaN(num) ? -1 : num });
  }

  function handlePromptChange(index: number, value: string) {
    onUpdate(index, { ...samples[index], prompt: value });
  }

  function handleEnabledChange(index: number, checked: boolean) {
    onUpdate(index, { ...samples[index], enabled: checked });
  }
</script>

<div class="cards-container">
  <div class="cards-list">
    {#each samples as sample, index (sample.webui_id || index)}
      <Card.Root class="sample-card {!sample.enabled ? 'disabled' : ''}">
        <Card.Header class="card-header">
          <div class="card-header-left">
            <Checkbox
              value={sample.enabled}
              onChange={(checked) => handleEnabledChange(index, checked)}
            />
            <Badge variant="secondary" class="sample-badge">#{index + 1}</Badge>
          </div>
          <div class="card-actions">
            <Button
              type="button"
              class="btn-icon"
              title="Edit sample prompt"
              aria-label="Edit sample prompt"
              onclick={() => onEditModal(index)}
            >
              <Pencil size={15} />
            </Button>
            <Button
              type="button"
              class="btn-icon"
              title="Clone sample prompt"
              aria-label="Clone sample prompt"
              onclick={() => onClone(index)}
            >
              <Copy size={15} />
            </Button>
            <Button
              type="button"
              class="btn-icon danger"
              title="Delete sample prompt"
              aria-label="Delete sample prompt"
              onclick={() => onDelete(index)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </Card.Header>

        <Card.Content class="card-body">
          <div class="prompt-field">
            <label for={`card-prompt-${index}`} class="field-label">Prompt Text</label>
            <TextInput
              id={`card-prompt-${index}`}
              class="prompt-input"
              value={sample.prompt ?? ''}
              onChange={(val) => handlePromptChange(index, val)}
            />
          </div>

          <div class="params-grid">
            <div class="param-item">
              <label for={`card-width-${index}`} class="field-label">Width</label>
              <NumberInput
                id={`card-width-${index}`}
                class="num-input"
                value={sample.width ?? 512}
                onChange={(val) => handleWidthChange(index, val)}
              />
            </div>
            <div class="param-item">
              <label for={`card-height-${index}`} class="field-label">Height</label>
              <NumberInput
                id={`card-height-${index}`}
                class="num-input"
                value={sample.height ?? 512}
                onChange={(val) => handleHeightChange(index, val)}
              />
            </div>
            <div class="param-item seed-item">
              <label for={`card-seed-${index}`} class="field-label">Seed</label>
              <div class="seed-cell">
                <NumberInput
                  id={`card-seed-${index}`}
                  class="num-input seed-input"
                  value={sample.seed ?? -1}
                  onChange={(val) => handleSeedChange(index, val)}
                />
                <Button
                  type="button"
                  class={`dice-btn ${(sample.seed ?? -1) === -1 ? 'active' : ''}`}
                  title="Toggle random seed (-1)"
                  aria-label="Toggle random seed"
                  onclick={() => handleToggleRandomSeed(index, sample.seed ?? -1)}
                >
                  <Dices size={14} />
                </Button>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>

  <div class="add-row">
    <Button type="button" class="add-btn" onclick={onAdd}>
      <Plus size={16} /> Add Sample Prompt
    </Button>
  </div>
</div>

<style>
  .cards-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  :global(.sample-card) {
    background: var(--panel-bg, #1e242b) !important;
    border: 1px solid var(--line, #2d3741) !important;
    border-radius: 8px !important;
    padding: 1rem !important;
  }

  :global(.sample-card.disabled) {
    opacity: 0.6;
  }

  :global(.card-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0 0.75rem 0 !important;
    border-bottom: 1px solid var(--line, #2d3741);
  }

  .card-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  :global(.sample-badge) {
    font-size: 0.75rem !important;
    font-weight: 600 !important;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .card-actions :global(.btn-icon) {
    min-height: 0;
    background: none;
    border: none;
    color: var(--text-muted, #8b9bb4);
    cursor: pointer;
    padding: 4px;
  }

  .card-actions :global(.btn-icon:hover) { color: #fff; }
  .card-actions :global(.btn-icon.danger:hover) { color: #ef4444; }

  :global(.card-body) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 0 0 0 !important;
  }

  .prompt-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-muted, #8b9bb4);
  }

  .params-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .param-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  :global(.num-input) {
    width: 100%;
    height: 30px;
    background: var(--bg-dark, #13171c);
    border: 1px solid var(--line, #2d3741);
    color: var(--text, #fff);
    border-radius: 4px;
    padding: 0 6px;
  }

  .seed-cell { display: flex; align-items: center; gap: 4px; }
  .seed-cell :global(.dice-btn) {
    min-height: 0;
    height: 30px;
    width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-dark, #13171c);
    border: 1px solid var(--line, #2d3741);
    color: var(--text-muted, #8b9bb4);
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .seed-cell :global(.dice-btn.active) {
    color: #10b981;
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .add-row {
    padding: 10px;
    text-align: center;
    background: rgba(0,0,0,0.1);
    border-radius: 6px;
  }

  .add-row :global(.add-btn) {
    min-height: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 1px dashed var(--line, #2d3741);
    color: var(--accent, #3b82f6);
    padding: 6px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .add-row :global(.add-btn:hover) { background: rgba(59, 130, 246, 0.1); }
</style>
