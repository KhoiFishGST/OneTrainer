<script lang="ts">
  import { onDestroy } from 'svelte';
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import type { TrainingMetric } from '../../api/types';
  import { Button } from '$lib/components/ui/button';
  import { Slider } from '../ui/slider/index.js';
  import { formatMetricValue } from './format';

  export interface ChartSeries {
    key: string;
    label: string;
  }

  let {
    metrics = [],
    series = [],
    title = 'Metrics',
    height = 300,
  } = $props<{
    metrics?: TrainingMetric[];
    series?: ChartSeries[];
    title?: string;
    height?: number;
  }>();

  let emaFactor = $state(0);
  let isLogScale = $state(false);

  let containerEl: HTMLDivElement | null = $state(null);
  let uplotInstance: uPlot | null = null;
  let lastLogScale: boolean | null = null;

  const SERIES_COLORS = [
    'rgb(59, 130, 246)',
    'rgb(245, 158, 11)',
    'rgb(16, 185, 129)',
    'rgb(239, 68, 68)',
    'rgb(168, 85, 247)',
    'rgb(14, 165, 233)',
  ];

  // EMA over a null-gapped column: gaps stay gaps, and the average carries
  // across them rather than restarting.
  function computeEMA(data: (number | null)[], alpha: number): (number | null)[] {
    const result: (number | null)[] = new Array(data.length).fill(null);
    let last: number | null = null;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (v === null) continue;
      last = last === null || alpha <= 0 ? v : alpha * last + (1 - alpha) * v;
      result[i] = last;
    }
    return result;
  }

  // Each scalar is recorded as its own row, so two series are never in the same
  // row. uPlot needs one shared x array, so build the sorted union of steps and
  // null-fill each column; uPlot renders nulls as gaps.
  const chartData = $derived.by(() => {
    if (series.length === 0) return null;

    const perKey = new Map<string, Map<number, number>>();
    for (const s of series) perKey.set(s.key, new Map());
    const stepSet = new Set<number>();

    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      if (!m) continue;
      const step = typeof m.step === 'number' ? m.step : i;
      let touched = false;
      for (const s of series) {
        const v = m[s.key];
        if (typeof v !== 'number' || Number.isNaN(v)) continue;
        perKey.get(s.key)!.set(step, v);
        touched = true;
      }
      if (touched) stepSet.add(step);
    }

    if (stepSet.size === 0) return null;

    const xVals = [...stepSet].sort((a, b) => a - b);
    const columns: (number | null)[][] = [];
    for (const s of series) {
      const map = perKey.get(s.key)!;
      const column = xVals.map((x) => (map.has(x) ? map.get(x)! : null));
      columns.push(column);
      if (emaFactor > 0) columns.push(computeEMA(column, emaFactor));
    }

    return [xVals, ...columns];
  });

  function buildSeries(): uPlot.Series[] {
    const built: uPlot.Series[] = [{ label: 'Step' }];
    const single = series.length === 1 && emaFactor === 0;

    series.forEach((s: ChartSeries, i: number) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length];
      built.push({
        label: s.label,
        stroke: color,
        width: emaFactor > 0 ? 1 : 2,
        alpha: emaFactor > 0 ? 0.4 : 1,
        fill: single ? 'rgba(59, 130, 246, 0.08)' : undefined,
        value: (_u: uPlot, v: number | null) => formatMetricValue(v),
      });
      if (emaFactor > 0) {
        built.push({
          label: `${s.label} (EMA)`,
          stroke: color,
          width: 2.5,
          value: (_u: uPlot, v: number | null) => formatMetricValue(v),
        });
      }
    });

    return built;
  }

  function initOrUpdateChart() {
    if (!containerEl || !chartData) {
      if (uplotInstance) {
        uplotInstance.destroy();
        uplotInstance = null;
      }
      return;
    }

    const width = containerEl.clientWidth || 600;
    const builtSeries = buildSeries();

    const opts: uPlot.Options = {
      title: '',
      width,
      height,
      series: builtSeries,
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
          // Without this uPlot uses Intl.NumberFormat's 3-fraction-digit
          // default and every learning rate tick renders as "0".
          values: (_u: uPlot, splits: (number | null)[]) => splits.map(formatMetricValue),
        },
      ],
    };

    try {
      if (uplotInstance) {
        if (lastLogScale === isLogScale && uplotInstance.series.length === builtSeries.length) {
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
    {#if chartData === null}
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
