<script lang="ts">
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import Select from '$lib/components/form/Select.svelte';

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
    onSave: (sample: any) => void;
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

  function setPresetResolution(res: number) {
    draft.width = res;
    draft.height = res;
  }

  function handleSave() {
    onSave(draft);
  }
</script>

{#if open}
  <ModalDialog
    {open}
    title={mode === 'add' ? 'Add Sample Prompt' : 'Edit Sample Prompt'}
    applyText={mode === 'add' ? 'Add Sample' : 'Save Sample'}
    {onClose}
    onApply={handleSave}
  >
    <div class="sample-modal-body">
      <div class="form-row">
        <label for="sample-prompt">Prompt</label>
        <textarea
          id="sample-prompt"
          bind:value={draft.prompt}
          rows="3"
          placeholder="Enter generation prompt..."
        ></textarea>
      </div>

      <div class="form-row">
        <label for="sample-negative-prompt">Negative Prompt</label>
        <textarea
          id="sample-negative-prompt"
          bind:value={draft.negative_prompt}
          rows="2"
          placeholder="Enter negative prompt..."
        ></textarea>
      </div>

      <div class="form-row inline">
        <label for="sample-enabled">Enabled</label>
        <input
          id="sample-enabled"
          type="checkbox"
          bind:checked={draft.enabled}
        />
      </div>

      <div class="resolution-section">
        <div class="resolution-header">
          <span class="section-label">Resolution</span>
          <div class="preset-buttons">
            <button
              type="button"
              class="preset-btn"
              class:active={draft.width === 512 && draft.height === 512}
              onclick={() => setPresetResolution(512)}
            >
              512
            </button>
            <button
              type="button"
              class="preset-btn"
              class:active={draft.width === 768 && draft.height === 768}
              onclick={() => setPresetResolution(768)}
            >
              768
            </button>
            <button
              type="button"
              class="preset-btn"
              class:active={draft.width === 1024 && draft.height === 1024}
              onclick={() => setPresetResolution(1024)}
            >
              1024
            </button>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label for="sample-width">Width</label>
            <input
              id="sample-width"
              type="number"
              step="64"
              min="64"
              bind:value={draft.width}
            />
          </div>
          <div class="form-row">
            <label for="sample-height">Height</label>
            <input
              id="sample-height"
              type="number"
              step="64"
              min="64"
              bind:value={draft.height}
            />
          </div>
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-row">
          <label for="sample-steps">Diffusion Steps</label>
          <input
            id="sample-steps"
            type="number"
            min="1"
            max="150"
            bind:value={draft.diffusion_steps}
          />
        </div>
        <div class="form-row">
          <label for="sample-cfg">CFG Scale</label>
          <input
            id="sample-cfg"
            type="number"
            step="0.5"
            min="1"
            max="30"
            bind:value={draft.cfg_scale}
          />
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-row">
          <label for="sample-seed">Seed (-1 for random)</label>
          <input
            id="sample-seed"
            type="number"
            bind:value={draft.seed}
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
  </ModalDialog>
{/if}

<style>
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

  .form-row textarea,
  .form-row input[type='number'] {
    padding: 0.5rem 0.75rem;
    background-color: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
    font-family: inherit;
  }

  .form-row textarea:focus,
  .form-row input[type='number']:focus {
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

  .preset-btn {
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

  .preset-btn:hover {
    color: var(--text, #f8fafc);
    border-color: var(--accent, #3b82f6);
  }

  .preset-btn.active {
    background: var(--accent, #3b82f6);
    color: #ffffff;
    border-color: var(--accent, #3b82f6);
  }
</style>
