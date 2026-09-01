<script lang="ts">
  import { SidebarProvider, useSidebar } from '$lib/components/ui/sidebar';
  import { Button } from '$lib/components/ui/button';
  import Rail from './Rail.svelte';

  let { currentPath = '/general' } = $props<{ currentPath?: string }>();
</script>

{#snippet Trigger()}
  {@const sidebar = useSidebar()}
  <Button aria-label="Open navigation" onclick={() => sidebar.setOpenMobile(true)}>
    Open navigation
  </Button>
{/snippet}

<SidebarProvider>
  {@render Trigger()}
  <Rail {currentPath} />
</SidebarProvider>
