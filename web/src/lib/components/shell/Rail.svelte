<script lang="ts">
  import { onMount } from 'svelte';
  import { SidebarProvider, useSidebar } from '$lib/components/ui/sidebar';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';
  import RailContent from './RailContent.svelte';

  let {
    currentPath = '/live',
    onToggleConsole,
    isConsoleOpen = false,
  } = $props<{
    currentPath?: string;
    onToggleConsole?: () => void;
    isConsoleOpen?: boolean;
  }>();

  let expanded = $state(false);
  const parentSidebar = (() => {
    try {
      return useSidebar();
    } catch {
      // Sidebar context is absent in isolated unit tests.
      return null;
    }
  })();

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      expanded = localStorage.getItem('webui.railExpanded') === 'true';
    }
  });

  /*
    The off-canvas sheet portals into <body>, so the `md:hidden` wrapper below
    cannot hide it once it is open. If the viewport grows past md with the
    drawer open it would float over the desktop layout, so close it here. This
    is the one place the JS media query is legitimate: it runs after hydration
    and never decides what first paint looks like.
  */
  $effect(() => {
    if (!isMobile.current) {
      parentSidebar?.setOpenMobile(false);
    }
  });

  function toggleExpand() {
    expanded = !expanded;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('webui.railExpanded', String(expanded));
    }
  }
</script>

{#snippet variants()}
  <!-- Off-canvas sheet, phones only. -->
  <div class="md:hidden">
    <RailContent
      {currentPath}
      mobile={true}
      {onToggleConsole}
      {isConsoleOpen}
      {expanded}
      onToggleExpand={toggleExpand}
    />
  </div>

  <!-- In-flow rail, md and up. -->
  <div class="hidden md:block h-full">
    <RailContent
      {currentPath}
      mobile={false}
      {onToggleConsole}
      {isConsoleOpen}
      {expanded}
      onToggleExpand={toggleExpand}
    />
  </div>
{/snippet}

{#if parentSidebar}
  {@render variants()}
{:else}
  <SidebarProvider open={expanded} class="h-full w-auto flex-none">
    {@render variants()}
  </SidebarProvider>
{/if}
