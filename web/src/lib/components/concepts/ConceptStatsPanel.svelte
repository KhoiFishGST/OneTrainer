<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import { api } from '$lib/api/client';
  import { Button } from '$lib/components/ui/button';
  import { RefreshCw, AlertTriangle } from '@lucide/svelte';

  let {
    draft,
  }: {
    draft: Concept;
  } = $props();

  let statsLoading = $state(false);
  let statsData = $state<Record<string, any> | null>(null);

  async function fetchStats(advanced = false) {
    if (!draft?.path) return;
    statsLoading = true;
    try {
      statsData = await api.getConceptStats(
        draft.path,
        advanced,
        draft.include_subdirectories || false
      );
    } catch {
      // Gracefully retain current stats state on failure
    } finally {
      statsLoading = false;
    }
  }

  $effect(() => {
    if (draft?.path && !statsData && !statsLoading) {
      fetchStats(false);
    }
  });

  function formatBytes(bytes?: number): string {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatPixelText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${(arr[0] / 1000000).toFixed(2)} MP, ${arr[2] || ''}\n${arr[1] || ''}`;
  }

  function formatCaptionText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${arr[0]} chars, ${arr[2] || 0} words\n${arr[1] || ''}`;
  }

  function formatLengthText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${Math.round(arr[0])} frames\n${arr[1] || ''}`;
  }

  function formatFpsText(arr: any, count = 0): string {
    if (!arr || typeof arr === 'string' || !Array.isArray(arr) || arr.length < 2 || count === 0 || arr[0] >= 1000000000) {
      return '-';
    }
    return `${Math.round(arr[0])} fps\n${arr[1] || ''}`;
  }

  function decimalToAspectRatio(val: number): string {
    if (!val) return '1:1';
    if (Math.abs(val - 1.0) < 0.02) return '1:1';
    if (Math.abs(val - 0.75) < 0.02) return '4:3';
    if (Math.abs(val - 1.333333) < 0.02) return '3:4';
    if (Math.abs(val - 0.5625) < 0.02) return '16:9';
    if (Math.abs(val - 1.777778) < 0.02) return '9:16';
    if (Math.abs(val - 0.5) < 0.02) return '2:1';
    if (Math.abs(val - 2.0) < 0.02) return '1:2';
    if (Math.abs(val - 0.666667) < 0.02) return '3:2';
    if (Math.abs(val - 1.5) < 0.02) return '2:3';
    if (Math.abs(val - 0.8) < 0.02) return '5:4';
    if (Math.abs(val - 1.25) < 0.02) return '4:5';
    return val.toFixed(2);
  }

  function getSmallestBuckets(buckets?: Record<string, number>): string {
    if (!buckets) return '-';
    const entries = Object.entries(buckets)
      .map(([k, v]) => ({ aspect: parseFloat(k), count: v }))
      .filter((b) => b.count > 0);
    if (entries.length === 0) return '-';
    const minVal = Math.min(...entries.map((e) => e.count));
    const minEntries = entries.filter((e) => e.count === minVal);
    return minEntries
      .map((e) => `aspect ${decimalToAspectRatio(e.aspect)} : ${e.count} img`)
      .join(', ');
  }
</script>

<div class="stats-tab-wrapper">
  <!-- Action Toolbar -->
  <div class="stats-toolbar">
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={statsLoading}
      onclick={() => fetchStats(false)}
    >
      <RefreshCw size={14} class={statsLoading ? 'animate-spin' : ''} />
      <span>Refresh Basic</span>
    </Button>
    <Button
      type="button"
      variant="default"
      size="sm"
      disabled={statsLoading}
      onclick={() => fetchStats(true)}
    >
      <RefreshCw size={14} class={statsLoading ? 'animate-spin' : ''} />
      <span>Refresh Advanced</span>
    </Button>
    {#if statsData?.processing_time}
      <span class="proc-time-badge">{statsData.processing_time.toFixed(2)} s</span>
    {/if}
  </div>

  <!-- Stats Summary Cards Grid -->
  {#if statsData}
    <div class="stats-summary-grid">
      <div class="stat-card">
        <span class="stat-label">Total Size</span>
        <span class="stat-value">{formatBytes(statsData.file_size)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Directories</span>
        <span class="stat-value">{statsData.directory_count ?? 0}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Images</span>
        <span class="stat-value">{statsData.image_count ?? 0}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Images with Masks</span>
        <span class="stat-value">{statsData.image_with_mask_count ?? '-'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Images with Captions</span>
        <span class="stat-value">{statsData.image_with_caption_count ?? '-'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Videos</span>
        <span class="stat-value">{statsData.video_count ?? 0}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Videos with Captions</span>
        <span class="stat-value">{statsData.video_with_caption_count ?? '-'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Masks</span>
        <span class="stat-value">{statsData.mask_count ?? 0}</span>
      </div>
      <div class="stat-card" class:highlight-warning={statsData.unpaired_masks > 0}>
        <span class="stat-label">Unpaired Masks</span>
        <span class="stat-value">{statsData.unpaired_masks ?? '-'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Captions</span>
        <span class="stat-value">
          {statsData.subcaption_count > 0
            ? `${statsData.caption_count} (${statsData.subcaption_count})`
            : statsData.caption_count ?? 0}
        </span>
      </div>
      <div class="stat-card" class:highlight-warning={statsData.unpaired_captions > 0}>
        <span class="stat-label">Unpaired Captions</span>
        <span class="stat-value">{statsData.unpaired_captions ?? '-'}</span>
      </div>
    </div>

    <!-- Pairing Warning Alerts -->
    {#if statsData.unpaired_masks > 0 || statsData.unpaired_captions > 0}
      <div class="pairing-alert-box" role="alert">
        <AlertTriangle size={18} />
        <div class="alert-content">
          {#if statsData.unpaired_masks > 0}
            <span>Warning: {statsData.unpaired_masks} unpaired mask(s) found!</span>
          {/if}
          {#if statsData.unpaired_captions > 0}
            <span>Warning: {statsData.unpaired_captions} unpaired caption file(s) found!</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Detailed Stats Tables -->
    <div class="stats-sections-grid">
      <!-- Resolution Info -->
      <div class="stats-section-box">
        <h5>Resolution Metrics</h5>
        <div class="stats-kv-stack">
          <div class="kv-item">
            <span class="kv-key">Max Pixels</span>
            <span class="kv-val">{formatPixelText(statsData.max_pixels, statsData.image_count)}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Avg Pixels</span>
            <span class="kv-val">{statsData.image_count > 0 && statsData.avg_pixels && statsData.avg_pixels > 0 ? `${(statsData.avg_pixels / 1000000).toFixed(2)} MP, ~${Math.round(Math.sqrt(statsData.avg_pixels))}w x ${Math.round(Math.sqrt(statsData.avg_pixels))}h` : '-'}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Min Pixels</span>
            <span class="kv-val">{formatPixelText(statsData.min_pixels, statsData.image_count)}</span>
          </div>
        </div>
      </div>

      <!-- Video Length Metrics -->
      <div class="stats-section-box">
        <h5>Video Length Metrics</h5>
        <div class="stats-kv-stack">
          <div class="kv-item">
            <span class="kv-key">Max Length</span>
            <span class="kv-val">{formatLengthText(statsData.max_length, statsData.video_count)}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Avg Length</span>
            <span class="kv-val">{statsData.video_count > 0 && statsData.avg_length && statsData.avg_length > 0 ? `${Math.round(statsData.avg_length)} frames` : '-'}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Min Length</span>
            <span class="kv-val">{formatLengthText(statsData.min_length, statsData.video_count)}</span>
          </div>
        </div>
      </div>

      <!-- Video FPS Metrics -->
      <div class="stats-section-box">
        <h5>Video FPS Metrics</h5>
        <div class="stats-kv-stack">
          <div class="kv-item">
            <span class="kv-key">Max FPS</span>
            <span class="kv-val">{formatFpsText(statsData.max_fps, statsData.video_count)}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Avg FPS</span>
            <span class="kv-val">{statsData.video_count > 0 && statsData.avg_fps && statsData.avg_fps > 0 ? `${Math.round(statsData.avg_fps)} fps` : '-'}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Min FPS</span>
            <span class="kv-val">{formatFpsText(statsData.min_fps, statsData.video_count)}</span>
          </div>
        </div>
      </div>

      <!-- Caption Metrics -->
      <div class="stats-section-box">
        <h5>Caption Metrics</h5>
        <div class="stats-kv-stack">
          <div class="kv-item">
            <span class="kv-key">Max Caption Length</span>
            <span class="kv-val">{formatCaptionText(statsData.max_caption_length, statsData.caption_count)}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Avg Caption Length</span>
            <span class="kv-val">
              {statsData.caption_count > 0 && statsData.avg_caption_length && Array.isArray(statsData.avg_caption_length)
                ? `${Math.round(statsData.avg_caption_length[0] || 0)} chars, ${Math.round(statsData.avg_caption_length[1] || 0)} words`
                : '-'}
            </span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Min Caption Length</span>
            <span class="kv-val">{formatCaptionText(statsData.min_caption_length, statsData.caption_count)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Aspect Bucketing & Histogram -->
    {#if statsData.aspect_buckets && Object.keys(statsData.aspect_buckets).length > 0}
      {@const buckets = Object.entries(statsData.aspect_buckets).map(([k, v]) => ({
        aspect: parseFloat(k),
        ratioStr: decimalToAspectRatio(parseFloat(k)),
        count: Number(v) || 0,
      }))}
      {@const maxCount = Math.max(1, ...buckets.map((b) => b.count))}
      <div class="aspect-histogram-box">
        <div class="aspect-header-row">
          <h5>Aspect Bucketing</h5>
          <div class="small-buckets-preview">
            <span class="lbl">Smallest Buckets:</span>
            <span class="val">{getSmallestBuckets(statsData.aspect_buckets)}</span>
          </div>
        </div>

        <div class="histogram-chart-container">
          <div class="histogram-bars-wrapper">
            {#each buckets as b}
              {@const pct = (b.count / maxCount) * 100}
              <div class="bar-col">
                <span class="bar-count-val">{b.count > 0 ? b.count : ''}</span>
                <div class="bar-track">
                  <div class="bar-fill" style="height: {pct}%"></div>
                </div>
                <span class="bar-ratio-lbl">{b.ratioStr}</span>
              </div>
            {/each}
          </div>

          <div class="histogram-axis-markers">
            <span class="axis-lbl">Wide</span>
            <span class="axis-lbl">Square</span>
            <span class="axis-lbl">Tall</span>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="stats-placeholder-box">
      <RefreshCw size={24} class={statsLoading ? 'animate-spin muted-icon' : 'muted-icon'} />
      {#if !draft?.path}
        <span>Specify a valid concept dataset path in General tab to scan statistics.</span>
      {:else if statsLoading}
        <span>Scanning concept statistics...</span>
      {:else}
        <span>Click "Refresh Basic" or "Refresh Advanced" to scan concept statistics.</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stats-tab-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .stats-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .proc-time-badge {
    margin-left: auto;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted-foreground);
  }

  .stats-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.625rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.625rem 0.75rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .stat-card.highlight-warning {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.05);
  }

  .stat-label {
    font-size: 0.6875rem;
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .stat-value {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--foreground);
  }

  .pairing-alert-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: var(--destructive);
    font-size: 0.8125rem;
  }

  .stats-sections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.875rem;
  }

  .stats-section-box {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.875rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .stats-section-box h5 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .stats-kv-stack {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .kv-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
  }

  .kv-key {
    color: var(--muted-foreground);
  }

  .kv-val {
    color: var(--foreground);
    font-weight: 500;
    text-align: right;
    white-space: pre-line;
  }

  .aspect-histogram-box {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .aspect-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .aspect-header-row h5 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .small-buckets-preview {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .histogram-chart-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .histogram-bars-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    height: 100px;
  }

  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
  }

  .bar-count-val {
    font-size: 0.6875rem;
    color: var(--muted-foreground);
  }

  .bar-track {
    width: 100%;
    height: 70px;
    background: var(--muted);
    border-radius: 3px;
    display: flex;
    align-items: flex-end;
  }

  .bar-fill {
    width: 100%;
    background: var(--primary);
    border-radius: 3px;
    transition: height 0.2s ease;
  }

  .bar-ratio-lbl {
    font-size: 0.6875rem;
    color: var(--muted-foreground);
    margin-top: 0.25rem;
  }

  .histogram-axis-markers {
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: var(--muted-foreground);
    padding: 0 0.5rem;
  }

  .stats-placeholder-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 1.5rem;
    border: 1px dashed var(--border);
    border-radius: 6px;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }
</style>
