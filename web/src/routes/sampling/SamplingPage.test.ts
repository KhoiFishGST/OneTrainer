import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readable } from 'svelte/store';
import SamplingPage from './+page.svelte';
import {
  createSamplesQuery,
  createUpdateSamplesMutation,
  createRequestSampleMutation,
  createSampleFilesQuery,
  createCreateSampleFileMutation,
} from '$lib/api/queries';

vi.mock('$lib/config/context', () => ({
  getRouteContext: () => ({
    workspace: {
      draft: { sample_definition_file_name: 'samples.json' },
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
  createSampleFilesQuery: vi.fn(),
  createCreateSampleFileMutation: vi.fn(),
}));

describe('SamplingPage', () => {
  const mockSamples = [
    {
      webui_id: 'prompt_1',
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
      webui_id: 'prompt_2',
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
    vi.mocked(createSampleFilesQuery).mockReturnValue(
      readable({
        data: { files: ['samples.json', 'portrait.json'] },
        isLoading: false,
        isError: false,
      }) as any
    );
    vi.mocked(createCreateSampleFileMutation).mockReturnValue(
      readable({
        mutateAsync: vi.fn().mockResolvedValue({ filename: 'new_samples.json' }),
        isPending: false,
      }) as any
    );
  });

  it('renders sample config selector bar and prompt table', async () => {
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

    render(SamplingPage);
    expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Sample Prompt/i })).toBeInTheDocument();
  });

  it('renders title, Sample Now button, compact options panel, and Sample Prompts header', () => {
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
  });

  it('renders prompt table rows from createSamplesQuery mock and opens SampleDetailModal on edit click', async () => {
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

    // Prompt input values in prompt table
    expect(screen.getByDisplayValue('a cute shiba inu dog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('a futuristic city at night')).toBeInTheDocument();

    // Clicking edit button on first prompt row opens modal
    const editBtn = screen.getAllByTitle('Edit sample prompt')[0];
    await fireEvent.click(editBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Sample Prompt')).toBeInTheDocument();
  });

  it('shows durable queued feedback when queued is true', async () => {
    vi.mocked(createSamplesQuery).mockReturnValue(
      readable({
        data: {
          samples: [
            {
              webui_id: 'prompt_a',
              prompt: 'a cute shiba inu dog',
              enabled: true,
            },
          ],
          queued: true,
        },
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

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sample prompt changes are queued for the next sampling batch.'
    );
  });

  it('preserves identity on edit but removes it on clone', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(createSamplesQuery).mockReturnValue(
      readable({
        data: {
          samples: [
            {
              webui_id: 'prompt_a',
              prompt: 'source prompt',
              enabled: true,
              width: 512,
              height: 512,
              diffusion_steps: 30,
              cfg_scale: 7.5,
              seed: 12345,
            },
          ],
          queued: false,
        },
        isLoading: false,
        isError: false,
      }) as any
    );
    vi.mocked(createUpdateSamplesMutation).mockReturnValue(
      readable({
        mutateAsync,
        isPending: false,
      }) as any
    );

    render(SamplingPage);

    const cloneBtn = screen.getByTitle('Clone sample prompt');
    await fireEvent.click(cloneBtn);

    expect(mutateAsync).toHaveBeenCalled();
    const updatedSamples = mutateAsync.mock.calls[0][0];
    expect(updatedSamples).toHaveLength(2);
    expect(updatedSamples[0].webui_id).toBe('prompt_a');
    expect(updatedSamples[1]).not.toHaveProperty('webui_id');
  });
});
