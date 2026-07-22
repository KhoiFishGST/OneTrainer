<script lang="ts">
  let {
    id,
    value = '',
    options = [],
    disabled = false,
    ariaDescribedBy,
    onChange,
  }: {
    id: string;
    value?: any;
    options?: Array<{ value: any; label: string } | string>;
    disabled?: boolean;
    ariaDescribedBy?: string;
    onChange: (val: any) => void;
  } = $props();

  const parsedOptions = $derived(
    options.map((opt) =>
      typeof opt === 'object' && opt !== null
        ? { value: opt.value, label: opt.label }
        : { value: opt, label: String(opt) }
    )
  );

  function handleChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    onChange(val);
  }
</script>

<select
  {id}
  value={value ?? ''}
  {disabled}
  aria-describedby={ariaDescribedBy}
  onchange={handleChange}
  class="select-input"
>
  {#each parsedOptions as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>

<style>
  .select-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, #ffffff);
    color: var(--color-text, #111827);
    box-sizing: border-box;
  }

  .select-input:focus {
    outline: none;
    border-color: var(--color-primary, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
</style>
