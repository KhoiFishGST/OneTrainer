<script lang="ts">
  import { FolderOpen } from '@lucide/svelte';
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
      class="flex-1 min-w-0"
      onInput={handleTextInput}
    />
    <Button
      variant="outline"
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
    color: var(--foreground);
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
    background: var(--muted);
    color: var(--primary);
    border: 1px solid var(--border);
    font-family: monospace;
  }

  .path-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .file-preview-info {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .preview-label {
    font-weight: 500;
  }

  .file-preview-name {
    font-family: monospace;
    color: var(--foreground);
  }
</style>
