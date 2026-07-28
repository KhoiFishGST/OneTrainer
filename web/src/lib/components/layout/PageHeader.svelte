<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    description,
    status,
    actions,
    class: className = ''
  } = $props<{
    title: string;
    description?: Snippet;
    status?: Snippet;
    actions?: Snippet;
    class?: string;
  }>();
</script>

<header class={`page-header ${className}`}>
  <div class="page-header__title-group">
    <h1 class="page-title">{title}</h1>
    {#if description}
      <div class="page-description">{@render description()}</div>
    {/if}
    {#if status}
      <div class="page-status">{@render status()}</div>
    {/if}
  </div>
  {#if actions}
    <div class="header-actions">{@render actions()}</div>
  {/if}
</header>

<style>
  :where(.page-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  :where(.page-header__title-group) {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  :where(.page-title) {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }
  :where(.page-description) {
    color: var(--muted, #8995a1);
  }
  :where(.page-status),
  :where(.header-actions) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
