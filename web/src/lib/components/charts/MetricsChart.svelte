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
        stroke: emaFactor > 0 ? 'rgba(59, 130, 246, 0.4)' : 'rgb(59, 130, 246)',
        width: emaFactor > 0 ? 1 : 2,
        fill: emaFactor > 0 ? undefined : 'rgba(59, 130, 246, 0.08)',
      },
    ];

    if (emaFactor > 0) {
      series.push({
        label: `${title} (EMA)`,
        stroke: 'rgb(245, 158, 11)',
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
          stroke: 'rgb(148, 163, 184)',
          grid: { stroke: 'rgba(148, 163, 184, 0.15)' },
        },
        {
          stroke: 'rgb(148, 163, 184)',
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

<div class="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 text-foreground">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <h3 class="m-0 text-base font-semibold text-ring">{title}</h3>
    <div class="flex items-center gap-3 flex-wrap">
      <label class="flex items-center gap-2 text-xs text-muted-foreground" for="ema-slider">
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
          class="w-[90px] cursor-pointer"
        />
      </label>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        class="bg-muted text-foreground border border-border rounded px-2.5 py-1 text-xs hover:bg-card hover:border-primary max-md:min-h-11 max-md:px-3.5 max-md:py-2"
        onclick={toggleLogScale}
      >
        {isLogScale ? 'Logarithmic' : 'Linear'}
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        class="bg-muted text-foreground border border-border rounded px-2.5 py-1 text-xs hover:bg-card hover:border-primary max-md:min-h-11 max-md:px-3.5 max-md:py-2"
        onclick={resetZoom}
      >
        Reset Zoom
      </Button>
    </div>
  </div>

  <div class="relative w-full min-h-[200px]">
    {#if validMetrics.length === 0}
      <div class="flex items-center justify-center h-[200px] text-muted-foreground text-sm border border-dashed border-border rounded-md">No metric data available</div>
    {:else}
      <div
        class="w-full"
        data-testid="metrics-chart-canvas-container"
        bind:this={containerEl}
      ></div>
    {/if}
  </div>
</div>
