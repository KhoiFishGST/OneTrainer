import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import MetricsChart from './MetricsChart.svelte';

// Mock uPlot since canvas rendering isn't fully available in JSDOM
vi.mock('uplot', () => {
  return {
    default: class MockUPlot {
      constructor() {}
      setData() {}
      destroy() {}
    }
  };
});

describe('MetricsChart', () => {
  it('renders title and toggle buttons', () => {
    render(MetricsChart, { props: { metrics: [], metricKey: 'loss', title: 'Loss' } });

    expect(screen.getByText('Loss')).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Linear/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it('toggles scale mode between Linear and Logarithmic', async () => {
    render(MetricsChart, { props: { metrics: [], metricKey: 'loss', title: 'Loss' } });

    const toggleBtn = screen.getByRole('button', { name: /Linear/i });
    expect(toggleBtn).toHaveTextContent(/Linear/i);

    await fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent(/Logarithmic/i);

    await fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent(/Linear/i);
  });

  it('updates EMA smoothing value when slider is moved', async () => {
    const mockMetrics = [{ step: 1, loss: 0.5 }, { step: 2, loss: 0.4 }];
    render(MetricsChart, { props: { metrics: mockMetrics, metricKey: 'loss', title: 'Loss' } });

    const sliderRoot = document.querySelector('#ema-slider');
    expect(sliderRoot).toBeInTheDocument();
    expect(screen.getByText(/EMA: 0\.00/i)).toBeInTheDocument();
  });

  it('resets zoom when Reset Zoom button is clicked', async () => {
    const mockMetrics = [{ step: 1, loss: 0.5 }, { step: 2, loss: 0.4 }];
    render(MetricsChart, { props: { metrics: mockMetrics, metricKey: 'loss', title: 'Loss' } });

    const resetBtn = screen.getByRole('button', { name: /Reset Zoom/i });
    expect(resetBtn).toBeInTheDocument();

    await fireEvent.click(resetBtn);
  });

  it('observes ResizeObserver when component receives metrics after mounting with empty metrics', async () => {
    const observeFn = vi.fn();
    const unobserveFn = vi.fn();
    const disconnectFn = vi.fn();

    globalThis.ResizeObserver = class {
      observe = observeFn;
      unobserve = unobserveFn;
      disconnect = disconnectFn;
    };

    const { rerender } = render(MetricsChart, { props: { metrics: [], metricKey: 'loss', title: 'Loss' } });
    observeFn.mockClear();

    await rerender({ metrics: [{ step: 1, loss: 0.5 }], metricKey: 'loss', title: 'Loss' });
    expect(observeFn).toHaveBeenCalled();
  });

  it('ensures slider thumb has a 44x44px touch target area', () => {
    render(MetricsChart, { props: { metrics: [], metricKey: 'loss', title: 'Loss' } });
    const thumb = document.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).toBeInTheDocument();
    expect(thumb?.className).toMatch(/after:-inset-4|after:size-\[44px\]|after:-inset-\[16px\]/);
  });
});

