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
    min-width: 180px;
    max-width: 280px;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }

  .select-input:focus {
    outline: none;
    border-color: var(--color-primary, var(--accent, #dd773b));
    box-shadow: 0 0 0 2px rgba(221, 119, 59, 0.2);
  }
</style>
