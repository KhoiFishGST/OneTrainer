<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles, Archive, Save } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trainingStore } from '$lib/events/training-store';
  import { viewingRunStore } from '$lib/events/viewing-run-store';
  import { api } from '$lib/api/client';
  import {
    createRequestSampleMutation,
    createRequestBackupMutation,
    createRequestSaveMutation,
    createGalleryCurrentQuery,
  } from '$lib/api/queries';
  import MetricsChart, { type ChartSeries } from '$lib/components/charts/MetricsChart.svelte';
  import { humanizeMetricKey } from '$lib/components/charts/format';
  import type { TrainingMetric } from '$lib/api/types';
  import GpuMonitor from '$lib/components/training/GpuMonitor.svelte';
  import SampleGallery from '$lib/components/training/SampleGallery.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select/index.js';
  import { toast as sonnerToast } from 'svelte-sonner';

  const sampleMutation = createRequestSampleMutation();
  const backupMutation = createRequestBackupMutation();
  const saveMutation = createRequestSaveMutation();
  const galleryQuery = createGalleryCurrentQuery();

  function triggerToast(message: string, type: 'success' | 'error' = 'success') {
    if (type === 'error') {
      sonnerToast.error(message);
    } else {
      sonnerToast.success(message);
    }
  }

  const status = $derived($trainingStore.status);
  const metrics = $derived($trainingStore.metrics);
  const gpuStats = $derived($trainingStore.gpuStats);
  const gallery = $derived($galleryQuery.data);
  const galleryLoading = $derived($galleryQuery.isLoading);
  const galleryError = $derived($galleryQuery.error);

  const viewing = $derived($viewingRunStore);

  // Charts read whichever run the user is looking at. The training store stays
  // the live SSE mirror and is never mutated with historical rows.
  const chartMetrics = $derived(viewing.mode === 'historical' ? viewing.rows : metrics);

  let availableRuns = $state<{ key: string }[]>([]);
  let announcedTrainingStart = $state(false);

  // Series are discovered from the rows rather than hardcoded, so new parameter
  // groups or new trainer scalars appear on the charts automatically.
  //
  // The scan is incremental because it runs on every metric event: the store
  // hands us a fresh array each time, so a full rescan would be O(rows x keys)
  // per training step, twice over. Scalar keys are stable within a run, so we
  // only look at rows we have not seen -- plus the newest row, which is the one
  // that can introduce a key once the store's ring buffer stops growing.
  let seenKeys = new Set<string>();
  let seenCount = 0;
  let seenToken = '';

  function numericKeysOf(rows: TrainingMetric[], token: string): string[] {
    if (token !== seenToken) {
      seenToken = token;
      seenKeys = new Set();
      seenCount = 0;
    }

    const start = Math.max(0, Math.min(seenCount, rows.length - 1));
    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      for (const key in row) {
        if (typeof row[key] === 'number') seenKeys.add(key);
      }
    }
    seenCount = rows.length;

    // A fresh sorted array, not the mutable Set: returning the same object
    // identity every time would let Svelte treat an added key as "unchanged"
    // and never propagate it to the charts.
    return [...seenKeys].sort();
  }

  function toSeries(keys: string[], matches: (key: string) => boolean): ChartSeries[] {
    return keys.filter(matches).map((key) => ({ key, label: humanizeMetricKey(key) }));
  }

  const metricKeys = $derived(
    numericKeysOf(chartMetrics, `${viewing.mode}:${viewing.runKey ?? ''}`)
  );

  const lossSeries = $derived(
    toSeries(metricKeys, (k) => k.startsWith('loss_') || k.startsWith('smooth_loss_'))
  );
  const lrSeries = $derived(toSeries(metricKeys, (k) => k.startsWith('lr_')));

  onMount(async () => {
    try {
      const statusData = await api.getTrainingStatus();
      if (statusData) trainingStore.setStatus(statusData);

      const metricsData = await api.getTrainingMetrics();
      if (metricsData) trainingStore.setMetrics(metricsData);

      const gpuData = await api.getGpuStats();
      if (gpuData) trainingStore.setGpuStats(gpuData);
    } catch (e) {
      // ignore
    }

    try {
      const runs = await api.getGalleryRuns();
      availableRuns = runs?.runs ?? [];
    } catch (e) {
      availableRuns = [];
    }

    const requestedRun = $page.url.searchParams.get('run');
    if (requestedRun) {
      await viewingRunStore.showRun(requestedRun);
    } else {
      // The store is a module singleton, so without this a run selected before
      // navigating away would still be showing -- with no ?run= in the URL to
      // explain it -- when the page remounts.
      viewingRunStore.showLive();
    }
  });

  // Training starting must never silently replace what the user is reading.
  $effect(() => {
    const isTraining = status.state === 'TRAINING';
    if (!isTraining) {
      announcedTrainingStart = false;
      return;
    }
    if (viewing.mode !== 'historical' || announcedTrainingStart) return;

    announcedTrainingStart = true;
    sonnerToast('Training started', {
      description: 'You are viewing a past run.',
      action: { label: 'Switch to live', onClick: () => backToLive() },
    });
  });

  function backToLive() {
    viewingRunStore.showLive();
    syncRunParam('');
  }

  function onSelectRun(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (!value) {
      viewingRunStore.showLive();
    } else {
      viewingRunStore.showRun(value);
    }
    syncRunParam(value);
  }

  // Keep ?run= in step with the selector, so reloading or sharing the URL shows
  // the run actually on screen rather than whichever one it was opened with.
  function syncRunParam(runKey: string) {
    const target = runKey ? `/live?run=${encodeURIComponent(runKey)}` : '/live';
    try {
      goto(target, { replaceState: true, keepFocus: true, noScroll: true });
    } catch (e) {
      // Navigation is a convenience here; the store is already updated.
    }
  }

  const stepPct = $derived(
    status.max_steps > 0
      ? Math.min(100, Math.max(0, (status.step / status.max_steps) * 100))
      : 0
  );

  function formatTime(seconds: number): string {
    if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function handleSample() {
    try {
      await $sampleMutation.mutateAsync();
      triggerToast('Sample generation requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request sample', 'error');
    }
  }

  async function handleBackup() {
    try {
      await $backupMutation.mutateAsync();
      triggerToast('Model backup requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request backup', 'error');
    }
  }

  async function handleSave() {
    try {
      await $saveMutation.mutateAsync();
      triggerToast('Model save requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request model save', 'error');
    }
  }
</script>

<RoutePage>
  <div class="live-dashboard" data-testid="live-dashboard">
    <PageHeader title="Live Training Dashboard" class="mb-2">
      {#snippet status()}
        <span class="status-badge status-{($trainingStore.status?.state || 'IDLE').toLowerCase()}">
          {$trainingStore.status?.state || 'IDLE'}
        </span>
      {/snippet}
    </PageHeader>

    {#if status.error_message}
      <Alert variant="destructive" class="mb-2">
        <strong>Training Error:</strong> {status.error_message}
      </Alert>
    {/if}

    <!-- Progress Card -->
    <section class="dashboard-card progress-card" data-testid="progress-card">
      <div class="progress-card-header">
        <h3 class="card-title">Training Progress</h3>
        <div class="progress-stats-summary">
          <span class="stat-highlight">{stepPct.toFixed(1)}%</span>
        </div>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: {stepPct}%;"></div>
        </div>
      </div>

      <div class="metrics-summary-grid">
        <div class="stat-item">
          <span class="stat-label">Steps</span>
          <span class="stat-value">{status.step} / {status.max_steps || '\u221e'}</span>
        </div>

        <div class="stat-item">
          <span class="stat-label">Epoch</span>
          <span class="stat-value">{status.epoch} / {status.max_epochs || '\u221e'}</span>
        </div>

        <div class="stat-item">
          <span class="stat-label">Speed</span>
          <span class="stat-value">
            {#if status.speed_its > 0}
              {status.speed_its.toFixed(2)} it/s
            {:else}
              -- it/s
            {/if}
          </span>
        </div>

        <div class="stat-item">
          <span class="stat-label">Elapsed Time</span>
          <span class="stat-value">{formatTime(status.elapsed_seconds)}</span>
        </div>

        <div class="stat-item">
          <span class="stat-label">ETA</span>
          <span class="stat-value">{formatTime(status.eta_seconds)}</span>
        </div>
      </div>
    </section>

    <!-- Metrics Charts -->
    <section class="charts-section">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-2">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Viewing</span>
          <NativeSelect
            class="bg-muted text-foreground border border-border rounded px-2 py-1 text-sm"
            aria-label="Viewing run"
            value={viewing.mode === 'historical' ? (viewing.runKey ?? '') : ''}
            onchange={onSelectRun}
          >
            <NativeSelectOption value="">Live</NativeSelectOption>
            {#each availableRuns as run (run.key)}
              <NativeSelectOption value={run.key}>{run.key}</NativeSelectOption>
            {/each}
          </NativeSelect>
        </label>

        {#if viewing.loading}
          <span class="text-sm text-muted-foreground">Loading run…</span>
        {/if}
      </div>

      {#if viewing.error}
        <Alert variant="destructive" class="mb-2">{viewing.error}</Alert>
      {:else if viewing.mode === 'historical'}
        <Alert class="mb-2" data-testid="historical-run-banner">
          Viewing historical run <strong>{viewing.runKey}</strong> — these charts are not live.
          <Button
            type="button"
            variant="secondary"
            size="sm"
            class="ml-2"
            onclick={backToLive}
          >
            Back to live
          </Button>
        </Alert>
      {/if}

      <div class="charts-grid">
        <MetricsChart metrics={chartMetrics} series={lossSeries} title="Training Loss" height={280} />
        <MetricsChart metrics={chartMetrics} series={lrSeries} title="Learning Rate" height={280} />
      </div>
    </section>

    <!-- GPU Telemetry Monitor -->
    <section class="gpu-section">
      <GpuMonitor {gpuStats} />
    </section>

    <!-- Live Sample Gallery -->
    <section class="gallery-section">
      <SampleGallery
        {gallery}
        loading={galleryLoading}
        error={galleryError}
        title="Latest Sample Set"
        sortOrder="desc"
        limit={1}
      />
    </section>
  </div>
</RoutePage>

<style>
  .live-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }


  .status-badge {
    padding: 0.35rem 0.85rem;
    border-radius: 16px;
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-idle {
    background-color: var(--card, rgba(255, 255, 255, 0.05));
    color: var(--muted-foreground);
    border: 1px solid var(--border);
  }

  .status-starting,
  .status-training {
    background-color: rgba(59, 130, 246, 0.15);
    color: rgb(59, 130, 246);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status-paused {
    background-color: rgba(245, 158, 11, 0.15);
    color: rgb(245, 158, 11);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-stopping,
  .status-failed {
    background-color: rgba(239, 68, 68, 0.15);
    color: rgb(239, 68, 68);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-completed {
    background-color: rgba(16, 185, 129, 0.15);
    color: rgb(16, 185, 129);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .dashboard-card {
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .card-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ring);
  }

  .progress-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .progress-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-highlight {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--ring);
  }

  .progress-bar-container {
    width: 100%;
  }

  .progress-bar-track {
    height: 12px;
    background-color: var(--muted);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--border);
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, rgb(59, 130, 246), rgb(99, 102, 241));
    border-radius: 6px;
    transition: width var(--motion-duration-layout) var(--motion-ease-enter);
  }

  .metrics-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }
</style>
