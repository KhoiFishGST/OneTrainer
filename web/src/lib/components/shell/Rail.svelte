<script lang="ts">
  import { onMount } from 'svelte';
  import { SidebarProvider } from '$lib/components/ui/sidebar';
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

<SidebarProvider open={expanded} class={mobile ? 'h-auto w-auto' : 'h-full w-auto flex-none'}>
  <RailContent
    {currentPath}
    {mobile}
    {onToggleConsole}
    {isConsoleOpen}
    {expanded}
    onToggleExpand={toggleExpand}
  />
</SidebarProvider>
