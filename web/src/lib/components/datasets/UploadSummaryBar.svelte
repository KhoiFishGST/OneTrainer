<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  let {
    totals,
    onCancelAll = () => {},
  }: {
    totals: { files: number; done: number; failed: number; sent: number; total: number };
    onCancelAll?: () => void;
  } = $props();

  let percent = $derived(
    totals.total > 0 ? Math.round((totals.sent / totals.total) * 100) : 0
  );

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
</script>

<div
  class="sticky top-0 z-20 flex items-center gap-4 rounded-md border border-border bg-card/95 px-4 py-3 backdrop-blur"
  aria-live="polite"
>
  <div class="flex flex-col gap-1.5 flex-1 min-w-0">
    <span class="text-sm text-foreground">
      Uploading {totals.done} of {totals.files} · {formatBytes(totals.sent)} / {formatBytes(totals.total)}
      {#if totals.failed > 0}
        · <span class="text-destructive">{totals.failed} failed</span>
      {/if}
    </span>
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Overall upload progress"
      class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div class="h-full bg-primary transition-[width] duration-[var(--motion-duration-enter)] ease-[var(--motion-ease-enter)]" style="width: {percent}%"></div>
    </div>
  </div>
  <Button variant="ghost" size="sm" onclick={onCancelAll}>Cancel All</Button>
</div>
