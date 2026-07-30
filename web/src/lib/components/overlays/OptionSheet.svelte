<script lang="ts" module>
  // Exported types belong in a module script -- the instance script runs per
  // component instance and cannot export. This matches the vendored shadcn
  // components (see ui/tabs/tabs-list.svelte).
  export type OptionSheetOption = { value: string; label: string };
</script>

<script lang="ts">
  import { Check } from '@lucide/svelte';
  import ResponsiveDialogDrawer from './ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';

  let {
    open = false,
    title,
    options = [],
    value = '',
    onSelect,
    onOpenChange,
  } = $props<{
    open?: boolean;
    title: string;
    options?: OptionSheetOption[];
    value?: string;
    onSelect: (value: string) => void;
    onOpenChange: (open: boolean) => void;
  }>();

  function choose(next: string) {
    onSelect(next);
    onOpenChange(false);
  }
</script>

<ResponsiveDialogDrawer {open} {onOpenChange} {title}>
  <!--
    role="option" rather than a bare button: the icon button that opens this
    sheet shares its accessible name, so a `button` query would match both.
  -->
  <div role="listbox" aria-label={title} class="flex max-h-[60dvh] flex-col overflow-y-auto py-1">
    {#each options as option (option.value)}
      <Button
        type="button"
        variant="ghost"
        role="option"
        aria-selected={option.value === value}
        class="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted h-auto rounded-none font-normal"
        onclick={() => choose(option.value)}
      >
        <span class="truncate">{option.label}</span>
        {#if option.value === value}
          <Check size={16} class="shrink-0 text-primary" />
        {/if}
      </Button>
    {/each}
  </div>
</ResponsiveDialogDrawer>
