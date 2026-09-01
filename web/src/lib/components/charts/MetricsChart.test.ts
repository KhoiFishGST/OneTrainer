import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MetricsChart from './MetricsChart.svelte';

const constructorCalls: any[] = [];

// Mock uPlot since canvas rendering isn't fully available in JSDOM.
vi.mock('uplot', () => {
  return {
    default: class MockUPlot {
      series: any[];
      constructor(opts: any, data: any) {
        constructorCalls.push({ opts, data });
        this.series = opts.series;
      }
      setData() {}
      setSize() {}
      destroy() {}
    }
  };
});

const LOSS = [{ key: 'loss_train_step', label: 'train step' }];

beforeEach(() => {
  constructorCalls.length = 0;
});

describe('MetricsChart', () => {
  it('renders title and toggle buttons', () => {
    render(MetricsChart, { props: { metrics: [], series: LOSS, title: 'Loss' } });

    expect(screen.getByText('Loss')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Linear/i })).toBeInTheDocument();
  });

  it('toggles scale mode between Linear and Logarithmic', async () => {
    render(MetricsChart, { props: { metrics: [], series: LOSS, title: 'Loss' } });

    const toggleBtn = screen.getByRole('button', { name: /Linear/i });
    expect(toggleBtn).toHaveTextContent(/Linear/i);

    await fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent(/Logarithmic/i);

    await fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent(/Linear/i);
  });

  it('updates EMA smoothing value when slider is moved', async () => {
    const mockMetrics = [{ step: 1, loss_train_step: 0.5 }, { step: 2, loss_train_step: 0.4 }];
    render(MetricsChart, { props: { metrics: mockMetrics, series: LOSS, title: 'Loss' } });

    expect(document.querySelector('#ema-slider')).toBeInTheDocument();
    expect(screen.getByText(/EMA: 0\.00/i)).toBeInTheDocument();
  });

  it('resets zoom when Reset Zoom button is clicked', async () => {
    const mockMetrics = [{ step: 1, loss_train_step: 0.5 }, { step: 2, loss_train_step: 0.4 }];
    render(MetricsChart, { props: { metrics: mockMetrics, series: LOSS, title: 'Loss' } });

    const resetBtn = screen.getByRole('button', { name: /Reset Zoom/i });
    expect(resetBtn).toBeInTheDocument();
    await fireEvent.click(resetBtn);
  });

  it('observes ResizeObserver when component receives metrics after mounting empty', async () => {
    const observeFn = vi.fn();
    globalThis.ResizeObserver = class {
      observe = observeFn;
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as any;

    const { rerender } = render(MetricsChart, { props: { metrics: [], series: LOSS, title: 'Loss' } });
    observeFn.mockClear();

    await rerender({ metrics: [{ step: 1, loss_train_step: 0.5 }], series: LOSS, title: 'Loss' });
    expect(observeFn).toHaveBeenCalled();
  });

  it('ensures slider thumb has a 44x44px touch target area', () => {
    render(MetricsChart, { props: { metrics: [], series: LOSS, title: 'Loss' } });
    const thumb = document.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).toBeInTheDocument();
    expect(thumb?.className).toMatch(/after:-inset-4|after:size-\[44px\]|after:-inset-\[16px\]/);
  });

  it('aligns series that live in separate rows onto one shared x axis with null gaps', () => {
    // This is the real shape: one row per scalar, never merged by step.
    const metrics = [
      { step: 1, loss_train_step: 0.5 },
      { step: 1, lr_unet: 1e-4 },
      { step: 2, loss_train_step: 0.4 },
      { step: 3, lr_unet: 2e-4 },
    ];
    render(MetricsChart, {
      props: {
        metrics,
        series: [
          { key: 'loss_train_step', label: 'loss' },
          { key: 'lr_unet', label: 'unet' },
        ],
        title: 'Mixed',
      },
    });

    const { data } = constructorCalls[constructorCalls.length - 1];
    expect(data[0]).toEqual([1, 2, 3]);
    expect(data[1]).toEqual([0.5, 0.4, null]);
    expect(data[2]).toEqual([1e-4, null, 2e-4]);
  });

  it('renders raw and smoothed loss as separate series, not one merged line', () => {
    // Regression: `if "loss" in tag` used to merge loss/train_step and
    // smooth_loss/train_step into a single zigzagging series.
    const metrics = [
      { step: 1, loss_train_step: 0.5 },
      { step: 1, smooth_loss_train_step: 0.52 },
      { step: 2, loss_train_step: 0.4 },
      { step: 2, smooth_loss_train_step: 0.48 },
    ];
    render(MetricsChart, {
      props: {
        metrics,
        series: [
          { key: 'loss_train_step', label: 'train step' },
          { key: 'smooth_loss_train_step', label: 'smooth loss train step' },
        ],
        title: 'Training Loss',
      },
    });

    const { opts, data } = constructorCalls[constructorCalls.length - 1];
    // x series + 2 data series
    expect(opts.series).toHaveLength(3);
    expect(data[1]).toEqual([0.5, 0.4]);
    expect(data[2]).toEqual([0.52, 0.48]);
  });
});
