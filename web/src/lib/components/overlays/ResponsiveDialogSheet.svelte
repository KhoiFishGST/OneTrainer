<script lang="ts">
  import type { Snippet } from 'svelte';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Sheet from '$lib/components/ui/sheet';

  let {
    open = $bindable(false),
    onOpenChange = () => {},
    title,
    description,
    children,
    footer,
    class: className = ''
  } = $props<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title?: string;
    description?: string;
    children?: Snippet;
    footer?: Snippet;
    class?: string;
  }>();

  let mobile = $derived(isMobile.current);
</script>

{#if !mobile}
  <Dialog.Root bind:open {onOpenChange}>
    <Dialog.Content class={className} preventScroll={false}>
      {#if title || description}
        <Dialog.Header>
          {#if title}
            <Dialog.Title>{title}</Dialog.Title>
          {/if}
          {#if description}
            <Dialog.Description>{description}</Dialog.Description>
          {/if}
        </Dialog.Header>
      {/if}
      {#if children}
        {@render children()}
      {/if}
      {#if footer}
        <Dialog.Footer>
          {@render footer()}
        </Dialog.Footer>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Sheet.Root bind:open {onOpenChange}>
    <Sheet.Content class={`full-screen inset-0 w-full h-dvh p-safe ${className}`} preventScroll={false}>
      {#if title || description}
        <Sheet.Header>
          {#if title}
            <Sheet.Title>{title}</Sheet.Title>
          {/if}
          {#if description}
            <Sheet.Description>{description}</Sheet.Description>
          {/if}
        </Sheet.Header>
      {/if}
      {#if children}
        {@render children()}
      {/if}
      {#if footer}
        <Sheet.Footer>
          {@render footer()}
        </Sheet.Footer>
      {/if}
    </Sheet.Content>
  </Sheet.Root>
{/if}
