<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { Maximize2, X } from '@lucide/svelte';
  import ConsoleView from '$lib/components/console/ConsoleView.svelte';
  import { consoleStore, type ConsoleStore } from '$lib/events/console-store.svelte';
  import { Button } from '$lib/components/ui/button';

  let {
    open = false,
    store = consoleStore,
    onClose,
    children,
  }: {
    open?: boolean;
    store?: ConsoleStore;
    onClose?: () => void;
    children?: Snippet;
  } = $props();

  let drawerHeight = $state(200);
  let isDragging = $state(false);
  let startY = $state(0);
  let startHeight = $state(200);

  function getMinMaxHeight(): [number, number] {
    const minH = 100;
    const maxH = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.8) : 800;
    return [minH, maxH];
  }

  function clampHeight(val: number): number {
    const [minH, maxH] = getMinMaxHeight();
    return Math.min(Math.max(minH, val), maxH);
  }

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const savedHeight = localStorage.getItem('console_drawer_height');
      if (savedHeight) {
        const parsed = parseInt(savedHeight, 10);
        if (!isNaN(parsed)) {
          drawerHeight = clampHeight(parsed);
        } else {
          drawerHeight = clampHeight(drawerHeight);
        }
      } else {
        drawerHeight = clampHeight(drawerHeight);
      }
    } else {
      drawerHeight = clampHeight(drawerHeight);
    }

    function handleResize() {
      drawerHeight = clampHeight(drawerHeight);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  });

  function startResize(e: MouseEvent | TouchEvent) {
    isDragging = true;
    startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startHeight = drawerHeight;

    window.addEventListener('mousemove', onResize);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('touchmove', onResize);
    window.addEventListener('touchend', stopResize);
  }

  function onResize(e: MouseEvent | TouchEvent) {
    if (!isDragging) return;
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - currentY; // Pulling up increases height
    drawerHeight = clampHeight(startHeight + deltaY);
  }

  function stopResize() {
    if (isDragging) {
      isDragging = false;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('console_drawer_height', drawerHeight.toString());
      }
    }
    window.removeEventListener('mousemove', onResize);
    window.removeEventListener('mouseup', stopResize);
    window.removeEventListener('touchmove', onResize);
    window.removeEventListener('touchend', stopResize);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      drawerHeight = clampHeight(drawerHeight + 10);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('console_drawer_height', drawerHeight.toString());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      drawerHeight = clampHeight(drawerHeight - 10);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('console_drawer_height', drawerHeight.toString());
      }
    }
  }
</script>

{#if open}
  <section
    class="console-drawer"
    aria-label="Console Output"
    style="height: {drawerHeight}px;"
  >
    <!-- Touch-safe drag handle for resize -->
    <div
      class="resize-handle"
      role="slider"
      aria-label="Resize Console Drawer"
      aria-valuenow={drawerHeight}
      tabindex="0"
      onmousedown={startResize}
      ontouchstart={startResize}
      onkeydown={handleKeyDown}
    >
      <div class="handle-bar"></div>
    </div>

    <div class="drawer-header">
      <div class="header-left">
        <span class="drawer-title">Console</span>
        <a href="/console" class="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded inline-flex items-center justify-center" title="Open Fullpage Console">
          <Maximize2 size={14} />
        </a>
      </div>
      {#if onClose}
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6 text-muted-foreground hover:text-foreground"
          onclick={onClose}
          title="Close Console Drawer"
        >
          <X size={14} />
        </Button>
      {/if}
    </div>

    <div class="console-body">
      {#if children}
        {@render children()}
      {:else}
        <ConsoleView {store} />
      {/if}
    </div>
  </section>
{/if}

<style>
  .console-drawer {
    background-color: var(--card);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    user-select: none;
  }

  .resize-handle {
    height: 8px;
    width: 100%;
    cursor: ns-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    touch-action: none;
  }

  .resize-handle:hover .handle-bar {
    background-color: var(--primary);
  }

  .handle-bar {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background-color: var(--border);
    transition: background-color 0.2s ease;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 12px;
    background-color: var(--card);
    border-bottom: 1px solid var(--border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .drawer-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .console-body {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  @media (max-width: 768px) {
    .resize-handle {
      display: none;
    }

    .console-drawer {
      height: 75dvh !important;
      max-height: 80dvh;
      flex: 1;
    }
  }
</style>
