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
    bodyClass = '',
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
    /**
     * Extra classes for the Drawer branch's body wrapper. Opt-in, and ignored
     * on the Dialog branch, which has no such wrapper. A consumer whose body
     * has to shrink when the card's max-height engages passes
     * `flex min-h-0 flex-col` here, which makes its own root a flex item that
     * can be compressed; see DirectoryPicker. Left empty the wrapper stays the
     * plain block every other consumer was written against.
     */
    bodyClass?: string;
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

          min-h-0 is load-bearing, not defensive. Drawer.Content is a flex
          column with a max-height and no scroll container of its own, and a
          flex item's default `min-height: auto` refuses to shrink below its
          content. Without it, a body taller than the cap keeps its full height
          and shoves the footer out of the rounded card and off the bottom of
          the screen -- which is exactly what the file picker did to its
          Cancel/Select row. This pulls the footer back inside the card; making
          the body's *contents* fit the room it was given is up to the consumer,
          via `bodyClass` (measured: min-h-0 alone leaves the wrapper 288px tall
          at 390x500 with a 464px block child still overflowing it).
        -->
        <div
          class={cn(
            'min-h-0',
            !flush && 'px-4',
            !flush && !(title || description) && 'pt-4',
            !flush && !footer && 'pb-4',
            bodyClass
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
