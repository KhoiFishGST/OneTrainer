<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'type' | 'class' | 'onchange'> & {
    class?: string;
    onChange?: (files: FileList | null) => void;
  };

  let { class: className = '', onChange, ...attributes }: Props = $props();
  let input = $state<HTMLInputElement | null>(null);

  export function open() {
    input?.click();
  }
</script>

<input
  {...attributes}
  bind:this={input}
  type="file"
  class={`file-input ${className}`}
  onchange={(e) => onChange?.(e.currentTarget.files)}
/>
