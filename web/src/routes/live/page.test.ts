import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import LivePage from './+page.svelte';
import { trainingStore } from '$lib/events/training-store';

describe('Live Dashboard Page', () => {
  beforeEach(() => {
    trainingStore.reset();
  });

  it('renders title, status badge, progress card, GPU monitor and sample gallery', () => {
    render(LivePage);

    expect(screen.getByRole('heading', { level: 1, name: /live training dashboard/i })).toBeInTheDocument();
    expect(screen.getByTestId('live-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('progress-card')).toBeInTheDocument();
    expect(screen.getByTestId('gpu-monitor')).toBeInTheDocument();
    expect(screen.getByTestId('sample-gallery')).toBeInTheDocument();
  });

  it('displays training telemetry from trainingStore', () => {
    trainingStore.setStatus({
      state: 'TRAINING',
      step: 150,
      max_steps: 1000,
      epoch: 2,
      max_epochs: 10,
      speed_its: 3.5,
      elapsed_seconds: 120,
      eta_seconds: 680,
    });

    render(LivePage);

    expect(screen.getByText('TRAINING')).toBeInTheDocument();
    expect(screen.getByText(/150 \/ 1000/i)).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 10/i)).toBeInTheDocument();
    expect(screen.getByText(/3\.50 it\/s/i)).toBeInTheDocument();
    expect(screen.getByText(/15\.0%/i)).toBeInTheDocument();
  });
});
