<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<
    HTMLInputAttributes,
    'type' | 'checked' | 'class' | 'onchange' | 'aria-describedby' | 'aria-label'
  > & {
    value?: boolean;
    class?: string;
    ariaDescribedBy?: string;
    ariaLabel?: string;
    onChange?: (value: boolean) => void;
  };

  let {
    value = false,
    class: className = '',
    ariaDescribedBy,
    ariaLabel,
    onChange,
    ...attributes
  }: Props = $props();
</script>

<input
  {...attributes}
  type="checkbox"
  checked={value}
  aria-describedby={ariaDescribedBy}
  aria-label={ariaLabel}
  class={`checkbox-input ${className}`}
  onchange={(e) => onChange?.(e.currentTarget.checked)}
/>

<style>
  :where(.checkbox-input) {
    width: 1rem;
    height: 1rem;
    margin: 0;
    cursor: pointer;
    accent-color: var(--accent, #3b82f6);
  }
  :where(.checkbox-input:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
