<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { Input } from '$lib/components/ui/input/index.js';

  type Props = Omit<HTMLInputAttributes, 'type' | 'class' | 'onchange'> & {
    class?: string;
    onChange?: (files: FileList | null) => void;
    onchange?: (event: Event & { currentTarget: HTMLInputElement }) => void;
  };

  let { class: className = '', onChange, onchange, ...attributes }: Props = $props();
  let input = $state<HTMLInputElement | null>(null);

  export function open() {
    input?.click();
  }

  function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
    onChange?.(event.currentTarget.files);
    onchange?.(event);
  }
</script>

<Input
  {...attributes as any}
  bind:ref={input}
  type="file"
  class={className}
  onchange={handleChange}
/>
