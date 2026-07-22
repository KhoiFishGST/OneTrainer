<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open = false,
    children,
  }: {
    open?: boolean;
    children?: Snippet;
  } = $props();
</script>

{#if open}
  <section
    class="console-drawer"
    aria-label="Console Output"
  >
    <div class="console-body">
      {#if children}
        {@render children()}
      {:else}
        <div class="placeholder">Console output slot (Task 16)</div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .console-drawer {
    height: 200px;
    background-color: var(--panel-raised);
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .console-body {
    flex: 1;
    padding: 12px;
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--text);
    overflow-y: auto;
  }

  .placeholder {
    color: var(--muted);
  }
</style>
