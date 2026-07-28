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

<div class="w-full overflow-x-auto bg-card rounded-md border border-border">
  <Table.Root class="w-full table-fixed">
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-[44px] text-center p-2">Active</Table.Head>
        <Table.Head class="w-[68px] p-2">Width</Table.Head>
        <Table.Head class="w-[68px] p-2">Height</Table.Head>
        <Table.Head class="w-[116px] p-2">Seed</Table.Head>
        <Table.Head class="w-auto p-2">Prompt Text</Table.Head>
        <Table.Head class="w-[100px] text-right p-2">Actions</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each samples as sample, index (sample.webui_id || index)}
        <Table.Row class={!sample.enabled ? 'opacity-50' : ''}>
          <Table.Cell class="w-[44px] text-center p-2">
            <Checkbox
              value={sample.enabled}
              onChange={(checked) => handleEnabledChange(index, checked)}
            />
          </Table.Cell>
          <Table.Cell class="w-[68px] p-2">
            <NumberInput
              id={`sample-width-${index}`}
              ariaLabel="Width"
              class="h-[30px] w-full text-xs px-1.5"
              value={getDraftOrValue(sample, index, 'width', 512)}
              onInput={(val) => onDraftChange(index, 'width', val)}
              onChange={(val) => handleWidthChange(index, val)}
            />
          </Table.Cell>
          <Table.Cell class="w-[68px] p-2">
            <NumberInput
              id={`sample-height-${index}`}
              ariaLabel="Height"
              class="h-[30px] w-full text-xs px-1.5"
              value={getDraftOrValue(sample, index, 'height', 512)}
              onInput={(val) => onDraftChange(index, 'height', val)}
              onChange={(val) => handleHeightChange(index, val)}
            />
          </Table.Cell>
          <Table.Cell class="w-[116px] p-2">
            <div class="flex items-center gap-1">
              <NumberInput
                id={`sample-seed-${index}`}
                ariaLabel="Seed"
                class="h-[30px] w-full text-xs px-1.5"
                value={getDraftOrValue(sample, index, 'seed', -1)}
                onInput={(val) => onDraftChange(index, 'seed', val)}
                onChange={(val) => handleSeedChange(index, val)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                class={`shrink-0 h-[30px] w-7 ${(sample.seed ?? -1) === -1 ? 'active bg-success-surface text-success border-success/30 hover:bg-success-surface/80 hover:text-success' : 'text-muted-foreground'}`}
                title="Toggle random seed (-1)"
                aria-label="Toggle random seed"
                onclick={() => handleToggleRandomSeed(index, sample.seed ?? -1)}
              >
                <Dices size={14} />
              </Button>
            </div>
          </Table.Cell>
          <Table.Cell class="w-auto p-2">
            <TextInput
              aria-label="Prompt Text"
              class="h-[30px] min-w-0 w-full text-sm px-2"
              value={sample.prompt ?? ''}
              onChange={(val) => handlePromptChange(index, val)}
            />
          </Table.Cell>
          <Table.Cell class="w-[100px] text-right p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-foreground"
              title="Edit sample prompt"
              aria-label="Edit sample prompt"
              onclick={() => onEditModal(index)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-foreground"
              title="Clone sample prompt"
              aria-label="Clone sample prompt"
              onclick={() => onClone(index)}
            >
              <Copy size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-destructive"
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

  <div class="p-2.5 text-center bg-black/10">
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="border-dashed text-primary hover:bg-primary/10 hover:text-primary gap-1.5"
      onclick={onAdd}
    >
      <Plus size={16} /> Add Sample Prompt
    </Button>
  </div>
</div>
