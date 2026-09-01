import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import GalleryImageViewer from './GalleryImageViewer.svelte';
import type { GalleryRunModel } from '../../api/types';
import { galleryImageUrl } from '../../api/client';

const mockGallery: GalleryRunModel = {
  active: false,
  run: {
    key: 'run_123',
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
          prompt: 'first prompt text',
          negative_prompt: 'first negative prompt',
          width: 512,
          height: 512,
          diffusion_steps: 20,
          cfg_scale: 7.5,
          seed: 42,
          random_seed: false,
          noise_scheduler: 'euler_a',
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
          prompt: 'old prompt text',
          negative_prompt: 'old negative prompt',
          width: 512,
          height: 512,
          diffusion_steps: 30,
          cfg_scale: 7.0,
          seed: -1,
          random_seed: true,
          noise_scheduler: 'euler_a',
        },
      ],
    },
  },
  batches: [
    {
      id: 1,
      sampled_at: '2026-07-26T00:10:00Z',
      epoch: 1,
      epoch_step: 100,
      global_step: 100,
      prompt_revision_id: 'rev_1',
      expected_prompt_ids: ['prompt_a'],
      expected_variants: ['ema'],
      samples: [
        {
          webui_prompt_id: 'prompt_a',
          source_index: 0,
          variant: 'ema',
          status: 'ready',
          filename: 'sample_b1.png',
        },
      ],
      unassigned_errors: [],
    },
    {
      id: 2,
      sampled_at: '2026-07-26T00:20:00Z',
      epoch: 2,
      epoch_step: 200,
      global_step: 200,
      prompt_revision_id: 'rev_2',
      expected_prompt_ids: ['prompt_a'],
      expected_variants: ['ema'],
      samples: [
        {
          webui_prompt_id: 'prompt_a',
          source_index: 0,
          variant: 'ema',
          status: 'ready',
          filename: 'sample_b2.png',
        },
      ],
      unassigned_errors: [],
    },
    {
      id: 3,
      sampled_at: '2026-07-26T00:30:00Z',
      epoch: 3,
      epoch_step: 300,
      global_step: 300,
      prompt_revision_id: 'rev_2',
      expected_prompt_ids: ['prompt_a'],
      expected_variants: ['ema'],
      samples: [
        {
          webui_prompt_id: 'prompt_a',
          source_index: 0,
          variant: 'ema',
          status: 'ready',
          filename: 'sample_b3.png',
        },
      ],
      unassigned_errors: [],
    },
  ],
};

const previousImageUrl = galleryImageUrl('run_123', 'sample_b1.png');
const currentImageUrl = galleryImageUrl('run_123', 'sample_b2.png');
const nextImageUrl = galleryImageUrl('run_123', 'sample_b3.png');

function renderViewerAtMiddleCheckpoint() {
  return render(GalleryImageViewer, {
    props: {
      open: true,
      gallery: mockGallery,
      selection: { batchId: 2, promptId: 'prompt_a', variant: 'ema' },
      onClose: vi.fn(),
    },
  });
}

function renderGalleryAndOpenViewer() {
  const button = document.createElement('button');
  button.textContent = 'Card';
  document.body.appendChild(button);
  button.focus();
  render(GalleryImageViewer, {
    props: {
      open: true,
      gallery: mockGallery,
      selection: { batchId: 2, promptId: 'prompt_a', variant: 'ema' },
      onClose: vi.fn(),
    },
  });
  return button;
}

describe('GalleryImageViewer', () => {
  it('navigates only ready checkpoints for the selected prompt and variant', async () => {
    render(GalleryImageViewer, {
      props: { open: true, gallery: mockGallery, selection: { batchId: 2, promptId: 'prompt_a', variant: 'ema' }, onClose: vi.fn() },
    });
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(screen.getByText('Epoch 3 \u00b7 Step 300')).toBeInTheDocument();
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(screen.getByText('Epoch 3 \u00b7 Step 300')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next checkpoint' })).toBeDisabled();
  });

  it('navigates when focus sits outside the dialog content', async () => {
    // Opening the viewer autofocuses a nav button. Stepping to either end
    // disables that button, the browser blurs it, and focus falls to <body>
    // -- so a handler bound to the dialog element stops receiving keys after
    // a single press. Arrow keys must work wherever focus happens to be.
    render(GalleryImageViewer, {
      props: {
        open: true,
        gallery: mockGallery,
        selection: { batchId: 1, promptId: 'prompt_a', variant: 'ema' },
        onClose: vi.fn(),
      },
    });

    document.body.focus();
    await fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByText('Epoch 2 \u00b7 Step 200')).toBeInTheDocument();

    await fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByText('Epoch 3 \u00b7 Step 300')).toBeInTheDocument();

    await fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(screen.getByText('Epoch 2 \u00b7 Step 200')).toBeInTheDocument();
  });

  it('ignores arrow keys while closed', async () => {
    render(GalleryImageViewer, {
      props: {
        open: false,
        gallery: mockGallery,
        selection: { batchId: 1, promptId: 'prompt_a', variant: 'ema' },
        onClose: vi.fn(),
      },
    });

    await fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves arrow keys to a focused text field', async () => {
    render(GalleryImageViewer, {
      props: {
        open: true,
        gallery: mockGallery,
        selection: { batchId: 1, promptId: 'prompt_a', variant: 'ema' },
        onClose: vi.fn(),
      },
    });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    await fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByText('Epoch 1 \u00b7 Step 100')).toBeInTheDocument();

    input.remove();
  });

  it('navigates with a horizontal swipe but ignores vertical movement', async () => {
    renderViewerAtMiddleCheckpoint();
    const imageStage = document.querySelector('.viewer-image-stage') as HTMLElement;
    await fireEvent.touchStart(imageStage, { touches: [{ clientX: 200, clientY: 100 }] });
    await fireEvent.touchEnd(imageStage, { changedTouches: [{ clientX: 120, clientY: 105 }] });
    expect(screen.getByText('Epoch 3 \u00b7 Step 300')).toBeInTheDocument();
  });

  it('shows exact historical metadata and a revision boundary', () => {
    renderViewerAtMiddleCheckpoint();
    expect(screen.getByText('old prompt text')).toBeInTheDocument();
    expect(screen.getByText('old negative prompt')).toBeInTheDocument();
    expect(screen.getByText('Prompt changed at this checkpoint')).toBeInTheDocument();
  });

  it('prefetches only adjacent ready images and exposes the original', async () => {
    const prefetched: string[] = [];
    vi.stubGlobal('Image', class { set src(value: string) { prefetched.push(value); } });
    renderViewerAtMiddleCheckpoint();
    await waitFor(() => expect(prefetched).toEqual([previousImageUrl, nextImageUrl]));
    expect(screen.getByRole('link', { name: 'Open original' })).toHaveAttribute('href', currentImageUrl);
  });

  it('closes on Escape and restores focus to the opening card', async () => {
    const opener = renderGalleryAndOpenViewer();
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('labels seed Random only when random_seed is true and preserves numeric -1', () => {
    render(GalleryImageViewer, {
      props: {
        open: true,
        gallery: mockGallery,
        selection: { batchId: 2, promptId: 'prompt_a', variant: 'ema' },
        onClose: vi.fn(),
      },
    });
    expect(screen.getByText(/Random/i)).toBeInTheDocument();

    render(GalleryImageViewer, {
      props: {
        open: true,
        gallery: mockGallery,
        selection: { batchId: 1, promptId: 'prompt_a', variant: 'ema' },
        onClose: vi.fn(),
      },
    });
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });
});
