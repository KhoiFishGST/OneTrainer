<script lang="ts">
  import type { Snippet } from 'svelte';
  import * as Card from '$lib/components/ui/card/index.js';
  import { cn } from '$lib/utils.js';

  let {
    title = '',
    isComponentsGroup = false,
    hideTitle = false,
    children,
  }: {
    title?: string;
    isComponentsGroup?: boolean;
    hideTitle?: boolean;
    children?: Snippet;
  } = $props();
</script>

<Card.Root class={cn("form-panel w-full max-w-[740px] p-5 flex flex-col gap-4 border border-border bg-card text-card-foreground rounded-lg shadow-sm", isComponentsGroup && "is-components-group")}>
  {#if title && !hideTitle}
    <Card.Header class="p-0 space-y-0">
      <Card.Title class="panel-title text-base font-semibold text-primary">{title}</Card.Title>
    </Card.Header>
  {/if}

  {#if children}
    <Card.Content class="panel-body p-0 flex flex-col gap-4">
      {@render children()}
    </Card.Content>
  {/if}
</Card.Root>

