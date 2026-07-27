<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles, Archive, Save } from 'lucide-svelte';
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

  const sampleMutation = createRequestSampleMutation();
  const backupMutation = createRequestBackupMutation();
  const saveMutation = createRequestSaveMutation();
  const galleryQuery = createGalleryCurrentQuery();

  let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
  let toastTimeout: any;

  function triggerToast(message: string, type: 'success' | 'error' = 'success') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast = { message, type };
    toastTimeout = setTimeout(() => {
      toast = null;
    }, 4000);
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

<div class="live-dashboard" data-testid="live-dashboard">
  <div class="page-header">
    <div class="header-title-group">
      <h1 class="page-title">Live Training Dashboard</h1>
      <span class="status-badge status-{(status.state || 'IDLE').toLowerCase()}">
        {status.state || 'IDLE'}
      </span>
    </div>

    <div class="header-actions">
      <button
        type="button"
        class="btn btn-secondary"
        disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $sampleMutation.isPending}
        onclick={handleSample}
        title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate sample image generation' : 'Active training run required to sample now'}
      >
        <Sparkles size={16} />
        <span>Sample Now</span>
      </button>

      <button
        type="button"
        class="btn btn-secondary"
        disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $backupMutation.isPending}
        onclick={handleBackup}
        title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate model backup checkpoint' : 'Active training run required to backup now'}
      >
        <Archive size={16} />
        <span>Backup Now</span>
      </button>

      <button
        type="button"
        class="btn btn-secondary"
        disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $saveMutation.isPending}
        onclick={handleSave}
        title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate model save' : 'Active training run required to save model now'}
      >
        <Save size={16} />
        <span>Save Model Now</span>
      </button>
    </div>
  </div>

  {#if toast}
    <div class="toast-banner {toast.type} toast-{toast.type}" role="status">
      {toast.message}
    </div>
  {/if}

  {#if status.error_message}
    <div class="error-banner" role="alert">
      <strong>Training Error:</strong> {status.error_message}
    </div>
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
      title="Live Sample Gallery"
      sortOrder="desc"
      limit={1}
    />
  </section>
</div>

<style>
  .live-dashboard {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1600px;
    width: 100%;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, opacity 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: var(--panel-raised, var(--control, #14191f));
    color: var(--text, #e6ebef);
    border-color: var(--line, #2d3741);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--line, #2d3741);
  }

  .toast-banner {
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .toast-banner.success,
  .toast-success {
    background-color: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .toast-banner.error,
  .toast-error {
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
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
    background-color: var(--panel-raised, rgba(255, 255, 255, 0.05));
    color: var(--muted, #94a3b8);
    border: 1px solid var(--line, #334155);
  }

  .status-starting,
  .status-training {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status-paused {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-stopping,
  .status-failed {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-completed {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .error-banner {
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid var(--danger, #ef4444);
    color: #fca5a5;
    padding: 0.875rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9375rem;
  }

  .dashboard-card {
    background-color: var(--panel, #1e293b);
    border: 1px solid var(--line, #334155);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .card-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-title, var(--accent, #3b82f6));
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
    color: var(--color-primary, var(--accent, #3b82f6));
  }

  .progress-bar-container {
    width: 100%;
  }

  .progress-bar-track {
    height: 12px;
    background-color: var(--control, #0f172a);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--line, #334155);
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #6366f1);
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
    color: var(--muted, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #f8fafc);
    font-variant-numeric: tabular-nums;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
