<script lang="ts">
  import { X, RotateCw, AlertCircle } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { UploadEntry } from '$lib/upload/upload-queue.svelte';

  let {
    entry,
    onCancel = () => {},
    onRetry = () => {},
  }: {
    entry: UploadEntry;
    onCancel?: (id: string) => void;
    onRetry?: (id: string) => void;
  } = $props();

  let percent = $derived(
    entry.total > 0 ? Math.round((entry.sent / entry.total) * 100) : 0
  );
  let inFlight = $derived(entry.status === 'queued' || entry.status === 'uploading');

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
</script>

<Card.Root class="overflow-hidden flex flex-col p-0 bg-card border border-border rounded-lg">
  <div class="w-full aspect-square bg-slate-950 flex flex-col items-center justify-center gap-3 p-4">
    {#if entry.status === 'error'}
      <AlertCircle size={32} class="text-destructive" />
      <span class="text-xs text-destructive text-center break-words">{entry.error}</span>
      <Button variant="outline" size="sm" class="gap-1.5" onclick={() => onRetry(entry.id)}>
        <RotateCw size={14} />
        Retry
      </Button>
    {:else if entry.status === 'processing'}
      <div class="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      <span class="text-xs text-muted-foreground">Processing…</span>
    {:else}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress for {entry.filename}"
        class="w-full h-2 rounded-full bg-muted overflow-hidden"
      >
        <div class="h-full bg-primary transition-[width] duration-200" style="width: {percent}%"></div>
      </div>
      <span class="text-xs text-muted-foreground">
        {formatBytes(entry.sent)} / {formatBytes(entry.total)}
      </span>
      {#if inFlight}
        <Button
          variant="ghost"
          size="sm"
          class="gap-1.5"
          aria-label="Cancel upload of {entry.filename}"
          onclick={() => onCancel(entry.id)}
        >
          <X size={14} />
          Cancel
        </Button>
      {/if}
    {/if}
  </div>
  <Card.Content class="p-3">
    <span class="text-xs font-semibold text-muted-foreground break-all">{entry.filename}</span>
  </Card.Content>
</Card.Root>
