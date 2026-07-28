<script lang="ts">
  import { Dices, Pencil, Copy, Trash2, Plus } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';

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

<div class="table-container">
  <table class="prompt-table">
    <thead>
      <tr>
        <th class="col-active">Active</th>
        <th class="col-dim">Width</th>
        <th class="col-dim">Height</th>
        <th class="col-seed">Seed</th>
        <th class="col-prompt">Prompt Text</th>
        <th class="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each samples as sample, index (sample.webui_id || index)}
        <tr class:disabled={!sample.enabled}>
          <td class="col-active">
            <Checkbox
              value={sample.enabled}
              onChange={(checked) => handleEnabledChange(index, checked)}
            />
          </td>
          <td class="col-dim">
            <NumberInput
              id={`sample-width-${index}`}
              class="num-input"
              value={sample.width ?? 512}
              onChange={(val) => handleWidthChange(index, val)}
            />
          </td>
          <td class="col-dim">
            <NumberInput
              id={`sample-height-${index}`}
              class="num-input"
              value={sample.height ?? 512}
              onChange={(val) => handleHeightChange(index, val)}
            />
          </td>
          <td class="col-seed">
            <div class="seed-cell">
              <NumberInput
                id={`sample-seed-${index}`}
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
          </td>
          <td class="col-prompt">
            <TextInput
              class="prompt-input"
              value={sample.prompt ?? ''}
              onChange={(val) => handlePromptChange(index, val)}
            />
          </td>
          <td class="col-actions">
            <Button type="button" class="btn-icon" title="Edit sample prompt" aria-label="Edit sample prompt" onclick={() => onEditModal(index)}>
              <Pencil size={14} />
            </Button>
            <Button type="button" class="btn-icon" title="Clone sample prompt" aria-label="Clone sample prompt" onclick={() => onClone(index)}>
              <Copy size={14} />
            </Button>
            <Button type="button" class="btn-icon danger" title="Delete sample prompt" aria-label="Delete sample prompt" onclick={() => onDelete(index)}>
              <Trash2 size={14} />
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="add-row">
    <Button type="button" class="add-btn" onclick={onAdd}>
      <Plus size={16} /> Add Sample Prompt
    </Button>
  </div>
</div>

<style>
  .table-container { width: 100%; overflow-x: auto; background: var(--panel-bg, #1e242b); border-radius: 6px; border: 1px solid var(--line, #2d3741); }
  .prompt-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--line, #2d3741); text-align: left; vertical-align: middle; }
  th { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted, #8b9bb4); background: rgba(0,0,0,0.2); }
  .col-active { width: 44px; text-align: center; }
  .col-dim { width: 68px; }
  .col-seed { width: 116px; }
  .col-prompt { width: auto; }
  .col-actions { width: 100px; text-align: right; }
  .prompt-table :global(.num-input) { width: 100%; height: 30px; background: var(--bg-dark, #13171c); border: 1px solid var(--line, #2d3741); color: var(--text, #fff); border-radius: 4px; padding: 0 6px; }
  .prompt-table :global(.prompt-input) { min-width: 0; width: 100%; height: 30px; background: var(--bg-dark, #13171c); border: 1px solid var(--line, #2d3741); color: var(--text, #fff); border-radius: 4px; padding: 0 8px; font-size: 0.875rem; }
  .seed-cell { display: flex; align-items: center; gap: 4px; }
  .seed-cell :global(.dice-btn) { min-height: 0; height: 30px; width: 28px; display: flex; align-items: center; justify-content: center; background: var(--bg-dark, #13171c); border: 1px solid var(--line, #2d3741); color: var(--text-muted, #8b9bb4); border-radius: 4px; cursor: pointer; flex-shrink: 0; }
  .seed-cell :global(.dice-btn.active) { color: #10b981; border-color: #10b981; background: rgba(16, 185, 129, 0.1); }
  .col-actions :global(.btn-icon) { min-height: 0; background: none; border: none; color: var(--text-muted, #8b9bb4); cursor: pointer; padding: 4px; }
  .col-actions :global(.btn-icon:hover) { color: #fff; }
  .col-actions :global(.btn-icon.danger:hover) { color: #ef4444; }
  .add-row { padding: 10px; text-align: center; background: rgba(0,0,0,0.1); }
  .add-row :global(.add-btn) { min-height: 0; display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px dashed var(--line, #2d3741); color: var(--accent, #3b82f6); padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 0.875rem; }
  .add-row :global(.add-btn:hover) { background: rgba(59, 130, 246, 0.1); }
  tr.disabled { opacity: 0.5; }
</style>
