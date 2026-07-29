<script lang="ts">
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
    <button
      data-testid="open-sidebar"
      aria-label="Open sidebar"
      onclick={() => sidebar.setOpenMobile(true)}
      style="display: none;"
    ></button>
  {/if}
  <RailContent {...props} />
{/snippet}

<SidebarProvider>
  {@render Content()}
</SidebarProvider>
