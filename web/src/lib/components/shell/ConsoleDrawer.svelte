<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { Maximize2, X } from 'lucide-svelte';
  import ConsoleView from '$lib/components/console/ConsoleView.svelte';
  import { consoleStore, type ConsoleStore } from '$lib/events/console-store.svelte';
  import Button from '../ui/Button.svelte';

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

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const savedHeight = localStorage.getItem('console_drawer_height');
      if (savedHeight) {
        const parsed = parseInt(savedHeight, 10);
        if (!isNaN(parsed) && parsed >= 100 && parsed <= 800) {
          drawerHeight = parsed;
        }
      }
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
    const newHeight = Math.min(Math.max(100, startHeight + deltaY), window.innerHeight * 0.8);
    drawerHeight = newHeight;
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
      const maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 800;
      drawerHeight = Math.min(drawerHeight + 10, maxHeight);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('console_drawer_height', drawerHeight.toString());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      drawerHeight = Math.max(drawerHeight - 10, 100);
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
        <a href="/console" class="btn-icon" title="Open Fullpage Console">
          <Maximize2 size={14} />
        </a>
      </div>
      {#if onClose}
        <Button
          variant="ghost"
          size="icon"
          class="btn-icon"
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
    background-color: var(--panel-raised, #161b22);
    border-top: 1px solid var(--line, #30363d);
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
    background-color: var(--accent, #58a6ff);
  }

  .handle-bar {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background-color: var(--line, #30363d);
    transition: background-color 0.2s ease;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 12px;
    background-color: var(--panel-bg, #0d1117);
    border-bottom: 1px solid var(--line, #30363d);
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
    color: var(--text-muted, #8b949e);
  }

  .drawer-header :global(.btn-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted, #8b949e);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    text-decoration: none;
  }

  .drawer-header :global(.btn-icon:hover) {
    color: var(--text, #c9d1d9);
    background-color: var(--button-hover-bg, #21262d);
  }

  .drawer-header :global(button.btn-icon) {
    min-height: 0;
    width: auto;
    height: auto;
  }

  .console-body {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
