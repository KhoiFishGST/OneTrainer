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

<div class="directory-input-wrapper flex items-center gap-1.5 w-full min-w-0">
  <TextInput
    {id}
    {value}
    {disabled}
    {placeholder}
    {ariaDescribedBy}
    class="flex-1 min-w-0 w-full"
    onInput={onInput}
  />
  <Button
    variant="outline"
    size={buttonLabel ? 'default' : 'icon'}
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
  }
</style>
