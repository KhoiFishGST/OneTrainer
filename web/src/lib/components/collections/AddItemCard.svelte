<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';

  let {
    label = 'Add Item',
    disabled = false,
    onClick,
    class: className = ''
  }: {
    label?: string;
    disabled?: boolean;
    onClick?: () => void;
    class?: string;
  } = $props();
</script>

<Button
  variant="ghost"
  class={cn(
    "min-h-[220px] h-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg bg-transparent p-6 transition-all hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed",
    className
  )}
  {disabled}
  onclick={onClick}
>
  <div class="text-primary">
    <Plus size={32} />
  </div>
  <span class="text-sm font-semibold text-foreground">{label}</span>
</Button>
