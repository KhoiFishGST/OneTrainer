<script lang="ts">
  import { untrack } from 'svelte';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import Select from '$lib/components/form/Select.svelte';
  import Toggle from '$lib/components/form/Toggle.svelte';
  import { getRouteContext } from '$lib/config/context';

  import type { RouteContext } from '$lib/config/context';

  let {
    open = $bindable(false),
    values = {},
    onSave = () => {},
  } = $props<{
    open: boolean;
    values?: Record<string, any>;
    onSave?: (updatedValues: Record<string, any>) => void;
  }>();

  let ctx: RouteContext | null = null;
  try {
    ctx = getRouteContext();
  } catch {
    ctx = null;
  }

  const FALLBACK_OPTIMIZER_SCHEMAS: Record<
    string,
    Record<string, { label: string; tooltip: string; type: string; default: any }>
  > = {
    ADAMW: {
      beta1: { label: 'Beta 1', tooltip: 'Optimizer momentum term', type: 'float', default: 0.9 },
      beta2: { label: 'Beta 2', tooltip: 'Coefficients for computing running averages of gradient', type: 'float', default: 0.999 },
      eps: { label: 'EPS', tooltip: 'Small value to prevent division by zero', type: 'float', default: 1e-8 },
      weight_decay: { label: 'Weight Decay', tooltip: 'Regularization to prevent overfitting', type: 'float', default: 0.01 },
      amsgrad: { label: 'AMSGrad', tooltip: 'Use AMSGrad variant', type: 'bool', default: false },
      foreach: { label: 'ForEach', tooltip: 'Use foreach implementation', type: 'bool', default: false },
      maximize: { label: 'Maximize', tooltip: 'Maximize optimization function', type: 'bool', default: false },
      capturable: { label: 'Capturable', tooltip: 'Capturable property', type: 'bool', default: false },
      differentiable: { label: 'Differentiable', tooltip: 'Differentiable optimization function', type: 'bool', default: false },
      fused: { label: 'Fused', tooltip: 'Use fused implementation', type: 'bool', default: true },
      stochastic_rounding: { label: 'Stochastic Rounding', tooltip: 'Stochastic rounding for weight updates', type: 'bool', default: false },
      fused_back_pass: { label: 'Fused Back Pass', tooltip: 'Fuse back propagation pass with optimizer step', type: 'bool', default: false },
    },
    ADAMW_ADV: {
      beta1: { label: 'Beta 1', tooltip: 'Optimizer momentum term', type: 'float', default: 0.9 },
      beta2: { label: 'Beta 2', tooltip: 'Coefficients for computing running averages of gradient', type: 'float', default: 0.999 },
      weight_decay: { label: 'Weight Decay', tooltip: 'Regularization to prevent overfitting', type: 'float', default: 0.01 },
      eps: { label: 'EPS', tooltip: 'Small value to prevent division by zero', type: 'float', default: 1e-8 },
      amsgrad: { label: 'AMSGrad', tooltip: 'Use AMSGrad variant', type: 'bool', default: false },
      decouple: { label: 'Decouple', tooltip: 'Use AdamW style decoupled weight decay', type: 'bool', default: true },
      fused_back_pass: { label: 'Fused Back Pass', tooltip: 'Fuse back propagation pass', type: 'bool', default: false },
      stochastic_rounding: { label: 'Stochastic Rounding', tooltip: 'Stochastic rounding for weight updates', type: 'bool', default: false },
    },
    MUON: {
      momentum: { label: 'Momentum', tooltip: 'Factor to accelerate SGD', type: 'float', default: 0.95 },
      weight_decay: { label: 'Weight Decay', tooltip: 'Regularization to prevent overfitting', type: 'float', default: 0.0 },
      ns_steps: { label: 'Newton-Schulz Iterations', tooltip: 'Iterations for update orthogonalization', type: 'int', default: 5 },
      MuonWithAuxAdam: { label: 'MuonWithAuxAdam', tooltip: 'Non-hidden layers fallback to AdamW', type: 'bool', default: true },
      muon_adam_lr: { label: 'Auxiliary Adam LR', tooltip: 'Learning rate for auxiliary AdamW optimizer', type: 'float', default: 0.0003 },
      normuon_variant: { label: 'NorMuon Variant', tooltip: 'NorMuon optimizer variant', type: 'bool', default: false },
    },
    PRODIGY: {
      beta1: { label: 'Beta 1', tooltip: 'Optimizer momentum term', type: 'float', default: 0.9 },
      beta2: { label: 'Beta 2', tooltip: 'Coefficients for computing running averages of gradient', type: 'float', default: 0.999 },
      beta3: { label: 'Beta 3', tooltip: 'Coefficient for computing Prodigy stepsize', type: 'float', default: 0 },
      weight_decay: { label: 'Weight Decay', tooltip: 'Regularization to prevent overfitting', type: 'float', default: 0.0 },
      eps: { label: 'EPS', tooltip: 'Small value to prevent division by zero', type: 'float', default: 1e-8 },
      d0: { label: 'Initial D', tooltip: 'Initial D estimate for D-adaptation', type: 'float', default: 1e-6 },
      d_coef: { label: 'D Coefficient', tooltip: 'Coefficient for estimate of d', type: 'float', default: 1.0 },
      use_bias_correction: { label: 'Bias Correction', tooltip: 'Turn on Adam bias correction', type: 'bool', default: false },
      safeguard_warmup: { label: 'Safeguard Warmup', tooltip: 'Avoid issues during warm-up stage', type: 'bool', default: false },
      slice_p: { label: 'Slice Parameters', tooltip: 'Slice parameter reduction factor', type: 'int', default: 11 },
    },
    ADAFACTOR: {
      eps: { label: 'EPS', tooltip: 'Small value to prevent division by zero', type: 'float', default: 1e-30 },
      eps2: { label: 'EPS 2', tooltip: 'Second EPS value', type: 'float', default: 1e-3 },
      clip_threshold: { label: 'Clip Threshold', tooltip: 'Clipping value for gradients', type: 'float', default: 1.0 },
      decay_rate: { label: 'Decay Rate', tooltip: 'Rate of decay for moment estimation', type: 'float', default: -0.8 },
      weight_decay: { label: 'Weight Decay', tooltip: 'Regularization to prevent overfitting', type: 'float', default: 0.0 },
      scale_parameter: { label: 'Scale Parameter', tooltip: 'Scale parameter', type: 'bool', default: false },
      relative_step: { label: 'Relative Step', tooltip: 'Use relative step size', type: 'bool', default: false },
      warmup_init: { label: 'Warmup Initialization', tooltip: 'Warm-up optimizer initialization', type: 'bool', default: false },
    },
    SGD: {
      momentum: { label: 'Momentum', tooltip: 'Factor to accelerate SGD', type: 'float', default: 0.9 },
      dampening: { label: 'Dampening', tooltip: 'Dampening for momentum', type: 'float', default: 0.0 },
      weight_decay: { label: 'Weight Decay', tooltip: 'Regularization to prevent overfitting', type: 'float', default: 0.0 },
      nesterov: { label: 'Nesterov', tooltip: 'Enable Nesterov momentum', type: 'bool', default: false },
    },
  };

  const optimizerSubSchemas = $derived(
    ctx?.meta?.optimizer_sub_schemas || FALLBACK_OPTIMIZER_SCHEMAS
  );

  const optimizerOptions = $derived(
    Object.keys(optimizerSubSchemas).map((key) => ({
      value: key,
      label: key,
    }))
  );

  let localOptimizer = $state('ADAMW');
  let localParams = $state<Record<string, any>>({});

  const currentFieldSpecs = $derived(
    optimizerSubSchemas[localOptimizer] || optimizerSubSchemas['ADAMW'] || {}
  );

  const currentParamKeys = $derived(Object.keys(currentFieldSpecs));

  $effect(() => {
    if (open) {
      untrack(() => {
        const opt = values?.optimizer?.optimizer || values?.optimizer || 'ADAMW';
        localOptimizer = typeof opt === 'string' && optimizerSubSchemas[opt] ? opt : 'ADAMW';
        const params = { ...(values?.optimizer_params || {}) };

        const specs = optimizerSubSchemas[localOptimizer] || {};
        for (const [key, spec] of Object.entries(specs)) {
          if (params[key] === undefined && (spec as any).default !== undefined) {
            params[key] = (spec as any).default;
          }
        }
        localParams = params;
      });
    }
  });

  function handleOptimizerChange(newOpt: string) {
    localOptimizer = newOpt;
    const specs = optimizerSubSchemas[newOpt] || {};
    const defaults: Record<string, any> = {};
    for (const [key, spec] of Object.entries(specs)) {
      defaults[key] = (spec as any).default;
    }
    localParams = defaults;
  }

  function handleLoadDefaults() {
    const specs = optimizerSubSchemas[localOptimizer] || {};
    const defaults: Record<string, any> = {};
    for (const [key, spec] of Object.entries(specs)) {
      defaults[key] = (spec as any).default;
    }
    localParams = defaults;
  }

  function handleApply() {
    onSave({
      optimizer: localOptimizer,
      optimizer_params: localParams,
    });
    open = false;
  }
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
          options={optimizerOptions}
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
        {@const spec = currentFieldSpecs[key] || { label: key, tooltip: '', type: 'float' }}
        <div class="param-item">
          {#if spec.type === 'bool'}
            <div class="bool-row">
              <span class="param-label" title={spec.tooltip}>{spec.label}</span>
              <Toggle
                id={`param-${key}`}
                value={!!localParams[key]}
                onChange={(val) => (localParams[key] = val)}
              />
            </div>
          {:else}
            <label for={`param-${key}`} class="param-label" title={spec.tooltip}>
              {spec.label}
            </label>
            <input
              id={`param-${key}`}
              type={spec.type === 'int' || spec.type === 'float' ? 'number' : 'text'}
              step={spec.type === 'float' ? 'any' : '1'}
              class="param-input"
              value={localParams[key] ?? ''}
              oninput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                localParams[key] = spec.type === 'int' || spec.type === 'float' ? Number(val) : val;
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
