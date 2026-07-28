<script lang="ts">
  import type { Snippet } from 'svelte';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Drawer from '$lib/components/ui/drawer';

  let {
    open = $bindable(false),
    onOpenChange = () => {},
    title,
    description,
    children,
    footer,
    class: className = '',
    ...restProps
  } = $props<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title?: string;
    description?: string;
    children?: Snippet;
    footer?: Snippet;
    class?: string;
    [key: string]: any;
  }>();

  const mobile = $derived(isMobile.current);
</script>

{#if !mobile}
  <Dialog.Root bind:open {onOpenChange}>
    <Dialog.Content class={className} {...restProps}>
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
  <Drawer.Root bind:open {onOpenChange}>
    <Drawer.Content class={`safe-area-overlay ${className}`} {...restProps}>
      {#if title || description}
        <Drawer.Header>
          {#if title}
            <Drawer.Title>{title}</Drawer.Title>
          {/if}
          {#if description}
            <Drawer.Description>{description}</Drawer.Description>
          {/if}
        </Drawer.Header>
      {/if}
      {#if children}
        {@render children()}
      {/if}
      {#if footer}
        <Drawer.Footer>
          {@render footer()}
        </Drawer.Footer>
      {/if}
    </Drawer.Content>
  </Drawer.Root>
{/if}
