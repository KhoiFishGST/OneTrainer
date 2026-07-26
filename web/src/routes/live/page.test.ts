import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import LivePage from './+page.svelte';
import { trainingStore } from '$lib/events/training-store';
import { api } from '$lib/api/client';

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

  it('renders action buttons and disables them when not training', () => {
    render(LivePage);

    const sampleBtn = screen.getByRole('button', { name: /sample now/i });
    const backupBtn = screen.getByRole('button', { name: /backup now/i });
    const saveBtn = screen.getByRole('button', { name: /save model now/i });

    expect(sampleBtn).toBeInTheDocument();
    expect(backupBtn).toBeInTheDocument();
    expect(saveBtn).toBeInTheDocument();

    expect(sampleBtn).toBeDisabled();
    expect(backupBtn).toBeDisabled();
    expect(saveBtn).toBeDisabled();
  });

  it('enables action buttons when training status is active', () => {
    trainingStore.setStatus({
      state: 'TRAINING',
      step: 10,
      max_steps: 100,
    });

    render(LivePage);

    const sampleBtn = screen.getByRole('button', { name: /sample now/i });
    const backupBtn = screen.getByRole('button', { name: /backup now/i });
    const saveBtn = screen.getByRole('button', { name: /save model now/i });

    expect(sampleBtn).not.toBeDisabled();
    expect(backupBtn).not.toBeDisabled();
    expect(saveBtn).not.toBeDisabled();
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

  it('displays error toast when sample generation fails', async () => {
    trainingStore.setStatus({
      state: 'TRAINING',
      step: 10,
      max_steps: 100,
    });

    const errorMessage = 'Cannot request sample: No sample prompts configured in sample definitions file';
    vi.spyOn(api, 'requestSample').mockRejectedValueOnce(new Error(errorMessage));

    render(LivePage);

    const sampleBtn = screen.getByRole('button', { name: /sample now/i });
    await fireEvent.click(sampleBtn);

    const toast = await screen.findByText(errorMessage);
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass('toast-error');
  });

  it('renders current gallery on Live without a run selector', async () => {
    render(LivePage);
    expect(await screen.findByText('Live Sample Gallery')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Gallery run' })).not.toBeInTheDocument();
  });
});

