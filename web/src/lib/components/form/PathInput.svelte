<script lang="ts">
  import { FolderOpen } from 'lucide-svelte';
  import DirectoryPicker from '$lib/components/directory/DirectoryPicker.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';

  let {
    id = `path-input-${Math.random().toString(36).slice(2, 9)}`,
    label = '',
    ariaLabel = '',
    value = $bindable(''),
    disabled = false,
    placeholder = '',
    mode = 'both',
    extensions = [],
    onInput,
    onChange,
  }: {
    id?: string;
    label?: string;
    ariaLabel?: string;
    value?: string;
    disabled?: boolean;
    placeholder?: string;
    mode?: 'dir' | 'file' | 'both';
    extensions?: string[];
    onInput?: (val: string) => void;
    onChange?: (val: string) => void;
  } = $props();

  let pickerOpen = $state(false);

  function handleTextInput(val: string) {
    value = val;
    onInput?.(val);
    onChange?.(val);
  }

  function handleSelect(selectedPath: string) {
    value = selectedPath;
    onInput?.(selectedPath);
    onChange?.(selectedPath);
    pickerOpen = false;
  }
</script>

<div class="path-input-container">
  {#if label}
    <div class="path-header">
      <label for={id} class="path-label">{label}</label>
      {#if extensions && extensions.length > 0}
        <div class="extension-tags">
          {#each extensions as ext}
            <span class="ext-tag">{ext}</span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <div class="path-input-wrapper">
    <TextInput
      {id}
      {value}
      {disabled}
      {placeholder}
      aria-label={ariaLabel || label || 'Path'}
      class="path-input"
      onInput={handleTextInput}
    />
    <Button
      variant="secondary"
      class="browse-btn"
      aria-label="Browse"
      {disabled}
      onclick={() => (pickerOpen = true)}
    >
      <FolderOpen size={16} />
      <span>Browse</span>
    </Button>
  </div>

  {#if value && mode !== 'dir'}
    <div class="file-preview-info">
      <span class="preview-label">Selected:</span>
      <span class="file-preview-name">{value.split(/[/\\]/).filter(Boolean).pop() || ''}</span>
    </div>
  {/if}
</div>

{#if pickerOpen}
  <DirectoryPicker
    open={pickerOpen}
    initialPath={value || '/'}
    {mode}
    {extensions}
    onSelect={handleSelect}
    onClose={() => (pickerOpen = false)}
  />
{/if}

<style>
  .path-input-container {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
  }

  .path-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .path-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground, #111827);
  }

  .extension-tags {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ext-tag {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: var(--muted, #f3f4f6);
    color: var(--primary, #2563eb);
    border: 1px solid var(--border, #e5e7eb);
    font-family: monospace;
  }

  .path-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  /* Bits UI boundary: style TextInput child component */
  .path-input-wrapper :global(.path-input) {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--muted, #ffffff);
    color: var(--foreground, #111827);
    box-sizing: border-box;
  }

  /* Bits UI boundary: style TextInput child component focus state */
  .path-input-wrapper :global(.path-input:focus) {
    outline: none;
    border-color: var(--primary, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }

  /* Bits UI boundary: style Button child component */
  .path-input-wrapper :global(.browse-btn) {
    min-height: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border, #d1d5db);
    border-radius: 6px;
    background: var(--muted, #f9fafb);
    color: var(--foreground, #374151);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  /* Bits UI boundary: style Button child component hover state */
  .path-input-wrapper :global(.browse-btn:hover:not(:disabled)) {
    background: var(--card, #f3f4f6);
  }

  /* Bits UI boundary: style Button child component disabled state */
  .path-input-wrapper :global(.browse-btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .file-preview-info {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--muted-foreground, #6b7280);
  }

  .preview-label {
    font-weight: 500;
  }

  .file-preview-name {
    font-family: monospace;
    color: var(--foreground, #374151);
  }
</style>
