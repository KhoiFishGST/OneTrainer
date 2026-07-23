<script lang="ts">
  let {
    id,
    value = '',
    disabled = false,
    ariaDescribedBy,
    placeholder = '',
    onInput,
  }: {
    id: string;
    value?: string;
    disabled?: boolean;
    ariaDescribedBy?: string;
    placeholder?: string;
    onInput: (val: string) => void;
  } = $props();

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    onInput(val);
  }
</script>

<input
  type="text"
  {id}
  value={value ?? ''}
  {disabled}
  {placeholder}
  aria-describedby={ariaDescribedBy}
  oninput={handleInput}
  class="text-input"
/>

<style>
  .text-input {
    min-width: 200px;
    max-width: 340px;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--color-primary, var(--accent, #dd773b));
    box-shadow: 0 0 0 2px rgba(221, 119, 59, 0.2);
  }
</style>
