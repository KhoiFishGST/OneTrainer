import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import MetricsChart from './MetricsChart.svelte';

describe('MetricsChart', () => {
  it('renders chart container and controls', () => {
    render(MetricsChart, { props: { metrics: [], metricKey: 'loss', title: 'Loss' } });
    expect(screen.getByText('Loss')).toBeInTheDocument();
    expect(screen.getByLabelText(/EMA/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Linear|Logarithmic|Log/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Zoom/i })).toBeInTheDocument();
  });

  it('renders empty state when no metrics provided', () => {
    render(MetricsChart, { props: { metrics: [], metricKey: 'loss', title: 'Loss Chart' } });
    expect(screen.getByText(/No metric data available/i)).toBeInTheDocument();
  });

  it('renders data canvas container when metrics are provided', () => {
    const mockMetrics = [
      { step: 1, loss: 0.5, lr: 0.001 },
      { step: 2, loss: 0.4, lr: 0.0009 },
      { step: 3, loss: 0.3, lr: 0.0008 },
    ];
    render(MetricsChart, { props: { metrics: mockMetrics, metricKey: 'loss', title: 'Loss' } });
    expect(screen.getByTestId('metrics-chart-canvas-container')).toBeInTheDocument();
  });

  it('toggles logarithmic and linear Y-axis scaling when log scale button clicked', async () => {
    const mockMetrics = [{ step: 1, loss: 0.5 }, { step: 2, loss: 0.4 }];
    render(MetricsChart, { props: { metrics: mockMetrics, metricKey: 'loss', title: 'Loss' } });

    const toggleBtn = screen.getByRole('button', { name: /Linear|Logarithmic|Log/i });
    expect(toggleBtn).toHaveTextContent(/Linear/i);

    await fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent(/Log/i);

    await fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent(/Linear/i);
  });

  it('updates EMA smoothing value when slider is moved', async () => {
    const mockMetrics = [{ step: 1, loss: 0.5 }, { step: 2, loss: 0.4 }];
    render(MetricsChart, { props: { metrics: mockMetrics, metricKey: 'loss', title: 'Loss' } });

    const slider = screen.getByLabelText(/EMA/i) as HTMLInputElement;
    expect(slider.value).toBe('0');

    await fireEvent.input(slider, { target: { value: '0.6' } });
    expect(slider.value).toBe('0.6');
    expect(screen.getByText(/EMA: 0\.60/i)).toBeInTheDocument();
  });

  it('resets zoom when Reset Zoom button is clicked', async () => {
    const mockMetrics = [{ step: 1, loss: 0.5 }, { step: 2, loss: 0.4 }];
    render(MetricsChart, { props: { metrics: mockMetrics, metricKey: 'loss', title: 'Loss' } });

    const resetBtn = screen.getByRole('button', { name: /Reset Zoom/i });
    await fireEvent.click(resetBtn);
    // Should not throw error on reset zoom click
    expect(resetBtn).toBeInTheDocument();
  });
});
