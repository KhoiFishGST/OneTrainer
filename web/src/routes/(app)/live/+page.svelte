<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles, Archive, Save } from '@lucide/svelte';
  import { trainingStore } from '$lib/events/training-store';
  import { api } from '$lib/api/client';
  import {
    createRequestSampleMutation,
    createRequestBackupMutation,
    createRequestSaveMutation,
    createGalleryCurrentQuery,
  } from '$lib/api/queries';
  import MetricsChart from '$lib/components/charts/MetricsChart.svelte';
  import GpuMonitor from '$lib/components/training/GpuMonitor.svelte';
  import SampleGallery from '$lib/components/training/SampleGallery.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import { Alert } from '$lib/components/ui/alert';
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
  });

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
      <div class="charts-grid">
        <MetricsChart {metrics} metricKey="loss" title="Training Loss" height={280} />
        <MetricsChart {metrics} metricKey="lr" title="Learning Rate" height={280} />
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
    transition: width 0.3s ease;
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
