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
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, #ffffff);
    color: var(--color-text, #111827);
    box-sizing: border-box;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--color-primary, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
</style>
