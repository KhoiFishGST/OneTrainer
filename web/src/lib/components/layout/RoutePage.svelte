<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    class: className = '',
  }: {
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<div class={`route-page ${className}`}>
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  :where(.route-page) {
    width: 100%;
    max-width: var(--width-page);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-sizing: border-box;
  }
</style>
