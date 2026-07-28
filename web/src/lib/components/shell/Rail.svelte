<script lang="ts">
  import { onMount } from 'svelte';
  import { SidebarProvider, useSidebar } from '$lib/components/ui/sidebar';
  import RailContent from './RailContent.svelte';

  let {
    currentPath = '/live',
    mobile = false,
    onToggleConsole,
    isConsoleOpen = false,
  } = $props<{
    currentPath?: string;
    mobile?: boolean;
    onToggleConsole?: () => void;
    isConsoleOpen?: boolean;
  }>();

  let expanded = $state(false);
  let parentSidebar = $state<any>(null);
  try {
    parentSidebar = useSidebar();
  } catch {
    // context not provided in isolated unit test
  }

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      expanded = localStorage.getItem('webui.railExpanded') === 'true';
    }
  });

  function toggleExpand() {
    expanded = !expanded;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('webui.railExpanded', String(expanded));
    }
  }
</script>

{#if parentSidebar}
  <RailContent
    {currentPath}
    {mobile}
    {onToggleConsole}
    {isConsoleOpen}
    {expanded}
    onToggleExpand={toggleExpand}
  />
{:else}
  <SidebarProvider open={expanded} class={mobile ? 'h-auto w-auto' : 'h-full w-auto flex-none'}>
    <RailContent
      {currentPath}
      {mobile}
      {onToggleConsole}
      {isConsoleOpen}
      {expanded}
      onToggleExpand={toggleExpand}
      isStandalone={true}
    />
  </SidebarProvider>
{/if}
