<script lang="ts">
  import { onMount } from 'svelte';
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
    Menu,
    X,
    Key,
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    SidebarProvider,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
  } from '$lib/components/ui/sidebar';
  import { cn } from '$lib/utils';

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
  let drawerOpen = $state(false);

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

{#if mobile}
  <div class="mobile-toggle-owner">
    <Button
      variant="ghost"
      class="mobile-toggle-btn"
      aria-label="Open navigation"
      onclick={() => (drawerOpen = true)}
    >
      <Menu size={20} />
    </Button>
  </div>

  {#if drawerOpen}
    <div class="drawer-overlay" onclick={() => (drawerOpen = false)} role="presentation"></div>
    <div class="drawer-content" role="dialog" aria-label="Navigation">
      <div class="drawer-header">
        <span class="drawer-title">Navigation</span>
        <Button
          variant="ghost"
          class="close-btn"
          aria-label="Close navigation"
          onclick={() => (drawerOpen = false)}
        >
          <X size={20} />
        </Button>
      </div>
      <SidebarProvider open={true} class="h-full w-full flex-col">
        <SidebarContent class="drawer-nav">
          <SidebarGroup class="p-0">
            <SidebarGroupContent>
              <SidebarMenu class="gap-2" aria-label="Mobile Navigation">
                {#each navItems as item}
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={currentPath === item.path}>
                      {#snippet child({ props })}
                        {#if item.disabled}
                          <a
                            {...props}
                            href={item.path}
                            class={cn('nav-item disabled', props.class as string)}
                            aria-disabled="true"
                            title="Unavailable in Phase A"
                            onclick={(e) => e.preventDefault()}
                          >
                            <item.icon size={20} class="nav-icon" />
                            <span class="nav-label">{item.name}</span>
                          </a>
                        {:else}
                          <a
                            {...props}
                            href={item.path}
                            class={cn('nav-item', currentPath === item.path && 'active', props.class as string)}
                            onclick={() => (drawerOpen = false)}
                          >
                            <item.icon size={20} class="nav-icon" />
                            <span class="nav-label">{item.name}</span>
                          </a>
                        {/if}
                      {/snippet}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                {/each}
                {#if onToggleConsole}
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={isConsoleOpen}>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          variant="ghost"
                          class={cn('nav-item console-nav-btn', isConsoleOpen && 'active', props.class as string)}
                          onclick={() => {
                            onToggleConsole();
                            drawerOpen = false;
                          }}
                        >
                          <Terminal size={20} class="nav-icon" />
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
      </SidebarProvider>
    </div>
  {/if}
{:else}
  <SidebarProvider open={expanded} class="h-full w-auto flex-none">
    <aside
      class="rail"
      class:expanded
      style="--rail-width: {expanded ? 'var(--rail-expanded)' : 'var(--rail-compact)'}"
    >
      <SidebarHeader class="rail-header">
        <Button
          variant="ghost"
          class="rail-toggle-btn"
          aria-label="Expand navigation"
          onclick={toggleExpand}
        >
          <PanelLeft size={20} />
        </Button>
      </SidebarHeader>
      <SidebarContent class="rail-nav">
        <SidebarGroup class="p-0">
          <SidebarGroupContent>
            <SidebarMenu class="gap-1" aria-label="Sidebar">
              {#each navItems as item}
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={currentPath === item.path}>
                    {#snippet child({ props })}
                      {#if item.disabled}
                        <a
                          {...props}
                          href={item.path}
                          class={cn('nav-item disabled', props.class as string)}
                          aria-disabled="true"
                          title="Unavailable in Phase A"
                          onclick={(e) => e.preventDefault()}
                        >
                          <item.icon size={20} class="nav-icon" />
                          <span class="nav-label">{item.name}</span>
                        </a>
                      {:else}
                        <a
                          {...props}
                          href={item.path}
                          class={cn('nav-item', currentPath === item.path && 'active', props.class as string)}
                        >
                          <item.icon size={20} class="nav-icon" />
                          <span class="nav-label">{item.name}</span>
                        </a>
                      {/if}
                    {/snippet}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              {/each}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {#if onToggleConsole}
        <SidebarFooter class="rail-footer">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={isConsoleOpen}>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    variant="ghost"
                    class={cn('nav-item console-nav-btn', isConsoleOpen && 'active', props.class as string)}
                    onclick={onToggleConsole}
                    title="Toggle Console Drawer"
                  >
                    <Terminal size={20} class="nav-icon" />
                    <span class="nav-label">Console</span>
                  </Button>
                {/snippet}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      {/if}
    </aside>
  </SidebarProvider>
{/if}

<style>
  .rail {
    width: var(--rail-width);
    background-color: var(--panel);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    height: 100%;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    user-select: none;
  }

  .rail-header {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    border-bottom: 1px solid var(--line);
  }

  .rail-header :global(.rail-toggle-btn),
  .mobile-toggle-owner :global(.mobile-toggle-btn) {
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rail-header :global(.rail-toggle-btn:hover),
  .mobile-toggle-owner :global(.mobile-toggle-btn:hover) {
    color: var(--text);
    background-color: var(--panel-raised);
  }

  .rail-nav {
    display: flex;
    flex-direction: column;
    padding: 8px 4px;
    gap: 4px;
    overflow-y: auto;
    flex: 1;
  }

  .rail-footer {
    padding: 8px 4px;
    border-top: 1px solid var(--line);
    margin-top: auto;
  }

  .rail-footer :global(.console-nav-btn),
  .drawer-nav :global(.console-nav-btn) {
    min-height: 0;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  .rail :global(.nav-item),
  .drawer-content :global(.nav-item) {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    color: var(--muted);
    text-decoration: none;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
  }

  .rail :global(.nav-item) :global(.nav-icon),
  .drawer-content :global(.nav-item) :global(.nav-icon) {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    opacity: 1;
    transition: opacity 0.15s ease 0.05s;
  }

  .rail:not(.expanded) .nav-label {
    opacity: 0;
    width: 0;
    pointer-events: none;
  }

  .rail :global(.nav-item:hover:not(.disabled)),
  .drawer-content :global(.nav-item:hover:not(.disabled)) {
    color: var(--text);
    background-color: var(--panel-raised);
  }

  .rail :global(.nav-item.active),
  .drawer-content :global(.nav-item.active) {
    color: var(--accent);
    background-color: var(--accent-soft);
    font-weight: 500;
  }

  .rail :global(.nav-item.disabled),
  .drawer-content :global(.nav-item.disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .drawer-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 100;
  }

  .drawer-content {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    background-color: var(--panel);
    border-right: 1px solid var(--line);
    z-index: 101;
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }

  .drawer-title {
    font-weight: 600;
    font-size: 1.125rem;
    color: var(--text);
  }

  .drawer-header :global(.close-btn) {
    min-height: 0;
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
  }

  .mobile-toggle-owner {
    display: contents;
  }

  .drawer-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }
</style>
