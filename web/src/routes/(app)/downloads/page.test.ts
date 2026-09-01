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

const ARTIFACTS = [
  { kind: 'config', label: 'Config', available: true, is_archive: false, size_bytes: 23552,
    download_name: 'run-a.json' },
  { kind: 'metrics', label: 'Metrics', available: true, is_archive: false, size_bytes: 4096,
    download_name: 'run-a-metrics.jsonl' },
  { kind: 'samples', label: 'Samples', available: true, is_archive: true, size_bytes: 2411724,
    download_name: 'run-a-samples.zip' },
  { kind: 'tensorboard', label: 'Tensorboard', available: true, is_archive: true, size_bytes: 10905190,
    download_name: 'run-a-tensorboard.zip' },
];

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
      artifacts: ARTIFACTS,
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
      artifacts: ARTIFACTS,
    } as any);

    render(DownloadsPage);

    expect(await screen.findByText(/on disk at/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /download step-1000\.safetensors/i })
    ).not.toBeInTheDocument();
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
      artifacts: ARTIFACTS,
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
      artifacts: ARTIFACTS,
    } as any);
    const deleteSpy = vi.spyOn(api, 'deleteCheckpoint').mockResolvedValue({ status: 'ok' } as any);

    render(DownloadsPage);
    await screen.findByText(/on disk at/i);

    await confirmDialog(await openRemovalDialog(0));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('run-a', 'step-1000.safetensors');
    });
  });

  it('lists the run artifacts with their sizes', async () => {
    render(DownloadsPage);

    expect(await screen.findByText('Run artifacts')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Samples')).toBeInTheDocument();
    expect(screen.getByText('Tensorboard')).toBeInTheDocument();
    expect(screen.getByText('23.0 KB')).toBeInTheDocument();
  });

  it('points each artifact at its own enum-keyed route', async () => {
    render(DownloadsPage);

    const config = await screen.findByRole('link', { name: /download config/i });
    expect(config).toHaveAttribute('href', '/api/downloads/runs/run-a/artifacts/config');
    expect(screen.getByRole('link', { name: /download samples/i })).toHaveAttribute(
      'href',
      '/api/downloads/runs/run-a/artifacts/samples'
    );
    expect(screen.getByRole('link', { name: /download tensorboard/i })).toHaveAttribute(
      'href',
      '/api/downloads/runs/run-a/artifacts/tensorboard'
    );
  });

  it('says the tensorboard size is uncompressed', async () => {
    // The transfer is several times smaller than the figure shown, so the
    // number would otherwise look wrong.
    render(DownloadsPage);

    expect(await screen.findByText(/compressed on download/i)).toBeInTheDocument();
  });

  it('shows an unavailable artifact as a fact rather than hiding it', async () => {
    vi.spyOn(api, 'getDownloadRun').mockResolvedValue({
      run: { key: 'run-a' },
      checkpoints: [],
      artifacts: [
        ARTIFACTS[0],
        ARTIFACTS[1],
        { ...ARTIFACTS[2], available: false, size_bytes: 0 },
        ARTIFACTS[3],
      ],
    } as any);

    render(DownloadsPage);

    expect(await screen.findByText(/not available for this run/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /download samples/i })
    ).not.toBeInTheDocument();
  });

  it('renders the artifacts panel for a run with no checkpoints', async () => {
    // A run stopped before its first save still has a config and logs.
    vi.spyOn(api, 'getDownloadRun').mockResolvedValue({
      run: { key: 'run-a' },
      checkpoints: [],
      artifacts: ARTIFACTS,
    } as any);

    render(DownloadsPage);

    expect(await screen.findByRole('link', { name: /download config/i })).toBeInTheDocument();
  });

  it('offers the metrics artifact at its own route', async () => {
    render(DownloadsPage);

    const link = await screen.findByRole('link', { name: /download metrics/i });
    expect(link).toHaveAttribute('href', '/api/downloads/runs/run-a/artifacts/metrics');
  });

  it('says so when a run has no checkpoints', async () => {
    // The normal shape for a run that logged metrics and never saved -- which
    // previously rendered a bare table header and nothing else.
    vi.spyOn(api, 'getDownloadRun').mockResolvedValue({
      run: { key: 'run-a' },
      checkpoints: [],
      artifacts: ARTIFACTS,
    } as any);

    render(DownloadsPage);

    expect(await screen.findByText(/no checkpoints for this run/i)).toBeInTheDocument();
    // The artifacts are still offered.
    expect(screen.getByRole('link', { name: /download config/i })).toBeInTheDocument();
  });

  it('keeps only file, size and the actions on a narrow screen', async () => {
    // The checkpoint table has six columns and overflowed the viewport on a
    // phone. Kind, Format and Storage are the ones a small screen can lose.
    render(DownloadsPage);

    await screen.findByRole('cell', { name: 'step-1000.safetensors' });

    const headers = screen.getAllByRole('columnheader');
    const desktopOnly = (name: string) =>
      headers.find((h) => h.textContent?.trim() === name)?.className ?? '';

    expect(desktopOnly('Kind')).toContain('hidden md:table-cell');
    expect(desktopOnly('Format')).toContain('hidden md:table-cell');
    expect(desktopOnly('Storage')).toContain('hidden md:table-cell');
    expect(desktopOnly('File')).not.toContain('hidden');
    expect(desktopOnly('Size')).not.toContain('hidden');
  });

  it('labels the compact download and remove controls for screen readers', async () => {
    // Both collapse to a bare icon on mobile, so the accessible name has to
    // come from the label rather than the visible text.
    render(DownloadsPage);

    const download = await screen.findByRole('link', { name: 'Download step-1000.safetensors' });
    expect(download.querySelector('svg')).toBeTruthy();

    const remove = screen.getByRole('button', { name: 'Remove step-1000.safetensors' });
    expect(remove.querySelector('svg')).toBeTruthy();
  });

  it('describes the empty page in terms of runs, not saves', async () => {
    vi.spyOn(api, 'getDownloadRuns').mockResolvedValue({ runs: [] } as any);

    render(DownloadsPage);

    await waitFor(() => {
      expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
    });
  });
});

