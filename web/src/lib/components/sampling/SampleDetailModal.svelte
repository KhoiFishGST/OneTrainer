<script lang="ts">
  import { untrack } from 'svelte';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';

  import { Button } from '$lib/components/ui/button';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import { Switch } from '$lib/components/ui/switch/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Textarea as TextArea } from '$lib/components/ui/textarea/index.js';

  let {
    open = false,
    sample = null,
    mode = 'add',
    onSave,
    onClose,
  }: {
    open: boolean;
    sample?: any;
    mode?: 'add' | 'edit';
    onSave: (sample: any) => Promise<void> | void;
    onClose: () => void;
  } = $props();

  const SCHEDULER_OPTIONS = [
    { value: 'EULER_A', label: 'Euler Ancestral (EULER_A)' },
    { value: 'DDIM', label: 'DDIM' },
    { value: 'EULER', label: 'Euler (EULER)' },
    { value: 'DPM_PLUS_PLUS_2M_KARRAS', label: 'DPM++ 2M Karras' },
    { value: 'DPM_PLUS_PLUS_SDE_KARRAS', label: 'DPM++ SDE Karras' },
    { value: 'LCM', label: 'LCM' },
    { value: 'HEUN', label: 'Heun' },
    { value: 'DPM_2', label: 'DPM 2' },
  ];

  type NumericField = 'width' | 'height' | 'diffusion_steps' | 'cfg_scale' | 'seed';

  const NUMERIC_FIELDS: NumericField[] = ['width', 'height', 'diffusion_steps', 'cfg_scale', 'seed'];
  const HTML_NUMBER_PATTERN = /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/;

  let draft = $state<any>({
    prompt: '',
    negative_prompt: '',
    enabled: true,
    width: 512,
    height: 512,
    diffusion_steps: 30,
    cfg_scale: 7.5,
    seed: -1,
    noise_scheduler: 'EULER_A',
  });

  let wasOpen = $state(false);


  $effect(() => {
    if (open && !wasOpen) {
      untrack(() => {
        draft = sample
          ? JSON.parse(JSON.stringify(sample))
          : {
              prompt: '',
              negative_prompt: '',
              enabled: true,
              width: 512,
              height: 512,
              diffusion_steps: 30,
              cfg_scale: 7.5,
              seed: -1,
              noise_scheduler: 'EULER_A',
            };
      });
    }
    wasOpen = open;
  });


  function normalizeDraftNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !HTML_NUMBER_PATTERN.test(value)) return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function setDraftNumber(key: NumericField, value: string) {
    draft[key] = value;
  }

  function setPresetResolution(res: number) {
    draft.width = res;
    draft.height = res;
  }

  function isPresetResolution(res: number) {
    return normalizeDraftNumber(draft.width) === res && normalizeDraftNumber(draft.height) === res;
  }

  async function handleSave() {
    const saved = { ...draft };
    for (const field of NUMERIC_FIELDS) saved[field] = normalizeDraftNumber(saved[field]);
    try {
      await onSave(saved);
    } catch (err) {
      console.error('Save failed in SampleDetailModal', err);
    }
  }
</script>

{#if open}
  <ResponsiveDialogDrawer
    {open}
    onOpenChange={(val) => {
      if (!val) onClose();
    }}
    title={mode === 'add' ? 'Add Sample Prompt' : 'Edit Sample Prompt'}
    class="max-w-xl"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="sample-prompt" class="text-sm font-medium text-foreground">Prompt</label>
        <TextArea
          id="sample-prompt"
          bind:value={draft.prompt}
          rows={3}
          placeholder="Enter generation prompt..."
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="sample-negative-prompt" class="text-sm font-medium text-foreground">Negative Prompt</label>
        <TextArea
          id="sample-negative-prompt"
          bind:value={draft.negative_prompt}
          rows={2}
          placeholder="Enter negative prompt..."
        />

      </div>

      <div class="flex items-center justify-between">
        <label for="sample-enabled" class="text-sm font-medium text-foreground">Enabled</label>
        <Switch
          id="sample-enabled"
          ariaLabel="Enabled"
          value={draft.enabled}
          onChange={(val) => (draft.enabled = val)}
        />
      </div>

      <div class="flex flex-col gap-3 p-3 bg-muted border border-border rounded-md">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-foreground">Resolution</span>
          <div class="flex gap-1.5">
            <Button
              type="button"
              variant={isPresetResolution(512) ? 'default' : 'outline'}
              size="xs"
              class={isPresetResolution(512) ? 'active' : ''}
              onclick={() => setPresetResolution(512)}
            >
              512
            </Button>
            <Button
              type="button"
              variant={isPresetResolution(768) ? 'default' : 'outline'}
              size="xs"
              class={isPresetResolution(768) ? 'active' : ''}
              onclick={() => setPresetResolution(768)}
            >
              768
            </Button>
            <Button
              type="button"
              variant={isPresetResolution(1024) ? 'default' : 'outline'}
              size="xs"
              class={isPresetResolution(1024) ? 'active' : ''}
              onclick={() => setPresetResolution(1024)}
            >
              1024
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="sample-width" class="text-sm font-medium text-foreground">Width</label>
            <NumberInput
              id="sample-width"
              type="text"
              step="64"
              min="64"
              value={draft.width}
              onInput={(val) => setDraftNumber('width', val)}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="sample-height" class="text-sm font-medium text-foreground">Height</label>
            <NumberInput
              id="sample-height"
              type="text"
              step="64"
              min="64"
              value={draft.height}
              onInput={(val) => setDraftNumber('height', val)}
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="sample-steps" class="text-sm font-medium text-foreground">Diffusion Steps</label>
          <NumberInput
            id="sample-steps"
            type="text"
            min="1"
            max="150"
            value={draft.diffusion_steps}
            onInput={(val) => setDraftNumber('diffusion_steps', val)}
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="sample-cfg" class="text-sm font-medium text-foreground">CFG Scale</label>
          <NumberInput
            id="sample-cfg"
            type="text"
            step="0.5"
            min="1"
            max="30"
            value={draft.cfg_scale}
            onInput={(val) => setDraftNumber('cfg_scale', val)}
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="sample-seed" class="text-sm font-medium text-foreground">Seed (-1 for random)</label>
          <NumberInput
            id="sample-seed"
            type="text"
            value={draft.seed}
            onInput={(val) => setDraftNumber('seed', val)}
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="sample-scheduler" class="text-sm font-medium text-foreground">Noise Scheduler</label>
          <Select
            id="sample-scheduler"
            value={draft.noise_scheduler}
            options={SCHEDULER_OPTIONS}
            onChange={(val) => (draft.noise_scheduler = val)}
          />
        </div>
      </div>
    </div>

    {#snippet footer()}
      <div class="flex items-center justify-end gap-3 w-full">
        <Button
          type="button"
          variant="secondary"
          onclick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          onclick={handleSave}
        >
          {mode === 'add' ? 'Add Sample' : 'Save Sample'}
        </Button>
      </div>
    {/snippet}
  </ResponsiveDialogDrawer>
{/if}
