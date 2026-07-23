<script lang="ts">
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

  function handleUnitChange(e: Event) {
    const u = (e.target as HTMLSelectElement).value;
    onUnitChange(u);
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
  <select
    value={unit ?? ''}
    {disabled}
    aria-label="Time unit"
    onchange={handleUnitChange}
    class="time-unit-select"
  >
    {#each parsedUnits as u}
      <option value={u.value}>{u.label}</option>
    {/each}
  </select>
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
    width: 120px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }

  .time-value-input:focus,
  .time-unit-select:focus {
    outline: none;
    border-color: var(--color-primary, var(--accent, #dd773b));
    box-shadow: 0 0 0 2px rgba(221, 119, 59, 0.2);
  }

  .time-unit-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }
</style>
