<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<
    HTMLInputAttributes,
    'type' | 'value' | 'class' | 'oninput' | 'onchange' | 'onkeydown' | 'aria-describedby' | 'aria-label'
  > & {
    type?: 'text' | 'password' | 'search';
    value?: string;
    class?: string;
    ariaDescribedBy?: string;
    ariaLabel?: string;
    startAdornment?: Snippet;
    endAdornment?: Snippet;
    onInput?: (value: string) => void;
    onChange?: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
  };

  let {
    type = 'text',
    value = '',
    class: className = '',
    ariaDescribedBy,
    ariaLabel,
    startAdornment,
    endAdornment,
    onInput,
    onChange,
    onKeyDown,
    ...attributes
  }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);

  export function focus() {
    input?.focus();
  }
</script>

{#if startAdornment || endAdornment}
  <span class="text-input-shell">
    {#if startAdornment}{@render startAdornment()}{/if}
    <input
      {...attributes}
      bind:this={input}
      {type}
      value={value ?? ''}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      class={`text-input ${className}`}
      oninput={(e) => onInput?.(e.currentTarget.value)}
      onchange={(e) => onChange?.(e.currentTarget.value)}
      onkeydown={onKeyDown}
    />
    {#if endAdornment}{@render endAdornment()}{/if}
  </span>
{:else}
  <input
    {...attributes}
    bind:this={input}
    {type}
    value={value ?? ''}
    aria-describedby={ariaDescribedBy}
    aria-label={ariaLabel}
    class={`text-input ${className}`}
    oninput={(e) => onInput?.(e.currentTarget.value)}
    onchange={(e) => onChange?.(e.currentTarget.value)}
    onkeydown={onKeyDown}
  />
{/if}

<style>
  :where(.text-input-shell) {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 0.5rem;
  }
  :where(.text-input-shell) :where(.text-input) {
    min-width: 0;
  }
  :where(.text-input) {
    min-width: 220px;
    max-width: 100%;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }
  :where(.text-input:focus) {
    outline: none;
    border-color: var(--color-primary, var(--accent, #3b82f6));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
</style>
