<script lang="ts">
  import Select from './Select.svelte';

  let {
    id,
    value = '',
    unit = 'seconds',
    unitOptions = ['seconds', 'minutes', 'hours', 'epochs', 'steps'],
    disabled = false,
    ariaDescribedBy,
    onValueInput,
    onUnitChange,
  }: {
    id: string;
    value?: number | string;
    unit?: string;
    unitOptions?: Array<{ value: string; label: string } | string>;
    disabled?: boolean;
    ariaDescribedBy?: string;
    onValueInput: (val: string) => void;
    onUnitChange: (unit: string) => void;
  } = $props();

  const parsedUnits = $derived(
    unitOptions.map((opt) =>
      typeof opt === 'object' && opt !== null
        ? { value: opt.value, label: opt.label }
        : { value: opt, label: String(opt) }
    )
  );

  function handleValueInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    onValueInput(val);
  }
</script>

<div class="time-input-group">
  <input
    type="text"
    inputmode="decimal"
    {id}
    value={value ?? ''}
    {disabled}
    aria-describedby={ariaDescribedBy}
    oninput={handleValueInput}
    class="time-value-input"
  />
  <div class="time-unit-select-wrapper">
    <Select
      ariaLabel="Time unit"
      value={unit ?? ''}
      options={parsedUnits}
      {disabled}
      onChange={onUnitChange}
    />
  </div>
</div>

<style>
  .time-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 280px;
    width: 100%;
  }

  .time-value-input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }

  .time-value-input:focus {
    outline: none;
    border-color: var(--color-primary, var(--accent, #3b82f6));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
</style>
