import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readable } from 'svelte/store';
import SamplingPage from './+page.svelte';
import { createSamplesQuery, createUpdateSamplesMutation, createRequestSampleMutation } from '$lib/api/queries';

vi.mock('$lib/config/context', () => ({
  getRouteContext: () => ({
    workspace: {
      draft: {},
      errors: [],
      setRaw: vi.fn(),
    },
    schema: {
      tabs: [{ id: 'sampling', label: 'Sampling', groups: [] }],
    },
    openDirectory: vi.fn(),
  }),
}));

vi.mock('$lib/api/queries', () => ({
  createSamplesQuery: vi.fn(),
  createUpdateSamplesMutation: vi.fn(),
  createRequestSampleMutation: vi.fn(),
}));

describe('SamplingPage', () => {
  const mockSamples = [
    {
      prompt: 'a cute shiba inu dog',
      negative_prompt: 'blurry, low quality',
      enabled: true,
      width: 512,
      height: 512,
      diffusion_steps: 30,
      cfg_scale: 7.5,
      seed: 12345,
      noise_scheduler: 'EULER_A',
    },
    {
      prompt: 'a futuristic city at night',
      negative_prompt: '',
      enabled: false,
      width: 768,
      height: 768,
      diffusion_steps: 40,
      cfg_scale: 8.0,
      seed: -1,
      noise_scheduler: 'DDIM',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createRequestSampleMutation).mockReturnValue(
      readable({
        mutateAsync: vi.fn(),
        isPending: false,
      }) as any
    );
  });

  it('renders title, Sample Now button, compact options panel, Sample Prompts header, and Add Sample Prompt button', () => {
    vi.mocked(createSamplesQuery).mockReturnValue(
      readable({
        data: [],
        isLoading: false,
        isError: false,
      }) as any
    );
    vi.mocked(createUpdateSamplesMutation).mockReturnValue(
      readable({
        mutateAsync: vi.fn(),
        isPending: false,
      }) as any
    );

    const { container } = render(SamplingPage);

    expect(screen.getByRole('heading', { level: 1, name: 'Sampling' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sample now/i })).toBeInTheDocument();
    
    // Compact options panel wrapper
    const optionsPanel = container.querySelector('.options-panel');
    expect(optionsPanel).toBeInTheDocument();

    // Section header
    expect(screen.getByRole('heading', { level: 2, name: /sample prompts \(0\)/i })).toBeInTheDocument();

    // Add Card button
    expect(screen.getByRole('button', { name: /add sample prompt/i })).toBeInTheDocument();
  });

  it('renders sample cards from createSamplesQuery mock and opens SampleDetailModal on card click or edit', async () => {
    vi.mocked(createSamplesQuery).mockReturnValue(
      readable({
        data: mockSamples,
        isLoading: false,
        isError: false,
      }) as any
    );
    vi.mocked(createUpdateSamplesMutation).mockReturnValue(
      readable({
        mutateAsync: vi.fn(),
        isPending: false,
      }) as any
    );

    render(SamplingPage);

    // Prompt snippets
    expect(screen.getByText('a cute shiba inu dog')).toBeInTheDocument();
    expect(screen.getByText('a futuristic city at night')).toBeInTheDocument();
    expect(screen.getByText('blurry, low quality')).toBeInTheDocument();

    // Parameter pills
    expect(screen.getByText('512 × 512')).toBeInTheDocument();
    expect(screen.getByText('30 steps')).toBeInTheDocument();
    expect(screen.getByText('CFG 7.5')).toBeInTheDocument();
    expect(screen.getByText('Seed: 12345')).toBeInTheDocument();

    // Clicking card opens edit modal
    const firstCardText = screen.getByText('a cute shiba inu dog');
    await fireEvent.click(firstCardText);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Sample Prompt')).toBeInTheDocument();
  });
});
