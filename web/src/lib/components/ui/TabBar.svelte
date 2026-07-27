<script lang="ts" generics="T extends string">
  import Button from './Button.svelte';

  let {
    tabs,
    active,
    variant = 'page',
    onSelect,
    class: className = ''
  } = $props<{
    tabs: Array<{ id: T; label: string; disabled?: boolean }>;
    active: T;
    variant?: 'page' | 'dialog';
    onSelect: (id: T) => void;
    class?: string;
  }>();
</script>

<div class={`tab-bar tab-bar--${variant} ${className}`} role="tablist">
  {#each tabs as tab (tab.id)}
    <Button
      variant="ghost"
      class={`tab-bar__button${active === tab.id ? ' active' : ''}`}
      role="tab"
      aria-selected={active === tab.id}
      disabled={tab.disabled}
      onclick={() => onSelect(tab.id)}
    >
      {tab.label}
    </Button>
  {/each}
</div>

<style>
  :where(.tab-bar) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  :where(.tab-bar--page) {
    flex-wrap: wrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-bottom: 1px solid var(--color-border, var(--line, #2d3741));
    padding: 0 0.25rem;
  }
  :where(.tab-bar--dialog) {
    border-bottom: 1px solid var(--color-border, var(--line, #2d3741));
    background-color: var(--color-bg-panel, var(--control, #14191f));
    padding: 0.25rem 0.5rem 0;
    border-radius: 6px 6px 0 0;
  }
  :where(.tab-bar) :global(:where(.tab-bar__button)) {
    white-space: nowrap;
  }
  :where(.tab-bar--page) :global(:where(.tab-bar__button)) {
    padding: 0.5rem 0.875rem;
    border: 1px solid transparent;
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    background: transparent;
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: -1px;
    transition: all 0.15s ease;
  }
  :where(.tab-bar--page) :global(:where(.tab-bar__button:hover)) {
    color: var(--text, #f8fafc);
    background-color: var(--panel-raised, #1d242c);
  }
  :where(.tab-bar--page) :global(:where(.tab-bar__button.active)) {
    color: var(--color-text-title, var(--accent, #3b82f6));
    background-color: var(--color-bg-card, var(--panel, #181e25));
    border-color: var(--color-border, var(--line, #2d3741));
    border-bottom-color: var(--color-bg-card, var(--panel, #181e25));
  }
  :where(.tab-bar--dialog) :global(:where(.tab-bar__button)) {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted, #94a3b8);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  :where(.tab-bar--dialog) :global(:where(.tab-bar__button:hover:not(.active))) {
    color: var(--text, #f8fafc);
    background-color: var(--panel-raised, #1d242c);
  }
  :where(.tab-bar--dialog) :global(:where(.tab-bar__button.active)) {
    color: var(--color-text-title, var(--accent, #3b82f6));
    background-color: var(--color-bg-card, var(--panel, #181e25));
    border-color: var(--color-border, var(--line, #2d3741));
    border-bottom-color: var(--color-bg-card, var(--panel, #181e25));
  }
  @media (min-width: 769px) {
    :where(.tab-bar) :global(:where(.tab-bar__button)) {
      min-height: 0;
    }
  }
</style>
