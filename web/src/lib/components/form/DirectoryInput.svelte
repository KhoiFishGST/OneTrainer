<script lang="ts">
  import { FolderOpen } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import { getRouteContext } from '$lib/config/context';

  let {
    id,
    value = '',
    disabled = false,
    ariaDescribedBy,
    placeholder = '',
    buttonLabel = '',
    onInput,
    onOpenDirectory,
  }: {
    id: string;
    value?: string;
    disabled?: boolean;
    ariaDescribedBy?: string;
    placeholder?: string;
    buttonLabel?: string;
    onInput: (val: string) => void;
    onOpenDirectory?: (currentPath: string, onSelect?: (selectedPath: string) => void) => void;
  } = $props();

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
  <TextInput
    {id}
    {value}
    {disabled}
    {placeholder}
    {ariaDescribedBy}
    class="directory-input"
    onInput={onInput}
  />
  <Button
    variant="secondary"
    class="directory-btn"
    aria-label="Browse directory"
    {disabled}
    onclick={handleOpen}
  >
    <FolderOpen size={16} />
    {#if buttonLabel}
      <span>{buttonLabel}</span>
    {/if}
  </Button>
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

  /* Bits UI boundary: style TextInput child component */
  .directory-input-wrapper :global(.directory-input) {
    flex: 1 1 0%;
    min-width: 0;
    width: 100%;
    height: 38px;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border, #2d3741);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--muted, #14191f);
    color: var(--foreground, #e6ebef);
    box-sizing: border-box;
  }

  /* Bits UI boundary: style TextInput child component focus state */
  .directory-input-wrapper :global(.directory-input:focus) {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  /* Bits UI boundary: style Button child component */
  .directory-input-wrapper :global(.directory-btn) {
    flex: 0 0 auto;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0 0.75rem;
    border: 1px solid var(--border, #2d3741);
    border-radius: 6px;
    background: var(--muted, #14191f);
    color: var(--foreground, #e6ebef);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    white-space: nowrap;
  }

  /* Bits UI boundary: style Button child component hover state */
  .directory-input-wrapper :global(.directory-btn:hover:not(:disabled)) {
    background: var(--card, #1d242c);
  }
</style>
