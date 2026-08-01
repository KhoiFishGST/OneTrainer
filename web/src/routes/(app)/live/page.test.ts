import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writable } from 'svelte/store';
import LivePage from './+page.svelte';
import { trainingStore } from '$lib/events/training-store';
import { viewingRunStore } from '$lib/events/viewing-run-store';
import { api } from '$lib/api/client';

const mockPage = writable({ url: new URL('http://localhost/live') });
vi.mock('$app/stores', () => ({
  page: { subscribe: (fn: any) => mockPage.subscribe(fn) },
}));

describe('Live Dashboard Page', () => {
  beforeEach(() => {
    trainingStore.reset();
    viewingRunStore.showLive();
    mockPage.set({ url: new URL('http://localhost/live') });
    vi.restoreAllMocks();
    vi.spyOn(api, 'getGalleryRuns').mockResolvedValue({ runs: [] } as any);
    vi.spyOn(api, 'getCurrentGallery').mockResolvedValue({} as any);
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

  it('renders current gallery on Live without a run selector', async () => {
    render(LivePage);
    expect(await screen.findByText('Latest Sample Set', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Run' })).not.toBeInTheDocument();
  });

  it('discovers namespaced metric series from metrics in store', () => {
    trainingStore.setMetrics([
      { step: 10, epoch: 1, loss_train_step: 0.5, lr_unet: 0.0001 },
      { step: 10, epoch: 1, smooth_loss_train_step: 0.52, lr_text_encoder: 0.000003 }
    ]);

    render(LivePage);

    expect(screen.getByText('Training Loss')).toBeInTheDocument();
    expect(screen.getByText('Learning Rate')).toBeInTheDocument();
  });

  it('shows a banner naming the run when viewing history', async () => {
    mockPage.set({ url: new URL('http://localhost/live?run=run-a') });
    vi.spyOn(api, 'getGalleryRuns').mockResolvedValue({
      runs: [{ key: 'run-a', config_filename: '', started_at: '' }],
    } as any);
    vi.spyOn(api, 'getGalleryRunMetrics').mockResolvedValue({
      metrics: [
        { step: 1, epoch: 1, loss_train_step: 0.5 },
        { step: 2, epoch: 1, loss_train_step: 0.4 },
      ],
    } as any);

    render(LivePage);

    expect(await screen.findByTestId('historical-run-banner')).toBeInTheDocument();
    expect(screen.getByTestId('historical-run-banner')).toHaveTextContent('run-a');
    expect(screen.getByText('Training Loss')).toBeInTheDocument();
  });

  it('returns to live when the selector is set back to Live', async () => {
    vi.spyOn(api, 'getGalleryRuns').mockResolvedValue({ runs: [{ key: 'run-a' }] } as any);
    vi.spyOn(api, 'getGalleryRunMetrics').mockResolvedValue({
      metrics: [{ step: 10, loss_train_step: 0.5 }],
    } as any);

    mockPage.set({ url: new URL('http://localhost/live?run=run-a') });
    render(LivePage);

    const banner = await screen.findByTestId('historical-run-banner');
    expect(banner).toBeInTheDocument();

    const select = screen.getByRole('combobox', { name: 'Viewing run' });
    await fireEvent.change(select, { target: { value: '' } });

    expect(screen.queryByTestId('historical-run-banner')).not.toBeInTheDocument();
  });
});

