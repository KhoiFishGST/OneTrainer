<script lang="ts">
  import { consoleStore, type ConsoleStore } from '$lib/events/console-store.svelte';
  import { onMount, tick } from 'svelte';
  import { Download, ArrowDown, Pause, Play, Trash2 } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import { Badge } from '$lib/components/ui/badge';

  const ROW_HEIGHT = 20;
  const ALLOWED_CLASSES = new Set([
    'fg-black', 'fg-red', 'fg-green', 'fg-yellow', 'fg-blue', 'fg-magenta', 'fg-cyan', 'fg-white',
    'bg-black', 'bg-red', 'bg-green', 'bg-yellow', 'bg-blue', 'bg-magenta', 'bg-cyan', 'bg-white',
    'bold', 'dim', 'italic', 'underline'
  ]);

  let { store = consoleStore }: { store?: ConsoleStore } = $props();

  let filterText = $state('');
  let activeChannel = $state<'console' | 'webui' | 'all'>('console');
  let isPaused = $state(false);

  let containerRef = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let containerHeight = $state(300);
  let autoScroll = $state(true);

  const filteredRows = $derived(
    store.rows.filter((row) => {
      const rowChannel = row.channel || 'console';
      if (activeChannel === 'console' && rowChannel !== 'console') return false;
      if (activeChannel === 'webui' && rowChannel !== 'webui') return false;

      if (!filterText) return true;
      const lower = filterText.toLowerCase();
      return row.spans.some((span) => span.text.toLowerCase().includes(lower));
    })
  );

  const totalHeight = $derived(filteredRows.length * ROW_HEIGHT);
  const buffer = 5;

  const startIndex = $derived(
    Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer)
  );

  const endIndex = $derived(
    Math.min(
      filteredRows.length,
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + buffer
    )
  );

  const visibleRows = $derived(filteredRows.slice(startIndex, endIndex));
  const topOffset = $derived(startIndex * ROW_HEIGHT);

  function handleScroll(e: Event) {
    const el = e.currentTarget as HTMLDivElement;
    scrollTop = el.scrollTop;
    containerHeight = el.clientHeight;

    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScroll = isAtBottom;
  }

  async function scrollToBottom() {
    await tick();
    if (containerRef && autoScroll && !isPaused) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  }

  $effect(() => {
    const _ = filteredRows.length;
    if (autoScroll && !isPaused) {
      scrollToBottom();
    }
  });

  function jumpToLatest() {
    autoScroll = true;
    isPaused = false;
    if (containerRef) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  }

  function handleClear() {
    store.clear();
  }

  function togglePause() {
    isPaused = !isPaused;
    if (!isPaused) {
      jumpToLatest();
    }
  }

  function filterClasses(classes: string[]): string {
    if (!classes || !classes.length) return '';
    return classes.filter((c) => ALLOWED_CLASSES.has(c)).join(' ');
  }

  onMount(() => {
    if (containerRef) {
      containerHeight = containerRef.clientHeight;
    }
  });
</script>

<div class="console-view">
  <div class="toolbar">
    <div class="toolbar-left">
      <!-- Channel Selector -->
      <div class="channel-selector" role="radiogroup" aria-label="Log Channel">
        <Button
          type="button"
          class={`channel-btn${activeChannel === 'console' ? ' active' : ''}`}
          onclick={() => (activeChannel = 'console')}
        >
          Console
        </Button>
        <Button
          type="button"
          class={`channel-btn${activeChannel === 'webui' ? ' active' : ''}`}
          onclick={() => (activeChannel = 'webui')}
        >
          Web UI
        </Button>
        <Button
          type="button"
          class={`channel-btn${activeChannel === 'all' ? ' active' : ''}`}
          onclick={() => (activeChannel = 'all')}
        >
          ALL
        </Button>
      </div>

      <TextInput
        type="search"
        placeholder="Filter console..."
        value={filterText}
        onInput={(value) => (filterText = value)}
        class="filter-input"
      />

      <div class="status-indicators">
        <Badge variant="outline" class={`status-tag status-${store.connectionState}`}>
          {store.connectionState}
        </Badge>
        {#if store.gapState}
          <Badge variant="secondary" class="status-tag status-gap">
            resyncing
          </Badge>
        {/if}
        {#if isPaused}
          <Badge variant="secondary" class="status-tag status-paused">
            PAUSED
          </Badge>
        {/if}
      </div>
    </div>

    <div class="toolbar-right">
      <Button
        type="button"
        class={`btn-action${isPaused ? ' active' : ''}`}
        onclick={togglePause}
        title={isPaused ? 'Resume stream' : 'Pause stream'}
      >
        {#if isPaused}
          <Play size={14} />
          <span>Resume</span>
        {:else}
          <Pause size={14} />
          <span>Pause</span>
        {/if}
      </Button>

      <Button type="button" class="btn-action" onclick={handleClear} title="Clear view buffer">
        <Trash2 size={14} />
        <span>Clear</span>
      </Button>

      {#if !autoScroll && !isPaused}
        <Button type="button" class="btn-action btn-jump" onclick={jumpToLatest}>
          <ArrowDown size={14} />
          <span>Latest</span>
        </Button>
      {/if}

      <a href="/api/console/log" download class="btn-action btn-download">
        <Download size={14} />
        <span>Download Log</span>
      </a>
    </div>
  </div>

  <div
    class="terminal-viewport"
    bind:this={containerRef}
    onscroll={handleScroll}
  >
    <div class="spacer" style="height: {totalHeight}px;">
      <div class="visible-window" style="transform: translateY({topOffset}px);">
        {#each visibleRows as row (row.id)}
          <div class="console-row" class:channel-webui={row.channel === 'webui'}>
            {#each row.spans as span}
              <span class={filterClasses(span.classes)}>{span.text}</span>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .console-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--bg-dark, #0d1117);
    color: var(--text-dark, #c9d1d9);
    font-family: monospace;
    font-size: 0.8125rem;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background-color: var(--panel-bg, #161b22);
    border-bottom: 1px solid var(--border-color, #30363d);
    gap: 8px;
    flex-wrap: wrap;
  }

  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .channel-selector {
    display: flex;
    background-color: var(--input-bg, #0d1117);
    border: 1px solid var(--border-color, #30363d);
    border-radius: 4px;
    padding: 2px;
    gap: 2px;
  }

  .console-view :global(.channel-btn) {
    background: transparent;
    border: none;
    color: var(--muted, #8b949e);
    padding: 2px 8px;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .console-view :global(.channel-btn:hover) {
    color: var(--text, #c9d1d9);
  }

  .console-view :global(.channel-btn.active) {
    background-color: var(--accent, #6366f1);
    color: #ffffff;
  }

  .console-view :global(.filter-input) {
    background-color: var(--input-bg, #0d1117);
    border: 1px solid var(--border-color, #30363d);
    color: var(--text, #c9d1d9);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    width: 160px;
  }

  .console-view :global(.filter-input:focus) {
    outline: none;
    border-color: var(--accent, #58a6ff);
  }

  .status-indicators {
    display: flex;
    gap: 4px;
  }

  .console-view :global(.status-tag) {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .console-view :global(.status-connected) {
    background-color: rgba(46, 160, 67, 0.2);
    color: #3fb950;
    border-color: rgba(46, 160, 67, 0.3);
  }

  .console-view :global(.status-connecting) {
    background-color: rgba(210, 153, 34, 0.2);
    color: #d29922;
    border-color: rgba(210, 153, 34, 0.3);
  }

  .console-view :global(.status-disconnected) {
    background-color: rgba(248, 81, 73, 0.2);
    color: #f85149;
    border-color: rgba(248, 81, 73, 0.3);
  }

  .console-view :global(.status-gap), .console-view :global(.status-paused) {
    background-color: rgba(210, 153, 34, 0.2);
    color: #d29922;
    border-color: rgba(210, 153, 34, 0.3);
  }

  .console-view :global(.btn-action) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background-color: var(--button-bg, #21262d);
    color: var(--text, #c9d1d9);
    border: 1px solid var(--border-color, #30363d);
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    text-decoration: none;
  }

  .console-view :global(.btn-action:hover) {
    background-color: var(--button-hover-bg, #30363d);
  }

  .console-view :global(.btn-action.active) {
    background-color: rgba(210, 153, 34, 0.2);
    color: #d29922;
    border-color: #d29922;
  }

  .terminal-viewport {
    flex: 1;
    overflow-y: auto;
    position: relative;
    padding: 4px 8px;
  }

  .spacer {
    position: relative;
    width: 100%;
  }

  .visible-window {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    will-change: transform;
  }

  .console-row {
    height: 20px;
    line-height: 20px;
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .console-row.channel-webui {
    opacity: 0.85;
  }

  /* ANSI Color classes */
  .console-view :global(.fg-black) { color: #4e4e4e; }
  .console-view :global(.fg-red) { color: #ff6b6b; }
  .console-view :global(.fg-green) { color: #51cf66; }
  .console-view :global(.fg-yellow) { color: #fcc419; }
  .console-view :global(.fg-blue) { color: #339af0; }
  .console-view :global(.fg-magenta) { color: #cc5de8; }
  .console-view :global(.fg-cyan) { color: #22b8cf; }
  .console-view :global(.fg-white) { color: #e9ecef; }

  .console-view :global(.bg-black) { background-color: #212529; }
  .console-view :global(.bg-red) { background-color: #c92a2a; }
  .console-view :global(.bg-green) { background-color: #2b8a3e; }
  .console-view :global(.bg-yellow) { background-color: #e67700; }
  .console-view :global(.bg-blue) { background-color: #1864ab; }
  .console-view :global(.bg-magenta) { background-color: #862e9c; }
  .console-view :global(.bg-cyan) { background-color: #0b7285; }
  .console-view :global(.bg-white) { background-color: #f8f9fa; }

  .console-view :global(.bold) { font-weight: bold; }
  .console-view :global(.dim) { opacity: 0.6; }
  .console-view :global(.italic) { font-style: italic; }
  .console-view :global(.underline) { text-decoration: underline; }
</style>
