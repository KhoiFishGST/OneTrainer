<script lang="ts">
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import Select from '$lib/components/form/Select.svelte';
  import Toggle from '$lib/components/form/Toggle.svelte';

  let {
    open = $bindable(false),
    values = {},
    onSave = () => {},
  } = $props<{
    open: boolean;
    values?: Record<string, any>;
    onSave?: (updatedValues: Record<string, any>) => void;
  }>();

  const OPTIMIZER_OPTIONS = [
    { value: 'ADAMW', label: 'AdamW' },
    { value: 'ADAMW_ADV', label: 'AdamW (Advanced)' },
    { value: 'MUON', label: 'Muon' },
    { value: 'PRODIGY', label: 'Prodigy' },
    { value: 'ADAFACTOR', label: 'Adafactor' },
    { value: 'SGD', label: 'SGD' },
    { value: 'ADAGRAD', label: 'Adagrad' },
    { value: 'ADAM', label: 'Adam' },
    { value: 'LION', label: 'Lion' },
    { value: 'SOPHIA', label: 'Sophia' },
  ];

  // Default parameters map per optimizer (mirrors OPTIMIZER_DEFAULT_PARAMETERS from optimizer_util.py)
  const OPTIMIZER_DEFAULTS: Record<string, Record<string, any>> = {
    ADAMW: {
      beta1: 0.9,
      beta2: 0.999,
      weight_decay: 0.01,
      eps: 1e-8,
      fused: false,
    },
    ADAMW_ADV: {
      beta1: 0.9,
      beta2: 0.999,
      weight_decay: 0.01,
      eps: 1e-8,
      amsgrad: false,
      decouple: true,
      fused_back_pass: false,
      stochastic_rounding: false,
    },
    MUON: {
      beta1: 0.95,
      beta2: 0.95,
      weight_decay: 0.01,
      ns_steps: 5,
      MuonWithAuxAdam: true,
      muon_adam_lr: 0.0001,
      normuon_variant: false,
    },
    PRODIGY: {
      beta1: 0.9,
      beta2: 0.999,
      beta3: 0,
      weight_decay: 0.01,
      eps: 1e-8,
      d0: 1e-6,
      d_coef: 1.0,
      growth_rate: 0,
      use_bias_correction: true,
      safeguard_warmup: true,
    },
    ADAFACTOR: {
      beta1: 0.0,
      decay_rate: -0.8,
      eps: 1e-30,
      eps2: 1e-3,
      clip_threshold: 1.0,
      relative_step: false,
      scale_parameter: false,
      warmup_init: false,
    },
    SGD: {
      momentum: 0.9,
      dampening: 0,
      weight_decay: 0,
      nesterov: false,
    },
  };

  const PARAM_METADATA: Record<
    string,
    { title: string; tooltip: string; type: 'float' | 'int' | 'bool' | 'str' }
  > = {
    beta1: { title: 'Beta 1', tooltip: 'Optimizer momentum term', type: 'float' },
    beta2: { title: 'Beta 2', tooltip: 'Coefficients for computing running averages of gradient', type: 'float' },
    beta3: { title: 'Beta 3', tooltip: 'Coefficient for computing Prodigy stepsize', type: 'float' },
    weight_decay: { title: 'Weight Decay', tooltip: 'Regularization to prevent overfitting', type: 'float' },
    eps: { title: 'EPS', tooltip: 'Small value to prevent division by zero', type: 'float' },
    eps2: { title: 'EPS 2', tooltip: 'Second EPS value', type: 'float' },
    amsgrad: { title: 'AMSGrad', tooltip: 'Use AMSGrad variant', type: 'bool' },
    decouple: { title: 'Decouple', tooltip: 'Use AdamW style decoupled weight decay', type: 'bool' },
    fused: { title: 'Fused', tooltip: 'Use fused implementation', type: 'bool' },
    fused_back_pass: { title: 'Fused Back Pass', tooltip: 'Fuse back propagation pass with optimizer step', type: 'bool' },
    stochastic_rounding: { title: 'Stochastic Rounding', tooltip: 'Stochastic rounding for weight updates', type: 'bool' },
    is_paged: { title: 'Is Paged', tooltip: 'Page optimizer state to CPU', type: 'bool' },
    nnmf_factor: { title: 'Factored Optimizer', tooltip: 'Apply low-rank factorization to optimizer states', type: 'bool' },
    use_atan2: { title: 'Atan2 Scaling', tooltip: 'Replacement for eps with gradient clipping', type: 'bool' },
    cautious_wd: { title: 'Cautious Weight Decay', tooltip: 'Apply weight decay only when signs align', type: 'bool' },
    compile: { title: 'Compiled Optimizer', tooltip: 'Enable PyTorch compilation for optimizer step', type: 'bool' },
    momentum: { title: 'Momentum', tooltip: 'Factor to accelerate SGD', type: 'float' },
    dampening: { title: 'Dampening', tooltip: 'Dampening for momentum', type: 'float' },
    nesterov: { title: 'Nesterov', tooltip: 'Enable Nesterov momentum', type: 'bool' },
    ns_steps: { title: 'Newton-Schulz Iterations', tooltip: 'Iterations for update orthogonalization', type: 'int' },
    MuonWithAuxAdam: { title: 'MuonWithAuxAdam', tooltip: 'Non-hidden layers fallback to AdamW', type: 'bool' },
    muon_adam_lr: { title: 'Auxiliary Adam LR', tooltip: 'Learning rate for auxiliary AdamW optimizer', type: 'float' },
    normuon_variant: { title: 'NorMuon Variant', tooltip: 'NorMuon optimizer variant', type: 'bool' },
    d0: { title: 'Initial D', tooltip: 'Initial D estimate for D-adaptation', type: 'float' },
    d_coef: { title: 'D Coefficient', tooltip: 'Coefficient for estimate of d', type: 'float' },
    growth_rate: { title: 'Growth Rate', tooltip: 'Limit for D estimate growth rate', type: 'float' },
    use_bias_correction: { title: 'Bias Correction', tooltip: 'Turn on Adam bias correction', type: 'bool' },
    safeguard_warmup: { title: 'Safeguard Warmup', tooltip: 'Avoid issues during warm-up stage', type: 'bool' },
    decay_rate: { title: 'Decay Rate', tooltip: 'Rate of decay for moment estimation', type: 'float' },
    clip_threshold: { title: 'Clip Threshold', tooltip: 'Clipping value for gradients', type: 'float' },
    relative_step: { title: 'Relative Step', tooltip: 'Use relative step size', type: 'bool' },
    scale_parameter: { title: 'Scale Parameter', tooltip: 'Scale parameter', type: 'bool' },
    warmup_init: { title: 'Warmup Initialization', tooltip: 'Warm-up optimizer initialization', type: 'bool' },
  };

  let localOptimizer = $state('ADAMW');
  let localParams = $state<Record<string, any>>({});

  $effect(() => {
    if (open) {
      const opt = values?.optimizer?.optimizer || values?.optimizer || 'ADAMW';
      localOptimizer = typeof opt === 'string' ? opt : 'ADAMW';
      localParams = { ...(values?.optimizer_params || {}) };

      // Initialize with defaults if empty
      const defaults = OPTIMIZER_DEFAULTS[localOptimizer] || {};
      for (const [key, val] of Object.entries(defaults)) {
        if (localParams[key] === undefined) {
          localParams[key] = val;
        }
      }
    }
  });

  function handleOptimizerChange(newOpt: string) {
    localOptimizer = newOpt;

    // Load defaults for newly selected optimizer
    const defaults = OPTIMIZER_DEFAULTS[newOpt] || {};
    localParams = { ...defaults };
  }

  function handleLoadDefaults() {
    const defaults = OPTIMIZER_DEFAULTS[localOptimizer] || {};
    localParams = { ...defaults };
  }

  function handleApply() {
    onSave({
      optimizer: localOptimizer,
      optimizer_params: localParams,
    });
    open = false;
  }

  const currentParamKeys = $derived(
    Object.keys(OPTIMIZER_DEFAULTS[localOptimizer] || {
      beta1: 0.9,
      beta2: 0.999,
      weight_decay: 0.01,
      eps: 1e-8,
    })
  );
</script>

<ModalDialog
  bind:open
  title="Configure Optimizer Parameters"
  width="wide"
  applyText="Apply Parameters"
  onApply={handleApply}
  onClose={() => (open = false)}
>
  <div class="opt-modal-body">
    <!-- Header Bar: Optimizer Dropdown & Load Defaults -->
    <div class="header-bar">
      <div class="header-field">
        <label for="modal-optimizer-select" class="header-label">Optimizer</label>
        <Select
          id="modal-optimizer-select"
          value={localOptimizer}
          options={OPTIMIZER_OPTIONS}
          onChange={handleOptimizerChange}
        />
      </div>

      <button
        type="button"
        class="defaults-btn"
        title="Reset parameters to standard defaults for this optimizer"
        onclick={handleLoadDefaults}
      >
        Load Defaults
      </button>
    </div>

    <div class="params-divider"></div>

    <!-- Dynamic Parameter Controls -->
    <div class="params-grid">
      {#each currentParamKeys as key (key)}
        {@const meta = PARAM_METADATA[key] || { title: key, tooltip: '', type: 'float' }}
        <div class="param-item">
          {#if meta.type === 'bool'}
            <div class="bool-row">
              <span class="param-label" title={meta.tooltip}>{meta.title}</span>
              <Toggle
                id={`param-${key}`}
                value={!!localParams[key]}
                onChange={(val) => (localParams[key] = val)}
              />
            </div>
          {:else}
            <label for={`param-${key}`} class="param-label" title={meta.tooltip}>
              {meta.title}
            </label>
            <input
              id={`param-${key}`}
              type={meta.type === 'int' || meta.type === 'float' ? 'number' : 'text'}
              step={meta.type === 'float' ? 'any' : '1'}
              class="param-input"
              value={localParams[key] ?? ''}
              oninput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                localParams[key] = meta.type === 'int' || meta.type === 'float' ? Number(val) : val;
              }}
            />
          {/if}
        </div>
      {/each}
    </div>
  </div>
</ModalDialog>

<style>
  .opt-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header-bar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }

  .header-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex: 1;
    max-width: 320px;
  }

  .header-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .defaults-btn {
    height: 38px;
    padding: 0 1rem;
    background: var(--panel-raised, #252d37);
    border: 1px solid var(--line, #334155);
    border-radius: 6px;
    color: var(--text, #e2e8f0);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .defaults-btn:hover {
    background: var(--line, #334155);
    color: var(--accent, #3b82f6);
    border-color: var(--accent, #3b82f6);
  }

  .params-divider {
    height: 1px;
    background-color: var(--line, #2d3741);
    margin: 0.25rem 0;
  }

  .params-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .param-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .bool-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 38px;
    padding: 0 0.75rem;
    background: var(--panel-raised, rgba(255, 255, 255, 0.02));
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
  }

  .param-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted, #94a3b8);
  }

  .param-input {
    height: 38px;
    padding: 0 0.75rem;
    background-color: var(--input-bg, #0f1419);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    color: var(--text, #f8fafc);
    font-size: 0.875rem;
    outline: none;
  }

  .param-input:focus {
    border-color: var(--accent, #3b82f6);
  }
</style>
