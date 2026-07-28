<script lang="ts">
  import { consoleStore, type ConsoleStore } from '$lib/events/console-store.svelte';
  import { onMount, tick } from 'svelte';
  import { Download, ArrowDown, Pause, Play, Trash2 } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
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

<div class="console-view flex flex-col h-full w-full bg-background text-foreground font-mono text-xs overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border gap-2 flex-wrap">
    <div class="flex items-center gap-2">
      <!-- Channel Selector -->
      <div class="flex bg-muted border border-border rounded p-0.5 gap-0.5" role="radiogroup" aria-label="Log Channel">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={`h-6 px-2 text-xs font-medium rounded transition-colors ${activeChannel === 'console' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onclick={() => (activeChannel = 'console')}
        >
          Console
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={`h-6 px-2 text-xs font-medium rounded transition-colors ${activeChannel === 'webui' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onclick={() => (activeChannel = 'webui')}
        >
          Web UI
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={`h-6 px-2 text-xs font-medium rounded transition-colors ${activeChannel === 'all' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
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
        class="h-6 w-40 bg-muted border border-border text-foreground px-2 rounded text-xs focus:outline-none focus:border-primary"
      />

      <div class="flex gap-1">
        {#if store.connectionState === 'connected'}
          <Badge variant="outline" class="status-tag px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold uppercase bg-success-surface text-success border-success/30">
            {store.connectionState}
          </Badge>
        {:else if store.connectionState === 'connecting'}
          <Badge variant="outline" class="status-tag px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold uppercase bg-warning-surface text-warning border-warning/30">
            {store.connectionState}
          </Badge>
        {:else}
          <Badge variant="outline" class="status-tag px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold uppercase bg-destructive-surface text-destructive border-destructive/40">
            {store.connectionState}
          </Badge>
        {/if}

        {#if store.gapState}
          <Badge variant="secondary" class="px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold uppercase bg-warning-surface text-warning border-warning/30">
            resyncing
          </Badge>
        {/if}
        {#if isPaused}
          <Badge variant="secondary" class="px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold uppercase bg-warning-surface text-warning border-warning/30">
            PAUSED
          </Badge>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class={`inline-flex items-center gap-1 h-6 px-2 text-xs rounded bg-muted border border-border hover:bg-border ${isPaused ? 'bg-warning-surface text-warning border-warning/30' : 'text-foreground'}`}
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

      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="inline-flex items-center gap-1 h-6 px-2 text-xs rounded bg-muted border border-border text-foreground hover:bg-border"
        onclick={handleClear}
        title="Clear view buffer"
      >
        <Trash2 size={14} />
        <span>Clear</span>
      </Button>

      {#if !autoScroll && !isPaused}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="inline-flex items-center gap-1 h-6 px-2 text-xs rounded bg-muted border border-border text-foreground hover:bg-border"
          onclick={jumpToLatest}
        >
          <ArrowDown size={14} />
          <span>Latest</span>
        </Button>
      {/if}

      <a
        href="/api/console/log"
        download
        class="inline-flex items-center gap-1 h-6 px-2 text-xs rounded bg-muted border border-border text-foreground hover:bg-border no-underline max-md:min-h-[44px]"
      >
        <Download size={14} />
        <span>Download Log</span>
      </a>
    </div>
  </div>

  <div
    class="terminal-viewport flex-1 overflow-y-auto relative px-2 py-1"
    bind:this={containerRef}
    onscroll={handleScroll}
    role="region"
    aria-label="Terminal Output Viewport"
  >
    <div class="relative w-full" style="height: {totalHeight}px;">
      <div class="absolute top-0 left-0 right-0 will-change-transform" style="transform: translateY({topOffset}px);">
        {#each visibleRows as row (row.id)}
          <div class={`console-row h-5 leading-5 whitespace-pre overflow-hidden text-ellipsis ${row.channel === 'webui' ? 'opacity-85' : ''}`}>
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
  /* Third-party boundary: spans emitted by the ANSI renderer, not authored here */
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
