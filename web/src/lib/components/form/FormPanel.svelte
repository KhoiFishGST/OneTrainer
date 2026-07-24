<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    isComponentsGroup = false,
    children,
  }: {
    title?: string;
    isComponentsGroup?: boolean;
    children?: Snippet;
  } = $props();
</script>

<section class="form-panel" class:is-components-group={isComponentsGroup}>
  {#if title}
    <h3 class="panel-title">{title}</h3>
  {/if}

  {#if children}
    <div class="panel-body">
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .form-panel {
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 8px;
    padding: 1.25rem;
    background: var(--color-bg-card, var(--panel, #181e25));
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-sizing: border-box;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-text, var(--text, #e6ebef));
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
