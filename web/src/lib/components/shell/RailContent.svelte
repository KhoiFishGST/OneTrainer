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
    Menu,
    Key,
  } from 'lucide-svelte';
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

  $effect(() => {
    if (!mobile) {
      sidebar.setOpenMobile(false);
    }
  });

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
      onclick={() => sidebar.setOpenMobile(true)}
    >
      <Menu size={20} />
    </Button>
  </div>
{/if}

<Sidebar
  {mobile}
  class={cn('rail', expanded && 'expanded')}
  style="--rail-width: {expanded ? 'var(--rail-expanded)' : 'var(--rail-compact)'}"
>
  {#if !mobile}
    <SidebarHeader class="rail-header">
      <Button
        variant="ghost"
        class="rail-toggle-btn"
        aria-label="Expand navigation"
        onclick={onToggleExpand}
      >
        <PanelLeft size={20} />
      </Button>
    </SidebarHeader>
  {/if}

  <SidebarContent class={cn('rail-nav', mobile && 'drawer-nav')}>
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
                      onclick={() => {
                        if (mobile) sidebar.setOpenMobile(false);
                      }}
                    >
                      <item.icon size={20} class="nav-icon" />
                      <span class="nav-label">{item.name}</span>
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
                    class={cn('nav-item console-nav-btn', isConsoleOpen && 'active', props.class as string)}
                    onclick={() => {
                      onToggleConsole();
                      sidebar.setOpenMobile(false);
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

  {#if !mobile && onToggleConsole}
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
</Sidebar>

<style>
  :global(.rail) {
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

  :global(.rail-header) {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    border-bottom: 1px solid var(--line);
  }

  :global(.rail-header) :global(.rail-toggle-btn),
  .mobile-toggle-owner :global(.mobile-toggle-btn) {
    background: transparent;
    border: none;
    color: var(--muted-foreground, #8d99a6);
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.rail-header) :global(.rail-toggle-btn:hover),
  .mobile-toggle-owner :global(.mobile-toggle-btn:hover) {
    color: var(--text);
    background-color: var(--panel-raised);
  }

  :global(.rail-nav) {
    display: flex;
    flex-direction: column;
    padding: 8px 4px;
    gap: 4px;
    overflow-y: auto;
    flex: 1;
  }

  :global(.rail-footer) {
    padding: 8px 4px;
    border-top: 1px solid var(--line);
    margin-top: auto;
  }

  :global(.rail-footer) :global(.console-nav-btn),
  :global(.drawer-nav) :global(.console-nav-btn) {
    min-height: 0;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  :global(.rail) :global(.nav-item),
  :global(.drawer-content) :global(.nav-item) {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    color: var(--muted-foreground, #8d99a6);
    text-decoration: none;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
  }

  :global(.rail) :global(.nav-item) :global(.nav-icon),
  :global(.drawer-content) :global(.nav-item) :global(.nav-icon) {
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

  :global(.rail:not(.expanded)) .nav-label {
    opacity: 0;
    width: 0;
    pointer-events: none;
  }

  :global(.rail) :global(.nav-item:hover:not(.disabled)),
  :global(.drawer-content) :global(.nav-item:hover:not(.disabled)) {
    color: var(--text);
    background-color: var(--panel-raised);
  }

  :global(.rail) :global(.nav-item.active),
  :global(.drawer-content) :global(.nav-item.active) {
    color: var(--accent);
    background-color: var(--accent-soft);
    font-weight: 500;
  }

  :global(.rail) :global(.nav-item.disabled),
  :global(.drawer-content) :global(.nav-item.disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.drawer-content) {
    background-color: var(--panel);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
  }

  .mobile-toggle-owner {
    display: contents;
  }

  :global(.drawer-nav) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }
</style>
