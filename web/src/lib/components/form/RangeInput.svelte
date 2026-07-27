<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'type' | 'value' | 'class' | 'oninput'> & {
    value?: number;
    class?: string;
    onInput?: (value: number) => void;
  };

  let { value = 0, class: className = '', onInput, ...attributes }: Props = $props();
</script>

<input
  {...attributes}
  type="range"
  value={value}
  class={`range-input ${className}`}
  oninput={(e) => onInput?.(e.currentTarget.valueAsNumber)}
/>

<style>
  :where(.range-input) {
    accent-color: var(--accent, #3b82f6);
    cursor: pointer;
  }
  :where(.range-input:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
