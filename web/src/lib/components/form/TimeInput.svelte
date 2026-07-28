<script lang="ts">
  import NumberInput from './NumericDraftInput.svelte';
  import Select from './ValueSelect.svelte';

  let {
    id,
    value = '',
    unit = 'MINUTE',
    unitOptions = [
      { value: 'NEVER', label: 'Never' },
      { value: 'EPOCH', label: 'Epochs' },
      { value: 'STEP', label: 'Steps' },
      { value: 'SECOND', label: 'Seconds' },
      { value: 'MINUTE', label: 'Minutes' },
      { value: 'HOUR', label: 'Hours' },
      { value: 'ALWAYS', label: 'Always' },
    ],
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
</script>

<div class="time-input-group flex items-center gap-2 max-w-[280px] w-full">
  <NumberInput
    {id}
    {value}
    {disabled}
    {ariaDescribedBy}
    class="flex-1 min-w-0"
    onInput={onValueInput}
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
</style>
