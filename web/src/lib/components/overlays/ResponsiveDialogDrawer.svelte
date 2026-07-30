<script lang="ts">
  import type { Snippet } from 'svelte';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Drawer from '$lib/components/ui/drawer';
  import { cn } from '$lib/utils';

  let {
    open = $bindable(false),
    onOpenChange = () => {},
    title,
    description,
    children,
    footer,
    class: className = '',
    flush = false,
    ...restProps
  } = $props<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title?: string;
    description?: string;
    children?: Snippet;
    footer?: Snippet;
    class?: string;
    flush?: boolean;
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
        <!--
          Drawer.Content has no padding of its own, so an input rendered here
          would touch the card border. Header and Footer each carry p-4, so the
          body only supplies the vertical padding they are not already giving.
          This wrapper is deliberately absent from the Dialog branch above:
          Dialog.Content already applies p-4, and doubling it would inset
          desktop content twice.
        -->
        <div
          class={cn(
            !flush && 'px-4',
            !flush && !(title || description) && 'pt-4',
            !flush && !footer && 'pb-4'
          )}
        >
          {@render children()}
        </div>
      {/if}
      {#if footer}
        <Drawer.Footer>
          {@render footer()}
        </Drawer.Footer>
      {/if}
    </Drawer.Content>
  </Drawer.Root>
{/if}
