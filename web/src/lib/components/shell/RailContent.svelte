<script lang="ts">
  import {
    SlidersHorizontal,
    Database,
    Archive,
    Terminal,
    Box,
    Layers,
    Activity,
    Sparkles,
    Cpu,
    Wrench,
    Tv,
    Images,
    PanelLeft,
    Key,
  } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    useSidebar,
  } from '$lib/components/ui/sidebar';
  import { cn } from '$lib/utils';

  let {
    currentPath = '/live',
    mobile = false,
    onToggleConsole,
    isConsoleOpen = false,
    expanded = false,
    onToggleExpand,
  } = $props<{
    currentPath?: string;
    mobile?: boolean;
    onToggleConsole?: () => void;
    isConsoleOpen?: boolean;
    expanded?: boolean;
    onToggleExpand?: () => void;
  }>();

  const sidebar = useSidebar();

  const navItems = [
    { name: 'Live', path: '/live', icon: Tv, disabled: false },
    { name: 'Gallery', path: '/gallery', icon: Images, disabled: false },
    { name: 'General', path: '/general', icon: SlidersHorizontal, disabled: false },
    { name: 'Model', path: '/model', icon: Box, disabled: false },
    { name: 'Datasets', path: '/datasets', icon: Database, disabled: false },
    { name: 'Concepts', path: '/concepts', icon: Layers, disabled: false },
    { name: 'Training', path: '/training', icon: Activity, disabled: false },
    { name: 'Sampling', path: '/sampling', icon: Sparkles, disabled: false },
    { name: 'Backup', path: '/backup', icon: Archive, disabled: false },
    { name: 'Tools', path: '/tools', icon: Wrench, disabled: true },
    { name: 'LoRA', path: '/lora', icon: Cpu, disabled: false },
    { name: 'Embeddings', path: '/embeddings', icon: Layers, disabled: false },
    { name: 'Secrets', path: '/secrets', icon: Key, disabled: false },
  ];
</script>

<Sidebar
  {mobile}
  collapsible={mobile ? 'offcanvas' : 'none'}
  class={cn('rail w-[var(--rail-width)] bg-card border-r border-border flex flex-col h-full transition-[width] duration-200 ease-in-out overflow-hidden select-none', expanded && 'expanded', mobile && 'p-4')}
  style="--rail-width: {expanded ? 'var(--rail-expanded)' : 'var(--rail-compact)'}"
>

  {#if !mobile}
    <SidebarHeader class="h-12 flex items-center justify-start px-2 border-b border-border">
      <Button
        variant="ghost"
        size="icon"
        class="text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label="Expand navigation"
        onclick={onToggleExpand}
      >
        <PanelLeft size={20} />
      </Button>
    </SidebarHeader>
  {/if}

  <SidebarContent class={cn('flex flex-col p-2 gap-1 overflow-y-auto flex-1', mobile && 'p-4 gap-2')}>
    <SidebarGroup class="p-0">
      <SidebarGroupContent>
        <SidebarMenu class={mobile ? 'gap-2' : 'gap-1'} aria-label={mobile ? 'Mobile Navigation' : 'Sidebar'}>
          {#each navItems as item}
            <SidebarMenuItem>
              <SidebarMenuButton isActive={currentPath === item.path}>
                {#snippet child({ props })}
                  {#if item.disabled}
                    <a
                      {...props}
                      href={item.path}
                      class={cn(
                        'flex items-center gap-3 px-2.5 py-2 text-muted-foreground no-underline rounded-md text-sm whitespace-nowrap overflow-hidden transition-colors opacity-40 cursor-not-allowed max-md:min-h-[44px]',
                        props.class as string
                      )}
                      aria-disabled="true"
                      title="Unavailable in Phase A"
                      onclick={(e) => e.preventDefault()}
                    >
                      <item.icon size={20} class="shrink-0 w-5 h-5" />
                      <span class={cn('nav-label', !expanded && !mobile && 'opacity-0 w-0 pointer-events-none')}>{item.name}</span>
                    </a>
                  {:else}
                    <a
                      {...props}
                      href={item.path}
                      class={cn(
                        'flex items-center gap-3 px-2.5 py-2 text-muted-foreground no-underline rounded-md text-sm whitespace-nowrap overflow-hidden transition-colors max-md:min-h-[44px]',
                        currentPath === item.path && 'bg-accent text-accent-foreground font-medium',
                        props.class as string
                      )}
                      onclick={() => {
                        if (mobile) sidebar.setOpenMobile(false);
                      }}
                    >
                      <item.icon size={20} class="shrink-0 w-5 h-5" />
                      <span class={cn('nav-label', !expanded && !mobile && 'opacity-0 w-0 pointer-events-none')}>{item.name}</span>
                    </a>
                  {/if}
                {/snippet}
              </SidebarMenuButton>
            </SidebarMenuItem>
          {/each}
          {#if mobile && onToggleConsole}
            <SidebarMenuItem>
              <SidebarMenuButton isActive={isConsoleOpen}>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    variant="ghost"
                    class={cn(
                      'flex w-full items-center justify-start gap-3 px-2.5 py-2 text-muted-foreground rounded-md text-sm whitespace-nowrap overflow-hidden transition-colors font-normal h-auto min-h-0 hover:bg-muted hover:text-foreground',
                      isConsoleOpen && 'bg-accent text-accent-foreground font-medium',
                      props.class as string
                    )}
                    onclick={() => {
                      onToggleConsole();
                      sidebar.setOpenMobile(false);
                    }}
                  >
                    <Terminal size={20} class="shrink-0 w-5 h-5" />
                    <span class="nav-label">Console</span>
                  </Button>
                {/snippet}
              </SidebarMenuButton>
            </SidebarMenuItem>
          {/if}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>

  {#if !mobile && onToggleConsole}
    <SidebarFooter class="p-2 border-t border-border mt-auto">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton isActive={isConsoleOpen}>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                class={cn(
                  'flex w-full items-center justify-start gap-3 px-2.5 py-2 text-muted-foreground rounded-md text-sm whitespace-nowrap overflow-hidden transition-colors font-normal h-auto min-h-0 hover:bg-muted hover:text-foreground',
                  isConsoleOpen && 'bg-accent text-accent-foreground font-medium',
                  props.class as string
                )}
                onclick={onToggleConsole}
                title="Toggle Console Drawer"
              >
                <Terminal size={20} class="shrink-0 w-5 h-5" />
                <span class={cn('nav-label', !expanded && !mobile && 'opacity-0 w-0 pointer-events-none')}>Console</span>
              </Button>
            {/snippet}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  {/if}
</Sidebar>

<style>
  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    transition: opacity 0.15s ease 0.05s;
  }
</style>
