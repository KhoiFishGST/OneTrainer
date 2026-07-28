<script lang="ts">
  import { onDestroy } from 'svelte';
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import type { TrainingMetric } from '../../api/types';
  import { Button } from '$lib/components/ui/button';
  import { Slider } from '../ui/slider/index.js';

  let {
    metrics = [],
    metricKey = 'loss',
    title = 'Metrics',
    height = 300,
  } = $props<{
    metrics?: TrainingMetric[];
    metricKey?: string;
    title?: string;
    height?: number;
  }>();

  let emaFactor = $state(0);
  let isLogScale = $state(false);

  let containerEl: HTMLDivElement | null = $state(null);
  let uplotInstance: uPlot | null = null;
  let lastLogScale: boolean | null = null;

  // Filter metrics containing the requested key
  const validMetrics = $derived(
    metrics.filter((m: TrainingMetric) => m && typeof m[metricKey] === 'number' && !isNaN(m[metricKey]!))
  );

  function computeEMA(data: number[], alpha: number): number[] {
    if (data.length === 0) return [];
    if (alpha <= 0) return [...data];
    const result = new Array(data.length);
    let last = data[0];
    result[0] = last;
    for (let i = 1; i < data.length; i++) {
      last = alpha * last + (1 - alpha) * data[i];
      result[i] = last;
    }
    return result;
  }

  const chartData = $derived.by(() => {
    if (validMetrics.length === 0) return null;
    const xVals = validMetrics.map((m: TrainingMetric, idx: number) => m.step ?? idx);
    const rawY = validMetrics.map((m: TrainingMetric) => Number(m[metricKey]));

    if (emaFactor > 0) {
      const smoothedY = computeEMA(rawY, emaFactor);
      return [xVals, rawY, smoothedY];
    }
    return [xVals, rawY];
  });

  function initOrUpdateChart() {
    if (!containerEl || !chartData) {
      if (uplotInstance) {
        uplotInstance.destroy();
        uplotInstance = null;
      }
      return;
    }

    const width = containerEl.clientWidth || 600;

    const series: uPlot.Series[] = [
      { label: 'Step' },
      {
        label: title,
        stroke: emaFactor > 0 ? 'rgba(59, 130, 246, 0.4)' : '#3b82f6',
        width: emaFactor > 0 ? 1 : 2,
        fill: emaFactor > 0 ? undefined : 'rgba(59, 130, 246, 0.08)',
      },
    ];

    if (emaFactor > 0) {
      series.push({
        label: `${title} (EMA)`,
        stroke: '#f59e0b',
        width: 2.5,
      });
    }

    const opts: uPlot.Options = {
      title: '',
      width,
      height,
      series,
      scales: {
        x: { time: false },
        y: {
          distr: isLogScale ? 3 : 1,
          auto: true,
        },
      },
      axes: [
        {
          stroke: '#94a3b8',
          grid: { stroke: 'rgba(148, 163, 184, 0.15)' },
        },
        {
          stroke: '#94a3b8',
          grid: { stroke: 'rgba(148, 163, 184, 0.15)' },
        },
      ],
    };

    try {
      if (uplotInstance) {
        if (lastLogScale === isLogScale && uplotInstance.series.length === series.length) {
          try {
            uplotInstance.setData(chartData as uPlot.AlignedData);
            return;
          } catch {
            uplotInstance.destroy();
            uplotInstance = null;
          }
        } else {
          uplotInstance.destroy();
          uplotInstance = null;
        }
      }
      uplotInstance = new uPlot(opts, chartData as uPlot.AlignedData, containerEl);
      lastLogScale = isLogScale;
    } catch (e) {
      // Graceful fallback for test/headless environments without full canvas context
    }
  }

  $effect(() => {
    // Re-render when chartData, isLogScale, or containerEl changes
    if (chartData && containerEl) {
      initOrUpdateChart();
    }
  });

  $effect(() => {
    if (!containerEl || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (uplotInstance && containerEl) {
        const w = containerEl.clientWidth;
        if (w > 0) {
          uplotInstance.setSize({ width: w, height });
        }
      }
    });

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  });

  onDestroy(() => {
    if (uplotInstance) {
      uplotInstance.destroy();
      uplotInstance = null;
    }
  });

  function toggleLogScale() {
    isLogScale = !isLogScale;
  }

  function resetZoom() {
    if (uplotInstance && chartData) {
      try {
        uplotInstance.setData(chartData as uPlot.AlignedData, true);
      } catch {
        initOrUpdateChart();
      }
    }
  }
</script>

<div class="metrics-chart-card">
  <div class="chart-header">
    <h3 class="chart-title">{title}</h3>
    <div class="chart-controls">
      <label class="control-label" for="ema-slider">
        <span>EMA: {emaFactor.toFixed(2)}</span>
        <Slider
          type="single"
          id="ema-slider"
          min={0}
          max={0.99}
          step={0.01}
          aria-label="EMA Smoothing"
          value={[emaFactor]}
          onValueChange={(val: number | number[]) => (emaFactor = Array.isArray(val) ? val[0] : val)}
          class="ema-slider"
        />
      </label>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        class="btn-control"
        onclick={toggleLogScale}
      >
        {isLogScale ? 'Logarithmic' : 'Linear'}
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        class="btn-control"
        onclick={resetZoom}
      >
        Reset Zoom
      </Button>
    </div>
  </div>

  <div class="chart-body">
    {#if validMetrics.length === 0}
      <div class="empty-state">No metric data available</div>
    {:else}
      <div
        class="canvas-container"
        data-testid="metrics-chart-canvas-container"
        bind:this={containerEl}
      ></div>
    {/if}
  </div>
</div>

<style>
  .metrics-chart-card {
    background-color: var(--card, #1e293b);
    border: 1px solid var(--border, #334155);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--foreground, #f8fafc);
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .chart-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary, #3b82f6);
  }

  .chart-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .control-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: var(--muted-foreground, #94a3b8);
  }

  /* Bits UI boundary: style Slider child component */
  .chart-controls :global(.ema-slider) {
    width: 90px;
    accent-color: var(--primary, #3b82f6);
    cursor: pointer;
  }

  /* Bits UI boundary: style Button child component */
  .chart-controls :global(.btn-control) {
    min-height: 0;
    background-color: var(--muted, #0f172a);
    color: var(--foreground, #f8fafc);
    border: 1px solid var(--border, #334155);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  /* Bits UI boundary: style Button child component hover state */
  .chart-controls :global(.btn-control:hover) {
    background-color: var(--card, #1e293b);
    border-color: var(--primary, #3b82f6);
  }

  /* Responsive 44px touch targets on mobile viewports */
  @media (max-width: 768px) {
    /* Bits UI boundary: style Button child component mobile touch target */
    .chart-controls :global(.btn-control) {
      min-height: 44px;
      padding: 8px 14px;
    }
  }

  .chart-body {
    position: relative;
    width: 100%;
    min-height: 200px;
  }

  .canvas-container {
    width: 100%;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--muted-foreground, #94a3b8);
    font-size: 0.875rem;
    border: 1px dashed var(--border, #334155);
    border-radius: 6px;
  }
</style>
