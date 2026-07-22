<script lang="ts">
  import { consoleStore, type ConsoleStore, type ConsoleSpan } from '$lib/events/console-store.svelte';
  import { onMount, tick } from 'svelte';
  import { Download, ArrowDown } from 'lucide-svelte';

  const ROW_HEIGHT = 20;
  const ALLOWED_CLASSES = new Set([
    'fg-black', 'fg-red', 'fg-green', 'fg-yellow', 'fg-blue', 'fg-magenta', 'fg-cyan', 'fg-white',
    'bg-black', 'bg-red', 'bg-green', 'bg-yellow', 'bg-blue', 'bg-magenta', 'bg-cyan', 'bg-white',
    'bold', 'dim', 'italic', 'underline'
  ]);

  let { store = consoleStore }: { store?: ConsoleStore } = $props();

  let filterText = $state('');
  let containerRef = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let containerHeight = $state(300);
  let autoScroll = $state(true);

  const filteredRows = $derived(
    store.rows.filter((row) => {
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
    if (containerRef && autoScroll) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  }

  $effect(() => {
    // Re-run whenever store.rows or filteredRows length changes
    const _ = filteredRows.length;
    if (autoScroll) {
      scrollToBottom();
    }
  });

  function jumpToLatest() {
    autoScroll = true;
    if (containerRef) {
      containerRef.scrollTop = containerRef.scrollHeight;
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
      <input
        type="text"
        placeholder="Filter console..."
        bind:value={filterText}
        class="filter-input"
      />
      <div class="status-indicators">
        <span class="status-tag status-{store.connectionState}">
          {store.connectionState}
        </span>
        {#if store.gapState}
          <span class="status-tag status-gap">resyncing</span>
        {/if}
      </div>
    </div>

    <div class="toolbar-right">
      {#if !autoScroll}
        <button type="button" class="btn-jump" onclick={jumpToLatest}>
          <ArrowDown size={14} />
          <span>Jump to latest</span>
        </button>
      {/if}

      <a href="/api/console/log" download class="btn-download">
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
          <div class="console-row">
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

  .filter-input {
    background-color: var(--input-bg, #0d1117);
    border: 1px solid var(--border-color, #30363d);
    color: var(--text, #c9d1d9);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    width: 180px;
  }

  .filter-input:focus {
    outline: none;
    border-color: var(--accent, #58a6ff);
  }

  .status-indicators {
    display: flex;
    gap: 4px;
  }

  .status-tag {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-connected {
    background-color: rgba(46, 160, 67, 0.2);
    color: #3fb950;
  }

  .status-connecting {
    background-color: rgba(210, 153, 34, 0.2);
    color: #d29922;
  }

  .status-disconnected {
    background-color: rgba(248, 81, 73, 0.2);
    color: #f85149;
  }

  .status-gap {
    background-color: rgba(210, 153, 34, 0.2);
    color: #d29922;
  }

  .btn-jump, .btn-download {
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

  .btn-jump:hover, .btn-download:hover {
    background-color: var(--button-hover-bg, #30363d);
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

  /* ANSI Color classes */
  :global(.fg-black) { color: #4e4e4e; }
  :global(.fg-red) { color: #ff6b6b; }
  :global(.fg-green) { color: #51cf66; }
  :global(.fg-yellow) { color: #fcc419; }
  :global(.fg-blue) { color: #339af0; }
  :global(.fg-magenta) { color: #cc5de8; }
  :global(.fg-cyan) { color: #22b8cf; }
  :global(.fg-white) { color: #e9ecef; }

  :global(.bg-black) { background-color: #212529; }
  :global(.bg-red) { background-color: #c92a2a; }
  :global(.bg-green) { background-color: #2b8a3e; }
  :global(.bg-yellow) { background-color: #e67700; }
  :global(.bg-blue) { background-color: #1864ab; }
  :global(.bg-magenta) { background-color: #862e9c; }
  :global(.bg-cyan) { background-color: #0b7285; }
  :global(.bg-white) { background-color: #f8f9fa; }

  :global(.bold) { font-weight: bold; }
  :global(.dim) { opacity: 0.6; }
  :global(.italic) { font-style: italic; }
  :global(.underline) { text-decoration: underline; }
</style>
