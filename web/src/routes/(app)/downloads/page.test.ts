import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DownloadsPage from './+page.svelte';
import { api } from '$lib/api/client';

const RUN = { key: 'run-a', config_filename: 'run-a.json', started_at: '2026-08-02T09:00:00Z',
              checkpoint_count: 2, total_size_bytes: 300 };

const FILE_CHECKPOINT = {
  id: 1, kind: 'save', filename: 'step-1000.safetensors', format: 'KOHYA_LORA',
  is_directory: false, size_bytes: 200, created_at: '2026-08-02T09:10:00Z',
  source_path: '/ws/save/step-1000.safetensors', linked: true, available: true,
};

const DIR_CHECKPOINT = {
  id: 2, kind: 'final', filename: 'my-model', format: 'DIFFUSERS',
  is_directory: true, size_bytes: 100, created_at: '2026-08-02T10:00:00Z',
  source_path: '/out/my-model', linked: false, available: true,
};

describe('Downloads Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getDownloadRuns').mockResolvedValue({ runs: [RUN] } as any);
    vi.spyOn(api, 'getDownloadRun').mockResolvedValue({
      run: { key: 'run-a' },
      checkpoints: [FILE_CHECKPOINT, DIR_CHECKPOINT],
    } as any);
  });

  it('lists the run and its checkpoints', async () => {
    render(DownloadsPage);

    expect(await screen.findByText('step-1000.safetensors')).toBeInTheDocument();
    expect(screen.getByText('my-model')).toBeInTheDocument();
  });

  it('links a single-file checkpoint to the resumable file route', async () => {
    render(DownloadsPage);

    const link = await screen.findByRole('link', { name: /download step-1000\.safetensors/i });
    expect(link).toHaveAttribute(
      'href',
      '/api/downloads/runs/run-a/files/step-1000.safetensors'
    );
  });

  it('links a directory checkpoint to the archive route and says it is not resumable', async () => {
    render(DownloadsPage);

    const link = await screen.findByRole('link', { name: /download my-model/i });
    expect(link).toHaveAttribute('href', '/api/downloads/runs/run-a/archives/my-model.zip');
    expect(screen.getByText(/not resumable/i)).toBeInTheDocument();
  });

  it('distinguishes a linked entry from a copied one', async () => {
    // Deleting a link reclaims nothing until the original is gone; deleting a
    // copy frees the bytes immediately. These must not read identically.
    render(DownloadsPage);

    await screen.findByText('step-1000.safetensors');
    expect(screen.getByTestId('mode-step-1000.safetensors')).toHaveTextContent(/linked/i);
    expect(screen.getByTestId('mode-my-model')).toHaveTextContent(/copy/i);
  });

  it('shows an unavailable checkpoint as on-disk rather than downloadable', async () => {
    // The save succeeded; only the web UI's own copy failed.
    vi.spyOn(api, 'getDownloadRun').mockResolvedValue({
      run: { key: 'run-a' },
      checkpoints: [{ ...FILE_CHECKPOINT, available: false }],
    } as any);

    render(DownloadsPage);

    expect(await screen.findByText(/on disk at/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /download step-1000\.safetensors/i })
    ).not.toBeInTheDocument();
  });

  it('shows an empty state when no run has produced a checkpoint', async () => {
    vi.spyOn(api, 'getDownloadRuns').mockResolvedValue({ runs: [] } as any);

    render(DownloadsPage);

    await waitFor(() => {
      expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();
    });
  });
});
