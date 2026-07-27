import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import SampleGallery from './SampleGallery.svelte';
import type { GalleryRunModel } from '../../api/types';

const galleryWithEditedPrompt: GalleryRunModel = {
  active: false,
  run: {
    key: 'run_1',
    config_filename: 'config.json',
    started_at: '2026-07-26T00:00:00Z',
  },
  revisions: {
    rev_1: {
      captured_at: '2026-07-26T00:00:00Z',
      prompts: [
        {
          webui_id: 'prompt_a',
          source_index: 0,
          enabled: true,
          prompt: 'old prompt',
          width: 512,
          height: 512,
          diffusion_steps: 20,
          cfg_scale: 7,
          seed: 42,
        },
      ],
    },
    rev_2: {
      captured_at: '2026-07-26T01:00:00Z',
      prompts: [
        {
          webui_id: 'prompt_a',
          source_index: 0,
          enabled: true,
          prompt: 'edited prompt',
          width: 512,
          height: 512,
          diffusion_steps: 20,
          cfg_scale: 7,
          seed: 42,
        },
      ],
    },
  },
  batches: [
    {
      id: 1,
      sampled_at: '2026-07-26T00:00:00Z',
      epoch: 0,
      epoch_step: 0,
      global_step: 0,
      prompt_revision_id: 'rev_1',
      expected_prompt_ids: ['prompt_a'],
      expected_variants: ['base'],
      samples: [
        {
          webui_prompt_id: 'prompt_a',
          source_index: 0,
          variant: 'base',
          status: 'ready',
          filename: 'sample_0.png',
        },
      ],
      unassigned_errors: [],
    },
    {
      id: 2,
      sampled_at: '2026-07-26T01:00:00Z',
      epoch: 1,
      epoch_step: 100,
      global_step: 100,
      prompt_revision_id: 'rev_2',
      expected_prompt_ids: ['prompt_a'],
      expected_variants: ['base'],
      samples: [
        {
          webui_prompt_id: 'prompt_a',
          source_index: 0,
          variant: 'base',
          status: 'ready',
          filename: 'sample_100.png',
        },
      ],
      unassigned_errors: [],
    },
  ],
};

const progressiveGallery: GalleryRunModel = {
  active: true,
  run: {
    key: 'run_prog',
    config_filename: 'config.json',
    started_at: '2026-07-26T00:00:00Z',
  },
  revisions: {
    rev_1: {
      captured_at: '2026-07-26T00:00:00Z',
      prompts: [
        {
          webui_id: 'prompt_a',
          source_index: 0,
          enabled: true,
          prompt: 'progressive prompt',
          width: 512,
          height: 512,
          diffusion_steps: 20,
          cfg_scale: 7,
        },
        {
          webui_id: 'prompt_b',
          source_index: 1,
          enabled: true,
          prompt: 'prompt b',
          width: 512,
          height: 512,
          diffusion_steps: 20,
          cfg_scale: 7,
        },
      ],
    },
  },
  batches: [
    {
      id: 1,
      sampled_at: '2026-07-26T00:00:00Z',
      epoch: 1,
      epoch_step: 50,
      global_step: 50,
      prompt_revision_id: 'rev_1',
      expected_prompt_ids: ['prompt_a', 'prompt_b'],
      expected_variants: ['ema', 'non_ema'],
      samples: [
        {
          webui_prompt_id: 'prompt_a',
          source_index: 0,
          variant: 'ema',
          status: 'ready',
          filename: 'ready.png',
        },
        {
          webui_prompt_id: 'prompt_a',
          source_index: 0,
          variant: 'non_ema',
          status: 'pending',
        },
        {
          webui_prompt_id: 'prompt_b',
          source_index: 1,
          variant: 'ema',
          status: 'unavailable',
        },
        {
          webui_prompt_id: 'prompt_b',
          source_index: 1,
          variant: 'non_ema',
          status: 'error',
          error: 'Gallery error',
        },
      ],
      unassigned_errors: [],
    },
  ],
};

const singleVariantGallery: GalleryRunModel = {
  active: false,
  run: {
    key: 'run_single',
    config_filename: 'config.json',
    started_at: '2026-07-26T00:00:00Z',
  },
  revisions: {
    rev_1: {
      captured_at: '2026-07-26T00:00:00Z',
      prompts: [
        {
          webui_id: 'p1',
          source_index: 0,
          enabled: true,
          prompt: 'sample prompt',
          width: 1024,
          height: 768,
          diffusion_steps: 20,
          cfg_scale: 7,
          seed: -1,
          random_seed: false,
        },
        {
          webui_id: 'p2',
          source_index: 1,
          enabled: true,
          prompt: 'prompt 2',
          width: 1024,
          height: 768,
          diffusion_steps: 20,
          cfg_scale: 7,
        },
        {
          webui_id: 'p3',
          source_index: 2,
          enabled: true,
          prompt: 'prompt 3',
          width: 1024,
          height: 768,
          diffusion_steps: 20,
          cfg_scale: 7,
        },
      ],
    },
  },
  batches: [
    {
      id: 10,
      sampled_at: '2026-07-26T00:00:00Z',
      epoch: 1,
      epoch_step: 10,
      global_step: 10,
      prompt_revision_id: 'rev_1',
      expected_prompt_ids: ['p1', 'p2', 'p3'],
      expected_variants: ['base'],
      samples: [
        {
          webui_prompt_id: 'p1',
          source_index: 0,
          variant: 'base',
          status: 'ready',
          filename: 'p1.png',
        },
      ],
      unassigned_errors: [],
    },
  ],
};

const emptyGallery: GalleryRunModel = {
  active: false,
  run: null,
  batches: [],
  revisions: {},
};

describe('SampleGallery', () => {
  it('renders chronological checkpoints in ascending order by default and respects per-revision prompt metadata', () => {
    render(SampleGallery, { props: { gallery: galleryWithEditedPrompt } });
    const rows = screen.getAllByTestId('checkpoint-row');
    expect(rows[0]).toHaveTextContent('Step 0');
    expect(rows[1]).toHaveTextContent('Step 100');
    expect(screen.getByRole('button', { name: /Open sample edited prompt/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open sample old prompt/ })).toBeInTheDocument();
  });

  it('allows switching sortOrder via header dropdown', async () => {
    render(SampleGallery, { props: { gallery: galleryWithEditedPrompt } });
    const select = screen.getByRole('combobox', { name: 'Gallery sort order' }) as HTMLSelectElement;
    expect(select.value).toBe('asc');

    await fireEvent.change(select, { target: { value: 'desc' } });
    const descRows = screen.getAllByTestId('checkpoint-row');
    expect(descRows[0]).toHaveTextContent('Step 100');
    expect(descRows[1]).toHaveTextContent('Step 0');
  });

  it('respects limit prop', () => {
    render(SampleGallery, { props: { gallery: galleryWithEditedPrompt, limit: 1 } });
    const limitedRows = screen.getAllByTestId('checkpoint-row');
    expect(limitedRows).toHaveLength(1);
  });

  it('renders EMA and non-EMA variant sub-rows with progressive slots', () => {
    render(SampleGallery, { props: { gallery: progressiveGallery } });
    expect(screen.getByText('EMA')).toBeInTheDocument();
    expect(screen.getByText('Non-EMA')).toBeInTheDocument();
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Gallery error')).toBeInTheDocument();
  });

  it('omits a lone variant label and exposes exact ready-card metadata', async () => {
    render(SampleGallery, { props: { gallery: singleVariantGallery } });
    expect(screen.queryByText('Base')).not.toBeInTheDocument();
    const image = screen.getByRole('img', { name: 'sample prompt' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText('1024\u00d7768')).toBeInTheDocument();
    expect(screen.getByText('20 steps')).toBeInTheDocument();
    expect(screen.getByText('CFG 7')).toBeInTheDocument();
    expect(screen.getByText('Seed -1')).toBeInTheDocument();
    expect(screen.getByTestId('variant-grid')).toHaveStyle('--prompt-columns: 3');
  });

  it.each([
    [{ loading: true }, 'Loading sample gallery...'],
    [{ error: new Error('gallery failed') }, 'gallery failed'],
    [{ gallery: emptyGallery }, 'No samples yet'],
  ])('renders renderer state %#', (props, expected) => {
    render(SampleGallery, { props });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('opens only ready cards and passes the exact selection to the viewer', async () => {
    render(SampleGallery, { props: { gallery: progressiveGallery } });
    expect(screen.getAllByRole('button', { name: /Open sample/ })).toHaveLength(1);
    await fireEvent.click(screen.getByRole('button', { name: /Open sample/ }));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-batch-id', '1');
    expect(screen.getByRole('dialog')).toHaveAttribute('data-prompt-id', 'prompt_a');
    expect(screen.getByRole('dialog')).toHaveAttribute('data-variant', 'ema');
  });
});
