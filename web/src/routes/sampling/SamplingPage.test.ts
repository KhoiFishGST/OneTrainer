import { render, screen, fireEvent, waitFor, act } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readable, writable } from 'svelte/store';
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
    expect(screen.getAllByRole('button', { name: /Add Sample Prompt/i })[0]).toBeInTheDocument();
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
    expect(screen.getAllByDisplayValue('a cute shiba inu dog')[0]).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('a futuristic city at night')[0]).toBeInTheDocument();

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

    const cloneBtn = screen.getAllByTitle('Clone sample prompt')[0];
    await fireEvent.click(cloneBtn);

    expect(mutateAsync).toHaveBeenCalled();
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload.file).toBe('samples.json');
    const updatedSamples = payload.samples;
    expect(updatedSamples).toHaveLength(2);
    expect(updatedSamples[0].webui_id).toBe('prompt_a');
    expect(updatedSamples[1]).not.toHaveProperty('webui_id');
  });

  it('triggers AlertDialog for sample deletion, handles pending state, prevents duplicate calls, retains error on failure, and closes on resolution', async () => {
    let resolveMutation: (v?: any) => void = () => {};
    let rejectMutation: (e: any) => void = () => {};

    const mutateAsync = vi.fn().mockImplementation(() => {
      return new Promise((res, rej) => {
        resolveMutation = res;
        rejectMutation = rej;
      });
    });

    vi.mocked(createSamplesQuery).mockReturnValue(
      readable({
        data: {
          samples: [
            {
              webui_id: 'prompt_1',
              prompt: 'a cute shiba inu dog',
              enabled: true,
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

    // 1. Click delete button
    const deleteBtn = screen.getAllByTitle('Delete sample prompt')[0];
    await fireEvent.click(deleteBtn);

    const alertDialog = await screen.findByRole('alertdialog');
    expect(alertDialog).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this sample prompt\?/i)).toBeInTheDocument();

    // 2. Click confirm delete
    const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
    await fireEvent.click(confirmDeleteBtn);

    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // Dialog remains open and confirm button is disabled while pending
    expect(alertDialog).toBeInTheDocument();
    expect(confirmDeleteBtn).toBeDisabled();

    // Duplicate click does not add calls
    await fireEvent.click(confirmDeleteBtn);
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // Reject promise -> error shown, dialog remains open
    await act(async () => {
      rejectMutation(new Error('Sample delete error'));
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(await screen.findByText('Sample delete error')).toBeInTheDocument();
    expect(confirmDeleteBtn).not.toBeDisabled();

    // Retry
    await fireEvent.click(confirmDeleteBtn);
    expect(mutateAsync).toHaveBeenCalledTimes(2);

    // Resolve promise -> dialog closes
    await act(async () => {
      resolveMutation({});
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('removes item by webui_id identity when query result is reordered while deletion dialog is open', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    const samplesStore = writable({
      data: {
        samples: [
          { webui_id: 'id_alpha', prompt: 'Alpha Prompt', enabled: true },
          { webui_id: 'id_beta', prompt: 'Beta Prompt', enabled: true },
        ],
        queued: false,
      },
      isLoading: false,
      isError: false,
    });

    vi.mocked(createSamplesQuery).mockReturnValue(samplesStore as any);
    vi.mocked(createUpdateSamplesMutation).mockReturnValue(
      readable({ mutateAsync, isPending: false }) as any
    );

    render(SamplingPage);

    // Click delete on first item (Alpha, webui_id: 'id_alpha', index 0)
    const deleteBtns = screen.getAllByTitle('Delete sample prompt');
    await fireEvent.click(deleteBtns[0]);

    const alertDialog = await screen.findByRole('alertdialog');
    expect(alertDialog).toBeInTheDocument();

    // Reorder store while dialog is open (Beta becomes index 0, Alpha becomes index 1)
    await act(() => {
      samplesStore.set({
        data: {
          samples: [
            { webui_id: 'id_beta', prompt: 'Beta Prompt', enabled: true },
            { webui_id: 'id_alpha', prompt: 'Alpha Prompt', enabled: true },
          ],
          queued: false,
        },
        isLoading: false,
        isError: false,
      });
    });

    // Click confirm delete
    const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
    await fireEvent.click(confirmDeleteBtn);

    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // Payload should remove Alpha (webui_id: 'id_alpha'), leaving Beta
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload.samples).toHaveLength(1);
    expect(payload.samples[0].webui_id).toBe('id_beta');
  });
});
