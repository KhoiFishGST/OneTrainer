<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
  type ButtonSize = 'small' | 'medium' | 'large' | 'icon';
  type Props = Omit<HTMLButtonAttributes, 'children' | 'class' | 'type'> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
    children?: Snippet;
  };

  let {
    variant = 'secondary',
    size = 'medium',
    type = 'button',
    disabled = false,
    class: className = '',
    children,
    onclick,
    ...attributes
  }: Props = $props();

  function handleClick(event: MouseEvent) {
    if (disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    onclick?.(event);
  }
</script>

<button
  {...attributes}
  {type}
  {disabled}
  onclick={handleClick}
  class={`button button--${variant} button--${size}${className ? ` ${className}` : ''}`}
>
  {#if children}{@render children()}{/if}
</button>

<style>
  :where(.button) { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; border:1px solid transparent; border-radius:6px; font:inherit; font-weight:500; cursor:pointer; transition:background-color .15s,border-color .15s,color .15s,opacity .15s; }
  :where(.button--small) { min-height:30px; padding:.25rem .625rem; font-size:.75rem; }
  :where(.button--medium) { min-height:36px; padding:.4rem .85rem; font-size:.875rem; }
  :where(.button--large) { min-height:44px; padding:.75rem 1rem; font-size:.95rem; }
  :where(.button--icon) { width:36px; height:36px; padding:0; }
  :where(.button--primary) { background:var(--accent,#3b82f6); color:#fff; }
  :where(.button--secondary) { background:var(--panel-raised,var(--control,#14191f)); color:var(--text,#e6ebef); border-color:var(--line,#2d3741); }
  :where(.button--danger) { background:var(--danger,#ef4444); color:#fff; }
  :where(.button--ghost) { background:transparent; color:var(--muted,#8995a1); }
  :where(.button:focus-visible) { outline:2px solid var(--focus,var(--accent,#3b82f6)); outline-offset:2px; }
  :where(.button:disabled) { opacity:.5; cursor:not-allowed; }
</style>
