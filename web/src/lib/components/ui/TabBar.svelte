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
    overflow-x: auto;
  }
  :where(.tab-bar--page) {
    border-bottom: 1px solid var(--line, #2d3741);
    padding: 0 0.25rem;
  }
  :where(.tab-bar--dialog) {
    border-bottom: 1px solid var(--line, #2d3741);
  }
  :global(:where(.tab-bar__button)) {
    white-space: nowrap;
  }
  :global(:where(.tab-bar--page) :where(.tab-bar__button)) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    margin-bottom: -1px;
  }
  :global(:where(.tab-bar__button.active)) {
    color: var(--accent, #3b82f6);
    border-color: var(--line, #2d3741);
    background: var(--panel, #181e25);
  }
</style>
