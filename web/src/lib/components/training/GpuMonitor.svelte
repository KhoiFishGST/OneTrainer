<script lang="ts">
  import type { GpuStat } from '../../api/types';

  let {
    gpuStats = null,
  } = $props<{
    gpuStats?: GpuStat | null;
  }>();

  const vramUsedMB = $derived(
    gpuStats?.vram_used_mb ??
      (gpuStats?.vram_used
        ? gpuStats.vram_used > 1000000
          ? gpuStats.vram_used / (1024 * 1024)
          : gpuStats.vram_used
        : 0)
  );

  const vramTotalMB = $derived(
    gpuStats?.vram_total_mb ??
      (gpuStats?.vram_total
        ? gpuStats.vram_total > 1000000
          ? gpuStats.vram_total / (1024 * 1024)
          : gpuStats.vram_total
        : 0)
  );

  const vramUsedGB = $derived(vramUsedMB / 1024);
  const vramTotalGB = $derived(vramTotalMB / 1024);
  const vramPct = $derived(
    vramTotalMB > 0 ? Math.min(100, Math.max(0, (vramUsedMB / vramTotalMB) * 100)) : 0
  );

  const rawUtil = $derived(gpuStats?.gpu_util_pct ?? gpuStats?.utilization ?? 0);
  const utilPct = $derived(
    rawUtil <= 1 && rawUtil > 0 ? rawUtil * 100 : Math.min(100, Math.max(0, rawUtil))
  );

  const tempC = $derived(gpuStats?.temp_c ?? gpuStats?.temperature ?? 0);
  const tempPct = $derived(Math.min(100, Math.max(0, (tempC / 100) * 100)));
</script>

<div class="gpu-monitor-panel" data-testid="gpu-monitor">
  <div class="panel-header">
    <h3 class="panel-title">GPU Resource Monitor</h3>
    {#if gpuStats}
      <span class="status-indicator live">LIVE</span>
    {:else}
      <span class="status-indicator offline">OFFLINE</span>
    {/if}
  </div>

  {#if !gpuStats}
    <div class="empty-state">
      <span>No GPU telemetry available</span>
    </div>
  {:else}
    <div class="meters-grid">
      <!-- VRAM Gauge -->
      <div class="meter-card">
        <div class="meter-header">
          <span class="meter-label">VRAM Usage</span>
          <span class="meter-value">{vramUsedGB.toFixed(1)} GB / {vramTotalGB > 0 ? vramTotalGB.toFixed(1) + ' GB' : 'N/A'}</span>
        </div>
        <div class="progress-bar-bg" title={`${vramPct.toFixed(1)}% VRAM used`}>
          <div
            class="progress-bar-fill vram"
            style="width: {vramPct}%;"
          ></div>
        </div>
        <div class="meter-footer">
          <span>{vramPct.toFixed(0)}% Allocated</span>
        </div>
      </div>

      <!-- Utilization Gauge -->
      <div class="meter-card">
        <div class="meter-header">
          <span class="meter-label">GPU Utilization</span>
          <span class="meter-value">{utilPct.toFixed(0)}%</span>
        </div>
        <div class="progress-bar-bg" title={`${utilPct.toFixed(0)}% GPU core utilization`}>
          <div
            class="progress-bar-fill util"
            style="width: {utilPct}%;"
          ></div>
        </div>
        <div class="meter-footer">
          <span>Core Compute Load</span>
        </div>
      </div>

      <!-- Temperature Gauge -->
      <div class="meter-card">
        <div class="meter-header">
          <span class="meter-label">Temperature</span>
          <span class="meter-value">{tempC ? `${tempC.toFixed(0)} °C` : 'N/A'}</span>
        </div>
        <div class="progress-bar-bg" title={tempC ? `${tempC.toFixed(0)} °C` : 'Temperature'}>
          <div
            class="progress-bar-fill temp"
            class:hot={tempC >= 80}
            class:warm={tempC >= 65 && tempC < 80}
            style="width: {tempPct}%;"
          ></div>
        </div>
        <div class="meter-footer">
          <span>Target &lt; 80 °C</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .gpu-monitor-panel {
    background: var(--card, #1e1e24);
    border: 1px solid var(--border, #2e2e38);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary, #3b82f6);
  }

  .status-indicator {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .status-indicator.live {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .status-indicator.offline {
    background: rgba(148, 163, 184, 0.1);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .empty-state {
    padding: 1.5rem;
    text-align: center;
    color: var(--muted-foreground, #8a8a9a);
    font-size: 0.875rem;
  }

  .meters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .meter-card {
    background: var(--muted, #262630);
    border: 1px solid var(--border, #2e2e38);
    border-radius: 6px;
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .meter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .meter-label {
    color: var(--muted-foreground, #8a8a9a);
    font-weight: 500;
  }

  .meter-value {
    color: var(--foreground, #f0f0f5);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .progress-bar-bg {
    height: 8px;
    background: var(--muted, #15151a);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-bar-fill.vram {
    background: linear-gradient(90deg, #3b82f6, #6366f1);
  }

  .progress-bar-fill.util {
    background: linear-gradient(90deg, #10b981, #06b6d4);
  }

  .progress-bar-fill.temp {
    background: linear-gradient(90deg, #3b82f6, #f59e0b);
  }

  .progress-bar-fill.temp.warm {
    background: linear-gradient(90deg, #f59e0b, #f97316);
  }

  .progress-bar-fill.temp.hot {
    background: linear-gradient(90deg, #f97316, #ef4444);
  }

  .meter-footer {
    display: flex;
    justify-content: flex-end;
    font-size: 0.75rem;
    color: var(--muted-foreground, #8a8a9a);
  }
</style>
