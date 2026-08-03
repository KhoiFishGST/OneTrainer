<script lang="ts">
  import { Dices, Pencil, Copy, Trash2, Plus } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';

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

<div class="w-full flex flex-col gap-4">
  <div class="flex flex-col gap-4">
    {#each samples as sample, index (sample.webui_id || index)}
      <Card.Root class={`p-4 bg-card border-border rounded-lg ${!sample.enabled ? 'opacity-60' : ''}`}>
        <Card.Header class="flex items-center justify-between p-0 pb-3 border-b border-border">
          <div class="flex items-center gap-3">
            <Switch
              ariaLabel={`Enable sample prompt ${index + 1}`}
              value={sample.enabled}
              onChange={(checked) => handleEnabledChange(index, checked)}
            />
            <Badge variant="secondary" class="text-xs font-semibold shrink-0">#{index + 1}</Badge>
            <span class="text-sm font-medium truncate text-foreground">{sample.prompt}</span>
          </div>

          <div class="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-foreground"
              title="Edit sample prompt"
              aria-label="Edit sample prompt"
              onclick={() => onEditModal(index)}
            >
              <Pencil size={15} />
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
              <Copy size={15} />
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
              <Trash2 size={15} />
            </Button>
          </div>
        </Card.Header>

        <Card.Content class="flex flex-col gap-3 p-0 pt-3">
          <div class="flex flex-col gap-1.5">
            <label for={`card-prompt-${index}`} class="text-xs font-medium text-muted-foreground">Prompt Text</label>
            <TextInput
              id={`card-prompt-${index}`}
              aria-label="Prompt Text"
              ariaLabel="Prompt Text"
              class="h-[30px] w-full text-sm px-2"
              bind:value={sample.prompt}
              onChange={(val) => handlePromptChange(index, val)}
            />
          </div>



          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="flex flex-col gap-1.5">
              <label for={`card-width-${index}`} class="text-xs font-medium text-muted-foreground">Width</label>
              <NumberInput
                id={`card-width-${index}`}
                class="h-[30px] w-full text-xs px-1.5"
                value={getDraftOrValue(sample, index, 'width', 512)}
                onInput={(val) => onDraftChange(index, 'width', val)}
                onChange={(val) => handleWidthChange(index, val)}
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for={`card-height-${index}`} class="text-xs font-medium text-muted-foreground">Height</label>
              <NumberInput
                id={`card-height-${index}`}
                class="h-[30px] w-full text-xs px-1.5"
                value={getDraftOrValue(sample, index, 'height', 512)}
                onInput={(val) => onDraftChange(index, 'height', val)}
                onChange={(val) => handleHeightChange(index, val)}
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for={`card-seed-${index}`} class="text-xs font-medium text-muted-foreground">Seed</label>
              <div class="flex items-center gap-1">
                <NumberInput
                  id={`card-seed-${index}`}
                  class="h-[30px] w-full min-w-0 text-xs px-1.5"
                  value={getDraftOrValue(sample, index, 'seed', -1)}
                  onInput={(val) => onDraftChange(index, 'seed', val)}
                  onChange={(val) => handleSeedChange(index, val)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  class={`shrink-0 h-[30px] w-11 min-w-11 max-md:min-h-11 ${(sample.seed ?? -1) === -1 ? 'active bg-success-surface text-success border-success/30 hover:bg-success-surface/80 hover:text-success' : 'text-muted-foreground'}`}
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

  <div class="p-2.5 text-center bg-black/10 rounded-md">
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
