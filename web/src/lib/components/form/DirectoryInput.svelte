<script lang="ts">
  import { FolderOpen } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';

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
    onOpenDirectory?: (currentPath: string, onSelect?: (selectedPath: string) => void) => void;
  } = $props();

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    onInput(val);
  }

  function handleOpen() {
    if (onOpenDirectory) {
      onOpenDirectory(value || '', (selectedPath: string) => {
        onInput(selectedPath);
      });
      return;
    }

    try {
      const ctx = getRouteContext();
      if (ctx.openDirectory) {
        ctx.openDirectory(value || '', (selectedPath: string) => {
          onInput(selectedPath);
        });
      }
    } catch {
      // Context not present
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
    gap: 0.375rem;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  .directory-input {
    flex: 1 1 0%;
    min-width: 0;
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }

  .directory-input:focus {
    outline: none;
    border-color: var(--color-primary, var(--accent, #3b82f6));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .directory-btn {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    background: var(--color-bg-button, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    cursor: pointer;
    box-sizing: border-box;
  }

  .directory-btn:hover:not(:disabled) {
    background: var(--color-bg-button-hover, var(--panel-raised, #1d242c));
  }
</style>
