<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<
    HTMLInputAttributes,
    'type' | 'value' | 'class' | 'oninput' | 'onchange' | 'aria-describedby' | 'aria-label'
  > & {
    value?: number | string;
    class?: string;
    ariaDescribedBy?: string;
    ariaLabel?: string;
    onInput?: (value: string) => void;
    onChange?: (value: string) => void;
  };

  let {
    value = '',
    class: className = '',
    ariaDescribedBy,
    ariaLabel,
    onInput,
    onChange,
    ...attributes
  }: Props = $props();
</script>

<input
  {...attributes}
  type="text"
  inputmode="decimal"
  value={value ?? ''}
  aria-describedby={ariaDescribedBy}
  aria-label={ariaLabel}
  class={`number-input ${className}`}
  oninput={(e) => onInput?.(e.currentTarget.value)}
  onchange={(e) => onChange?.(e.currentTarget.value)}
/>

<style>
  :where(.number-input) {
    width: 180px;
    max-width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--color-bg-input, var(--control, #14191f));
    color: var(--color-text, var(--text, #e6ebef));
    box-sizing: border-box;
  }
  :where(.number-input:focus) {
    outline: none;
    border-color: var(--color-primary, var(--accent, #3b82f6));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
</style>
