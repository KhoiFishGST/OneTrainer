import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GalleryPage from './+page.svelte';
import { api } from '$lib/api/client';
import type { GalleryRunModel } from '$lib/api/types';
import GalleryHarness from './GalleryTestHarness.svelte';
import { toast } from 'svelte-sonner';

vi.mock('svelte-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

function fakeWorkspace(overrides: Record<string, any> = {}) {
  return {
    revision: 'rev-1',
    dirty: false,
    acceptRemote: vi.fn(),
    reloadServer: vi.fn(),
    ...overrides,
  };
}

function activeGallery(key: string): GalleryRunModel {
  return {
    active: true,
    run: {
      key,
      config_filename: 'config.json',
      started_at: key,
    },
    revisions: {
      rev_1: {
        captured_at: key,
        prompts: [
          {
            webui_id: 'p1',
            source_index: 0,
            enabled: true,
            prompt: 'Active run prompt',
            width: 512,
            height: 512,
            diffusion_steps: 20,
            cfg_scale: 7.0,
          },
        ],
      },
    },
    batches: [
      {
        id: 1,
        sampled_at: key,
        epoch: 1,
        epoch_step: 10,
        global_step: 10,
        prompt_revision_id: 'rev_1',
        expected_prompt_ids: ['p1'],
        expected_variants: ['ema'],
        samples: [
          {
            webui_prompt_id: 'p1',
            source_index: 0,
            variant: 'ema',
            status: 'ready',
            filename: 'sample_active.png',
          },
        ],
        unassigned_errors: [],
      },
    ],
  };
}

function mockGalleryRuns(keys: string[]) {
  vi.spyOn(api, 'getGalleryRuns').mockResolvedValue({
    runs: keys.map((key) => ({
      key,
      config_filename: 'config.json',
      started_at: key,
      batch_count: 1,
    })),
  });
}

function mockCurrentGallery(model: GalleryRunModel) {
  vi.spyOn(api, 'getCurrentGallery').mockResolvedValue(model);
}

describe('Gallery Route Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('selects the active run and allows exact historical selection', async () => {
    mockGalleryRuns(['2026-07-26_12-00-00', '2026-07-26_11-00-00']);
    mockCurrentGallery(activeGallery('2026-07-26_12-00-00'));
    vi.spyOn(api, 'getGalleryRun').mockImplementation(async (runKey) => {
      return {
        active: false,
        run: { key: runKey, config_filename: 'config.json', started_at: runKey },
        revisions: {
          rev_1: {
            captured_at: runKey,
            prompts: [
              {
                webui_id: 'p1',
                source_index: 0,
                enabled: true,
                prompt: 'Historical checkpoint',
                width: 512,
                height: 512,
                diffusion_steps: 20,
                cfg_scale: 7.0,
              },
            ],
          },
        },
        batches: [
          {
            id: 1,
            sampled_at: runKey,
            epoch: 1,
            epoch_step: 10,
            global_step: 10,
            prompt_revision_id: 'rev_1',
            expected_prompt_ids: ['p1'],
            expected_variants: ['ema'],
            samples: [
              {
                webui_prompt_id: 'p1',
                source_index: 0,
                variant: 'ema',
                status: 'ready',
                filename: 'sample_hist.png',
              },
            ],
            unassigned_errors: [],
          },
        ],
      };
    });

    render(GalleryPage);

    expect(await screen.findByAltText('Active run prompt')).toBeInTheDocument();

    const select = await screen.findByRole('combobox', { name: 'Run' }) as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: '1' } });

    await waitFor(async () => {
      expect(await screen.findByAltText('Historical checkpoint')).toBeInTheDocument();
    });
  });

  it('loads the selected run config and toasts on success', async () => {
    mockGalleryRuns(['2026-07-26_12-00-00']);
    mockCurrentGallery(activeGallery('2026-07-26_12-00-00'));
    const loadSpy = vi
      .spyOn(api, 'loadGalleryRunConfig')
      .mockResolvedValue({ config: { a: 1 }, revision: 'rev-2' } as any);
    const workspace = fakeWorkspace();

    render(GalleryHarness, { props: { workspace } });

    const button = await screen.findByRole('button', { name: 'Load Run' });
    await waitFor(() => expect(button).not.toBeDisabled());
    await fireEvent.click(button);

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledWith('2026-07-26_12-00-00', 'rev-1');
    });
    expect(workspace.acceptRemote).toHaveBeenCalledWith({
      config: { a: 1 },
      revision: 'rev-2',
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Loaded config from run 2026-07-26_12-00-00'
    );
  });

  it('toasts the server detail when loading a run fails', async () => {
    mockGalleryRuns(['2026-07-26_12-00-00']);
    mockCurrentGallery(activeGallery('2026-07-26_12-00-00'));
    vi.spyOn(api, 'loadGalleryRunConfig').mockRejectedValue(
      Object.assign(new Error('boom'), {
        status: 404,
        detail: 'Config file for this run no longer exists',
      })
    );
    const workspace = fakeWorkspace();

    render(GalleryHarness, { props: { workspace } });

    const button = await screen.findByRole('button', { name: 'Load Run' });
    await waitFor(() => expect(button).not.toBeDisabled());
    await fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Config file for this run no longer exists'
      );
    });
    expect(workspace.acceptRemote).not.toHaveBeenCalled();
  });

  it('disables Load Run when there is no config file recorded for the run', async () => {
    vi.spyOn(api, 'getGalleryRuns').mockResolvedValue({
      runs: [
        {
          key: '2026-07-26_12-00-00',
          config_filename: '',
          started_at: '2026-07-26_12-00-00',
          batch_count: 1,
        },
      ],
    } as any);
    mockCurrentGallery(activeGallery('2026-07-26_12-00-00'));

    render(GalleryHarness, { props: { workspace: fakeWorkspace() } });

    const button = await screen.findByRole('button', { name: 'Load Run' });
    await waitFor(() => expect(button).toBeDisabled());
  });

  it('confirms before discarding unsaved edits, and loads on confirm', async () => {
    mockGalleryRuns(['2026-07-26_12-00-00']);
    mockCurrentGallery(activeGallery('2026-07-26_12-00-00'));
    const loadSpy = vi
      .spyOn(api, 'loadGalleryRunConfig')
      .mockResolvedValue({ config: { a: 1 }, revision: 'rev-2' } as any);
    const workspace = fakeWorkspace({ dirty: true });

    render(GalleryHarness, { props: { workspace } });

    const button = await screen.findByRole('button', { name: 'Load Run' });
    await waitFor(() => expect(button).not.toBeDisabled());
    await fireEvent.click(button);

    await screen.findByText('Discard unsaved changes?');
    expect(loadSpy).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('alertdialog');
    const confirm = await within(dialog).findByRole('button', { name: 'Load Run', hidden: true });
    await fireEvent.click(confirm);

    await waitFor(() => {
      expect(workspace.reloadServer).toHaveBeenCalledWith(true);
      expect(loadSpy).toHaveBeenCalledWith('2026-07-26_12-00-00', 'rev-1');
    });

    expect(workspace.reloadServer.mock.invocationCallOrder[0]).toBeLessThan(
      loadSpy.mock.invocationCallOrder[0]
    );
  });

  it('sends nothing when the discard confirmation is cancelled', async () => {
    mockGalleryRuns(['2026-07-26_12-00-00']);
    mockCurrentGallery(activeGallery('2026-07-26_12-00-00'));
    const loadSpy = vi.spyOn(api, 'loadGalleryRunConfig').mockResolvedValue({} as any);
    const workspace = fakeWorkspace({ dirty: true });

    render(GalleryHarness, { props: { workspace } });

    const button = await screen.findByRole('button', { name: 'Load Run' });
    await waitFor(() => expect(button).not.toBeDisabled());
    await fireEvent.click(button);

    await screen.findByText('Discard unsaved changes?');
    await fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    });
    expect(loadSpy).not.toHaveBeenCalled();
    expect(workspace.reloadServer).not.toHaveBeenCalled();
  });
});
