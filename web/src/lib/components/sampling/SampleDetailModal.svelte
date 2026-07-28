<script lang="ts">
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
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

  $effect(() => {
    if (open) {
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
    }
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
    <div class="sample-modal-body">
      <div class="form-row">
        <label for="sample-prompt">Prompt</label>
        <TextArea
          id="sample-prompt"
          value={draft.prompt}
          onInput={(val) => (draft.prompt = val)}
          rows={3}
          placeholder="Enter generation prompt..."
        />
      </div>

      <div class="form-row">
        <label for="sample-negative-prompt">Negative Prompt</label>
        <TextArea
          id="sample-negative-prompt"
          value={draft.negative_prompt}
          onInput={(val) => (draft.negative_prompt = val)}
          rows={2}
          placeholder="Enter negative prompt..."
        />
      </div>

      <div class="form-row inline">
        <label for="sample-enabled">Enabled</label>
        <Checkbox
          id="sample-enabled"
          value={draft.enabled}
          onChange={(val) => (draft.enabled = val)}
        />
      </div>

      <div class="resolution-section">
        <div class="resolution-header">
          <span class="section-label">Resolution</span>
          <div class="preset-buttons">
            <Button
              type="button"
              class={`preset-btn ${isPresetResolution(512) ? 'active' : ''}`}
              onclick={() => setPresetResolution(512)}
            >
              512
            </Button>
            <Button
              type="button"
              class={`preset-btn ${isPresetResolution(768) ? 'active' : ''}`}
              onclick={() => setPresetResolution(768)}
            >
              768
            </Button>
            <Button
              type="button"
              class={`preset-btn ${isPresetResolution(1024) ? 'active' : ''}`}
              onclick={() => setPresetResolution(1024)}
            >
              1024
            </Button>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label for="sample-width">Width</label>
            <NumberInput
              id="sample-width"
              type="text"
              step="64"
              min="64"
              value={draft.width}
              onInput={(val) => setDraftNumber('width', val)}
            />
          </div>
          <div class="form-row">
            <label for="sample-height">Height</label>
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

      <div class="form-grid-2">
        <div class="form-row">
          <label for="sample-steps">Diffusion Steps</label>
          <NumberInput
            id="sample-steps"
            type="text"
            min="1"
            max="150"
            value={draft.diffusion_steps}
            onInput={(val) => setDraftNumber('diffusion_steps', val)}
          />
        </div>
        <div class="form-row">
          <label for="sample-cfg">CFG Scale</label>
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

      <div class="form-grid-2">
        <div class="form-row">
          <label for="sample-seed">Seed (-1 for random)</label>
          <NumberInput
            id="sample-seed"
            type="text"
            value={draft.seed}
            onInput={(val) => setDraftNumber('seed', val)}
          />
        </div>
        <div class="form-row">
          <label for="sample-scheduler">Noise Scheduler</label>
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
      <div class="dialog-actions-footer">
        <Button
          type="button"
          variant="secondary"
          onclick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onclick={handleSave}
        >
          {mode === 'add' ? 'Add Sample' : 'Save Sample'}
        </Button>
      </div>
    {/snippet}
  </ResponsiveDialogDrawer>
{/if}

<style>
  .dialog-actions-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    width: 100%;
  }

  .sample-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-row.inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .form-row label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text, #f8fafc);
  }

  .form-row :global(.textarea-input),
  .form-row :global(.number-input) {
    padding: 0.5rem 0.75rem;
    background-color: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
    font-family: inherit;
  }

  .form-row :global(.textarea-input:focus),
  .form-row :global(.number-input:focus) {
    outline: none;
    border-color: var(--accent, #3b82f6);
  }

  .form-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .resolution-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
  }

  .resolution-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text, #f8fafc);
  }

  .preset-buttons {
    display: flex;
    gap: 0.375rem;
  }

  .preset-buttons :global(.preset-btn) {
    min-height: 0;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid var(--line, #2d3741);
    background: var(--panel-raised, #1d242c);
    color: var(--muted, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-buttons :global(.preset-btn:hover) {
    color: var(--text, #f8fafc);
    border-color: var(--accent, #3b82f6);
  }

  .preset-buttons :global(.preset-btn.active) {
    background: var(--accent, #3b82f6);
    color: #ffffff;
    border-color: var(--accent, #3b82f6);
  }
</style>
