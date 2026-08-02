import { render, screen, waitFor, within, fireEvent } from '@testing-library/svelte';
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

// The dialog module is dynamically imported on first use, so the very first
// open in a file pays the module-load cost -- more than findBy's default 1s.
async function openRemovalDialog(index = 0) {
  await fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[index]);
  return screen.findByRole('alertdialog', {}, { timeout: 5000 });
}

async function confirmDialog(dialog: HTMLElement) {
  await fireEvent.click(await within(dialog).findByRole('button', { name: 'Remove', hidden: true }));
}

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

  it('renders every row when a manifest carries duplicate ids', async () => {
    // Older manifests can hold reissued ids. Keying the table on them aborted
    // the whole render with each_key_duplicate; rows key on filename, which
    // _unique_name guarantees is unique within a run.
    vi.spyOn(api, 'getDownloadRun').mockResolvedValue({
      run: { key: 'run-a' },
      checkpoints: [
        { ...FILE_CHECKPOINT, id: 2, filename: 'b.safetensors' },
        { ...FILE_CHECKPOINT, id: 2, filename: 'c.safetensors' },
      ],
    } as any);

    render(DownloadsPage);

    expect(await screen.findByText('b.safetensors')).toBeInTheDocument();
    expect(screen.getByText('c.safetensors')).toBeInTheDocument();
  });

  it('confirms before removing, deletes, and refreshes the list', async () => {
    const deleteSpy = vi.spyOn(api, 'deleteCheckpoint').mockResolvedValue({ status: 'ok' } as any);
    const runFetch = vi.mocked(api.getDownloadRun);

    render(DownloadsPage);
    await screen.findByText('step-1000.safetensors');

    const dialog = await openRemovalDialog(0);
    // A linked entry frees no disk until the OneTrainer original is gone too.
    expect(dialog).toHaveTextContent(/no disk space is freed/i);

    const before = runFetch.mock.calls.length;
    await confirmDialog(dialog);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('run-a', 'step-1000.safetensors');
    });
    // Without the refetch the removed row lingers until a manual reload.
    await waitFor(() => {
      expect(runFetch.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('says the space will be freed when the entry is a copy', async () => {
    render(DownloadsPage);
    await screen.findByText('my-model');

    const dialog = await openRemovalDialog(1);
    expect(dialog).toHaveTextContent(/space will be freed/i);
  });

  it('sends nothing when the removal is cancelled', async () => {
    const deleteSpy = vi.spyOn(api, 'deleteCheckpoint').mockResolvedValue({ status: 'ok' } as any);

    render(DownloadsPage);
    await screen.findByText('step-1000.safetensors');

    const dialog = await openRemovalDialog(0);
    await fireEvent.click(await within(dialog).findByRole('button', { name: 'Cancel', hidden: true }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('offers removal for an entry that was never stored', async () => {
    // Nothing to download, but the row must still be clearable or it stays in
    // the list forever.
    vi.spyOn(api, 'getDownloadRun').mockResolvedValue({
      run: { key: 'run-a' },
      checkpoints: [{ ...FILE_CHECKPOINT, available: false }],
    } as any);
    const deleteSpy = vi.spyOn(api, 'deleteCheckpoint').mockResolvedValue({ status: 'ok' } as any);

    render(DownloadsPage);
    await screen.findByText(/on disk at/i);

    await confirmDialog(await openRemovalDialog(0));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('run-a', 'step-1000.safetensors');
    });
  });
});
