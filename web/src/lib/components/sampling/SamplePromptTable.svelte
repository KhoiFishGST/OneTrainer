<script lang="ts">
  import { Dices, Pencil, Copy, Trash2, Plus } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import * as Table from '$lib/components/ui/table/index.js';

  let {
    samples = [],
    drafts = {},
    onUpdate = () => {},
    onDraftChange = () => {},
    onEditModal = () => {},
    onClone = () => {},
    onDelete = () => {},
    onAdd = () => {},
  }: {
    samples?: any[];
    drafts?: Record<string, { width?: string; height?: string; seed?: string }>;
    onUpdate?: (index: number, updatedSample: any) => void;
    onDraftChange?: (index: number, field: 'width' | 'height' | 'seed', value: string) => void;
    onEditModal?: (index: number) => void;
    onClone?: (index: number) => void;
    onDelete?: (index: number) => void;
    onAdd?: () => void;
  } = $props();

  function getDraftOrValue(sample: any, index: number, field: 'width' | 'height' | 'seed', fallback: number): number | string {
    const key = sample?.webui_id ?? `sample_${index}`;
    const draftVal = drafts[key]?.[field];
    if (draftVal !== undefined) return draftVal;
    return sample?.[field] ?? fallback;
  }

  function integerOr(value: string | number | null, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  function handleToggleRandomSeed(index: number, currentSeed: number) {
    const nextSeed = currentSeed === -1 ? 42 : -1;
    onUpdate(index, { ...samples[index], seed: nextSeed });
  }

  function handleWidthChange(index: number, value: number | null | string) {
    onUpdate(index, { ...samples[index], width: integerOr(value, 512) });
  }

  function handleHeightChange(index: number, value: number | null | string) {
    onUpdate(index, { ...samples[index], height: integerOr(value, 512) });
  }

  function handleSeedChange(index: number, value: number | null | string) {
    onUpdate(index, { ...samples[index], seed: integerOr(value, -1) });
  }

  function handlePromptChange(index: number, value: string) {
    onUpdate(index, { ...samples[index], prompt: value });
  }

  function handleEnabledChange(index: number, checked: boolean) {
    onUpdate(index, { ...samples[index], enabled: checked });
  }
</script>

<div class="table-container">
  <Table.Root class="prompt-table">
    <Table.Header>
      <Table.Row>
        <Table.Head class="col-active">Active</Table.Head>
        <Table.Head class="col-dim">Width</Table.Head>
        <Table.Head class="col-dim">Height</Table.Head>
        <Table.Head class="col-seed">Seed</Table.Head>
        <Table.Head class="col-prompt">Prompt Text</Table.Head>
        <Table.Head class="col-actions">Actions</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each samples as sample, index (sample.webui_id || index)}
        <Table.Row class={!sample.enabled ? 'disabled' : ''}>
          <Table.Cell class="col-active">
            <Checkbox
              value={sample.enabled}
              onChange={(checked) => handleEnabledChange(index, checked)}
            />
          </Table.Cell>
          <Table.Cell class="col-dim">
            <NumberInput
              id={`sample-width-${index}`}
              class="num-input"
              value={getDraftOrValue(sample, index, 'width', 512)}
              onInput={(val) => onDraftChange(index, 'width', val)}
              onChange={(val) => handleWidthChange(index, val)}
            />
          </Table.Cell>
          <Table.Cell class="col-dim">
            <NumberInput
              id={`sample-height-${index}`}
              class="num-input"
              value={getDraftOrValue(sample, index, 'height', 512)}
              onInput={(val) => onDraftChange(index, 'height', val)}
              onChange={(val) => handleHeightChange(index, val)}
            />
          </Table.Cell>
          <Table.Cell class="col-seed">
            <div class="seed-cell">
              <NumberInput
                id={`sample-seed-${index}`}
                class="num-input seed-input"
                value={getDraftOrValue(sample, index, 'seed', -1)}
                onInput={(val) => onDraftChange(index, 'seed', val)}
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
          </Table.Cell>
          <Table.Cell class="col-prompt">
            <TextInput
              class="prompt-input"
              value={sample.prompt ?? ''}
              onChange={(val) => handlePromptChange(index, val)}
            />
          </Table.Cell>
          <Table.Cell class="col-actions">
            <Button
              type="button"
              class="btn-icon"
              title="Edit sample prompt"
              aria-label="Edit sample prompt"
              onclick={() => onEditModal(index)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              type="button"
              class="btn-icon"
              title="Clone sample prompt"
              aria-label="Clone sample prompt"
              onclick={() => onClone(index)}
            >
              <Copy size={14} />
            </Button>
            <Button
              type="button"
              class="btn-icon danger"
              title="Delete sample prompt"
              aria-label="Delete sample prompt"
              onclick={() => onDelete(index)}
            >
              <Trash2 size={14} />
            </Button>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>

  <div class="add-row">
    <Button type="button" class="add-btn" onclick={onAdd}>
      <Plus size={16} /> Add Sample Prompt
    </Button>
  </div>
</div>

<style>
  .table-container {
    width: 100%;
    overflow-x: auto;
    background: var(--card, #1e242b);
    border-radius: 6px;
    border: 1px solid var(--border, #2d3741);
  }

  /* Bits UI / Table boundary: style prompt table component */
  :global(.prompt-table) {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  /* Bits UI / Table boundary: style table columns */
  :global(.col-active) { width: 44px; text-align: center; }
  :global(.col-dim) { width: 68px; }
  :global(.col-seed) { width: 116px; }
  :global(.col-prompt) { width: auto; }
  :global(.col-actions) { width: 100px; text-align: right; }

  /* Bits UI / Table boundary: style table number inputs */
  :global(.prompt-table .num-input) {
    width: 100%;
    height: 30px;
    background: var(--muted, #13171c);
    border: 1px solid var(--border, #2d3741);
    color: var(--foreground, #fff);
    border-radius: 4px;
    padding: 0 6px;
  }

  /* Bits UI / Table boundary: style table text inputs */
  :global(.prompt-table .prompt-input) {
    min-width: 0;
    width: 100%;
    height: 30px;
    background: var(--muted, #13171c);
    border: 1px solid var(--border, #2d3741);
    color: var(--foreground, #fff);
    border-radius: 4px;
    padding: 0 8px;
    font-size: 0.875rem;
  }

  .seed-cell { display: flex; align-items: center; gap: 4px; }
  /* Bits UI / Table boundary: style dice button */
  .seed-cell :global(.dice-btn) {
    min-height: 0;
    height: 30px;
    width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--muted, #13171c);
    border: 1px solid var(--border, #2d3741);
    color: var(--muted-foreground, #8b9bb4);
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }

  /* Bits UI / Table boundary: style active dice button */
  .seed-cell :global(.dice-btn.active) {
    color: #10b981;
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  /* Bits UI / Table boundary: style column action icon buttons */
  :global(.col-actions .btn-icon) {
    min-height: 0;
    background: none;
    border: none;
    color: var(--muted-foreground, #8b9bb4);
    cursor: pointer;
    padding: 4px;
  }

  /* Bits UI / Table boundary: style column action icon button hover states */
  :global(.col-actions .btn-icon:hover) { color: #fff; }
  :global(.col-actions .btn-icon.danger:hover) { color: #ef4444; }

  .add-row {
    padding: 10px;
    text-align: center;
    background: rgba(0,0,0,0.1);
  }

  /* Bits UI / Table boundary: style add button component */
  .add-row :global(.add-btn) {
    min-height: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 1px dashed var(--border, #2d3741);
    color: var(--primary, #3b82f6);
    padding: 6px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  /* Bits UI / Table boundary: style add button hover */
  .add-row :global(.add-btn:hover) { background: rgba(59, 130, 246, 0.1); }

  /* Bits UI / Table boundary: style disabled table rows */
  :global(tr.disabled) { opacity: 0.5; }
</style>
