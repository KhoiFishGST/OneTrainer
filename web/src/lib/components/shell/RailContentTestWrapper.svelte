<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { SidebarProvider, useSidebar } from '$lib/components/ui/sidebar';
  import RailContent from './RailContent.svelte';

  let props = $props<{
    currentPath?: string;
    mobile?: boolean;
    onToggleConsole?: () => void;
    isConsoleOpen?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
  }>();
</script>

{#snippet Content()}
  {@const sidebar = useSidebar()}
  {#if props.mobile}
    <Button
      data-testid="open-sidebar"
      aria-label="Open sidebar"
      onclick={() => sidebar.setOpenMobile(true)}
      style="display: none;"
    />
  {/if}
  <RailContent {...props} />
{/snippet}

<SidebarProvider>
  {@render Content()}
</SidebarProvider>
