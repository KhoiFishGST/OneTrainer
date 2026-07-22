<script lang="ts">
  import { FolderOpen } from 'lucide-svelte';

  let {
    id,
    value = '',
    disabled = false,
    ariaDescribedBy,
    placeholder = '',
    onInput,
    onOpenDirectory,
  }: {
    id: string;
    value?: string;
    disabled?: boolean;
    ariaDescribedBy?: string;
    placeholder?: string;
    onInput: (val: string) => void;
    onOpenDirectory?: (currentPath: string) => void;
  } = $props();

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    onInput(val);
  }

  function handleOpen() {
    if (onOpenDirectory) {
      onOpenDirectory(value || '');
    }
  }
</script>

<div class="directory-input-wrapper">
  <input
    type="text"
    {id}
    value={value ?? ''}
    {disabled}
    {placeholder}
    aria-describedby={ariaDescribedBy}
    oninput={handleInput}
    class="directory-input"
  />
  <button
    type="button"
    class="directory-btn"
    aria-label="Browse directory"
    {disabled}
    onclick={handleOpen}
  >
    <FolderOpen size={16} />
  </button>
</div>

<style>
  .directory-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .directory-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, #ffffff);
    color: var(--color-text, #111827);
    box-sizing: border-box;
  }

  .directory-input:focus {
    outline: none;
    border-color: var(--color-primary, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }

  .directory-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 6px;
    background: var(--color-bg-button, #f9fafb);
    color: var(--color-text, #374151);
    cursor: pointer;
  }

  .directory-btn:hover:not(:disabled) {
    background: var(--color-bg-button-hover, #f3f4f6);
  }
</style>
