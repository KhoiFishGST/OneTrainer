<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Props = Omit<
    HTMLTextareaAttributes,
    'value' | 'class' | 'oninput' | 'onchange' | 'onblur' | 'aria-describedby' | 'aria-label'
  > & {
    value?: string;
    class?: string;
    ariaDescribedBy?: string;
    ariaLabel?: string;
    onInput?: (value: string) => void;
    onChange?: (value: string) => void;
    onBlur?: (value: string, event: FocusEvent) => void;
  };

  let {
    value = '',
    class: className = '',
    ariaDescribedBy,
    ariaLabel,
    onInput,
    onChange,
    onBlur,
    ...attributes
  }: Props = $props();
</script>

<textarea
  {...attributes}
  value={value ?? ''}
  aria-describedby={ariaDescribedBy}
  aria-label={ariaLabel}
  class={`textarea-input ${className}`}
  oninput={(e) => onInput?.(e.currentTarget.value)}
  onchange={(e) => onChange?.(e.currentTarget.value)}
  onblur={(e) => onBlur?.(e.currentTarget.value, e)}
></textarea>

<style>
  :where(.textarea-input) {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    background: var(--control, #14191f);
    color: var(--text, #e6ebef);
    font: inherit;
    resize: vertical;
  }
  :where(.textarea-input:focus) {
    outline: none;
    border-color: var(--accent, #3b82f6);
  }
</style>
