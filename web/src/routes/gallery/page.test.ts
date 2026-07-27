import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GalleryPage from './+page.svelte';
import { api } from '$lib/api/client';
import type { GalleryRunModel } from '$lib/api/types';

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

    const trigger = await screen.findByRole('button', { name: /2026-07-26_12-00-00/ });
    await fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: '2026-07-26_11-00-00' })[0]).toBeInTheDocument();
    });
    const options = screen.getAllByRole('option', { name: '2026-07-26_11-00-00' });
    await fireEvent.click(options[0]);

    expect(await screen.findByAltText('Historical checkpoint')).toBeInTheDocument();
  });
});
