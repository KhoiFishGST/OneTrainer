<script lang="ts">
  import type { GpuStat } from '../../api/types';

  let {
    gpuStats = null,
  } = $props<{
    gpuStats?: GpuStat | null;
  }>();

  /**
   * A reading for one device. `devices` is the current shape; a bare stat
   * object without it is the older single-GPU payload, which is normalized
   * into a one-device list so the markup below has only one case to render.
   */
  function toMB(mbValue: number | undefined, rawValue: number | undefined): number {
    if (mbValue !== undefined) return mbValue;
    if (!rawValue) return 0;
    // The raw field has been bytes in some payloads and MB in others.
    return rawValue > 1000000 ? rawValue / (1024 * 1024) : rawValue;
  }

  function normalize(source: Record<string, any>, fallbackIndex: number) {
    const vramUsedMB = toMB(source.vram_used_mb, source.vram_used);
    const vramTotalMB = toMB(source.vram_total_mb, source.vram_total);

    const rawUtil = source.gpu_util_pct ?? source.utilization ?? 0;
    // Utilization arrives as a 0-1 fraction from some sources, 0-100 from others.
    const utilPct =
      rawUtil <= 1 && rawUtil > 0
        ? rawUtil * 100
        : Math.min(100, Math.max(0, rawUtil));

    const tempC = source.temp_c ?? source.temperature ?? 0;

    return {
      index: source.index ?? fallbackIndex,
      name: source.name as string | undefined,
      vramUsedGB: vramUsedMB / 1024,
      vramTotalGB: vramTotalMB / 1024,
      vramPct:
        vramTotalMB > 0
          ? Math.min(100, Math.max(0, (vramUsedMB / vramTotalMB) * 100))
          : 0,
      utilPct,
      tempC,
      tempPct: Math.min(100, Math.max(0, tempC)),
    };
  }

  const devices = $derived.by(() => {
    if (!gpuStats) return [];
    const list = gpuStats.devices;
    if (Array.isArray(list) && list.length > 0) {
      return list.map((d: Record<string, any>, i: number) => normalize(d, i));
    }
    return [normalize(gpuStats, 0)];
  });

  // A single card needs no ordinal; several do, since two of the same model
  // are otherwise indistinguishable.
  const showIndex = $derived(devices.length > 1);
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
    {#each devices as device (device.index)}
      <section class="device">
        {#if device.name}
          <h4 class="device-name">
            {showIndex ? `GPU ${device.index} · ${device.name}` : device.name}
          </h4>
        {/if}

        <div class="meters-grid">
          <!-- VRAM Gauge -->
          <div class="meter-card">
            <div class="meter-header">
              <span class="meter-label">VRAM Usage</span>
              <span class="meter-value">{device.vramUsedGB.toFixed(1)} GB / {device.vramTotalGB > 0 ? device.vramTotalGB.toFixed(1) + ' GB' : 'N/A'}</span>
            </div>
            <div class="progress-bar-bg" title={`${device.vramPct.toFixed(1)}% VRAM used`}>
              <div
                class="progress-bar-fill vram"
                style="width: {device.vramPct}%;"
              ></div>
            </div>
            <div class="meter-footer">
              <span>{device.vramPct.toFixed(0)}% Allocated</span>
            </div>
          </div>

          <!-- Utilization Gauge -->
          <div class="meter-card">
            <div class="meter-header">
              <span class="meter-label">GPU Utilization</span>
              <span class="meter-value">{device.utilPct.toFixed(0)}%</span>
            </div>
            <div class="progress-bar-bg" title={`${device.utilPct.toFixed(0)}% GPU core utilization`}>
              <div
                class="progress-bar-fill util"
                style="width: {device.utilPct}%;"
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
              <span class="meter-value">{device.tempC ? `${device.tempC.toFixed(0)} °C` : 'N/A'}</span>
            </div>
            <div class="progress-bar-bg" title={device.tempC ? `${device.tempC.toFixed(0)} °C` : 'Temperature'}>
              <div
                class="progress-bar-fill temp"
                class:hot={device.tempC >= 80}
                class:warm={device.tempC >= 65 && device.tempC < 80}
                style="width: {device.tempPct}%;"
              ></div>
            </div>
            <div class="meter-footer">
              <span>Target &lt; 80 °C</span>
            </div>
          </div>
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .gpu-monitor-panel {
    background: var(--card);
    border: 1px solid var(--border);
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
    color: var(--ring);
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
    color: rgb(22, 101, 52);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .status-indicator.offline {
    background: rgba(148, 163, 184, 0.1);
    color: rgb(148, 163, 184);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .empty-state {
    padding: 1.5rem;
    text-align: center;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }

  .device {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .device-name {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
  }

  .meters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .meter-card {
    background: var(--muted);
    border: 1px solid var(--border);
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
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .meter-value {
    color: var(--foreground);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .progress-bar-bg {
    height: 8px;
    background: var(--muted);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width var(--motion-duration-layout) var(--motion-ease-enter);
  }

  .progress-bar-fill.vram {
    background: linear-gradient(90deg, rgb(59, 130, 246), rgb(99, 102, 241));
  }

  .progress-bar-fill.util {
    background: linear-gradient(90deg, rgb(16, 185, 129), rgb(6, 182, 212));
  }

  .progress-bar-fill.temp {
    background: linear-gradient(90deg, rgb(59, 130, 246), rgb(245, 158, 11));
  }

  .progress-bar-fill.temp.warm {
    background: linear-gradient(90deg, rgb(245, 158, 11), rgb(249, 115, 22));
  }

  .progress-bar-fill.temp.hot {
    background: linear-gradient(90deg, rgb(249, 115, 22), rgb(239, 68, 68));
  }

  .meter-footer {
    display: flex;
    justify-content: flex-end;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
</style>
