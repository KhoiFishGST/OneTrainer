import { render, screen, fireEvent, waitFor, act } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readable, writable } from 'svelte/store';
import { toast as sonnerToast } from 'svelte-sonner';

import { mockIsMobile } from '$lib/hooks/mock-is-mobile.svelte';

vi.mock('$lib/hooks/is-mobile.svelte', () => ({
  get isMobile() {
    return mockIsMobile;
  },
}));

function setMobileBreakpoint(mobile: boolean) {
  act(() => {
    mockIsMobile.current = mobile;
  });
}

vi.mock('svelte-sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

import SamplingPage from './+page.svelte';
import {
  createSamplesQuery,
  createUpdateSamplesMutation,
  createRequestSampleMutation,
  createSampleFilesQuery,
  createCreateSampleFileMutation,
} from '$lib/api/queries';

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
    setMobileBreakpoint(false);
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

  it('writes the edited prompt by identity after the list reorders', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    (createUpdateSamplesMutation as any).mockReturnValue(
      writable({ mutateAsync, isPending: false })
    );
    const samplesStore = writable({ data: { samples: mockSamples }, isLoading: false });
    (createSamplesQuery as any).mockReturnValue(samplesStore);

    render(SamplingPage);

    const editButtons = await screen.findAllByRole('button', { name: /edit/i });
    await fireEvent.click(editButtons[0]);

    // The query refetches and returns the same samples in the opposite order
    // while the editor for prompt_1 is still open.
    await act(() => {
      samplesStore.set({
        data: { samples: [mockSamples[1], mockSamples[0]] },
        isLoading: false,
      });
    });

    const saveButton = await screen.findByRole('button', { name: /save/i });
    await fireEvent.click(saveButton);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const written = mutateAsync.mock.calls[0][0].samples;
    const edited = written.find((s: any) => s.webui_id === 'prompt_1');
    const untouched = written.find((s: any) => s.webui_id === 'prompt_2');
    expect(edited).toBeDefined();
    expect(untouched.prompt).toBe(mockSamples[1].prompt);
  });

  it('reports an error instead of a false success when the delete target is gone', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    (createUpdateSamplesMutation as any).mockReturnValue(
      writable({ mutateAsync, isPending: false })
    );
    const samplesStore = writable({ data: { samples: mockSamples }, isLoading: false });
    (createSamplesQuery as any).mockReturnValue(samplesStore);

    render(SamplingPage);

    const deleteButtons = await screen.findAllByRole('button', { name: /delete/i });
    await fireEvent.click(deleteButtons[0]);

    // The sample disappears server-side while the confirmation is open.
    await act(() => {
      samplesStore.set({ data: { samples: [mockSamples[1]] }, isLoading: false });
    });

    const confirm = await screen.findByRole('button', { name: /^delete$/i });
    await fireEvent.click(confirm);

    await waitFor(() => {
      expect(sonnerToast.success).not.toHaveBeenCalledWith('Sample prompt deleted');
    });
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument();
  });

  it('reports success after an inline row edit commits', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    (createUpdateSamplesMutation as any).mockReturnValue(
      writable({ mutateAsync, isPending: false })
    );
    (createSamplesQuery as any).mockReturnValue(
      writable({ data: { samples: mockSamples }, isLoading: false })
    );

    render(SamplingPage);

    const widthInputs = await screen.findAllByLabelText(/width/i);
    await fireEvent.input(widthInputs[0], { target: { value: '640' } });
    await fireEvent.change(widthInputs[0], { target: { value: '640' } });

    await waitFor(() =>
      expect(sonnerToast.success).toHaveBeenCalledWith('Sample prompt updated')
    );
  });

  describe('Visible Feedback (Direct Sonner Toasts)', () => {
    it('triggers sonnerToast.success on sample now success and sonnerToast.error on failure', async () => {
      const sampleMutateAsync = vi.fn();
      vi.mocked(createRequestSampleMutation).mockReturnValue(
        readable({ mutateAsync: sampleMutateAsync, isPending: false }) as any
      );
      vi.mocked(createSamplesQuery).mockReturnValue(
        readable({ data: [], isLoading: false, isError: false }) as any
      );
      vi.mocked(createUpdateSamplesMutation).mockReturnValue(
        readable({ mutateAsync: vi.fn(), isPending: false }) as any
      );

      // Success path
      sampleMutateAsync.mockResolvedValueOnce({});
      render(SamplingPage);

      const sampleNowBtn = screen.getByRole('button', { name: /sample now/i });
      await fireEvent.click(sampleNowBtn);
      expect(sonnerToast.success).toHaveBeenCalledWith('Sample generation requested successfully');

      // Failure path
      sampleMutateAsync.mockRejectedValueOnce(new Error('Sampling failed'));
      await fireEvent.click(sampleNowBtn);
      expect(sonnerToast.error).toHaveBeenCalledWith('Sampling failed');
    });

    it('triggers sonnerToast.success on config file creation success', async () => {
      const createConfigMutateAsync = vi.fn().mockResolvedValue({ filename: 'portrait_samples.json' });
      vi.mocked(createCreateSampleFileMutation).mockReturnValue(
        readable({ mutateAsync: createConfigMutateAsync, isPending: false }) as any
      );
      vi.mocked(createSamplesQuery).mockReturnValue(
        readable({ data: [], isLoading: false, isError: false }) as any
      );
      vi.mocked(createUpdateSamplesMutation).mockReturnValue(
        readable({ mutateAsync: vi.fn(), isPending: false }) as any
      );

      render(SamplingPage);
      await fireEvent.click(screen.getByRole('button', { name: /Add Config/i }));

      const input = screen.getByPlaceholderText(/portrait_samples.json/i);
      await fireEvent.input(input, { target: { value: 'portrait_samples.json' } });
      await fireEvent.click(screen.getByRole('button', { name: /^Create File$/i }));

      expect(sonnerToast.success).toHaveBeenCalledWith('Sample config file created: portrait_samples.json');
    });

    it('triggers sonnerToast.success on prompt clone and sonnerToast.error on clone failure', async () => {
      const mutateAsync = vi.fn();
      vi.mocked(createSamplesQuery).mockReturnValue(
        readable({ data: [mockSamples[0]], isLoading: false, isError: false }) as any
      );
      vi.mocked(createUpdateSamplesMutation).mockReturnValue(
        readable({ mutateAsync, isPending: false }) as any
      );

      render(SamplingPage);

      // Clone success
      mutateAsync.mockResolvedValueOnce({});
      const cloneBtn = screen.getByTitle('Clone sample prompt');
      await fireEvent.click(cloneBtn);
      expect(sonnerToast.success).toHaveBeenCalledWith('Sample prompt cloned');

      // Clone error
      mutateAsync.mockRejectedValueOnce(new Error('Clone error'));
      await fireEvent.click(cloneBtn);
      expect(sonnerToast.error).toHaveBeenCalledWith('Clone error');
    });

    it('triggers sonnerToast.success on sample prompt delete success', async () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(createSamplesQuery).mockReturnValue(
        readable({ data: [mockSamples[0]], isLoading: false, isError: false }) as any
      );
      vi.mocked(createUpdateSamplesMutation).mockReturnValue(
        readable({ mutateAsync, isPending: false }) as any
      );

      render(SamplingPage);

      const deleteBtn = screen.getByTitle('Delete sample prompt');
      await fireEvent.click(deleteBtn);

      const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
      await fireEvent.click(confirmDeleteBtn);

      expect(sonnerToast.success).toHaveBeenCalledWith('Sample prompt deleted');
    });
  });

  describe('Single Responsive Mount and Draft Retention', () => {
    it('mounts only one presentation based on isMobile media query and avoids duplicate input IDs', () => {
      vi.mocked(createSamplesQuery).mockReturnValue(
        readable({ data: [mockSamples[0]], isLoading: false, isError: false }) as any
      );
      vi.mocked(createUpdateSamplesMutation).mockReturnValue(
        readable({ mutateAsync: vi.fn(), isPending: false }) as any
      );

      const { container } = render(SamplingPage);

      // Desktop: table width input exists, card width input does not exist
      expect(container.querySelector('#sample-width-0')).toBeInTheDocument();
      expect(container.querySelector('#card-width-0')).not.toBeInTheDocument();

      // Only 1 width input in DOM
      const widthInputs = container.querySelectorAll('input[id*="width-0"]');
      expect(widthInputs).toHaveLength(1);
    });

    it('retains row draft state when switching breakpoint from desktop to mobile', async () => {
      vi.mocked(createSamplesQuery).mockReturnValue(
        readable({ data: [mockSamples[0]], isLoading: false, isError: false }) as any
      );
      vi.mocked(createUpdateSamplesMutation).mockReturnValue(
        readable({ mutateAsync: vi.fn(), isPending: false }) as any
      );

      const { container, rerender } = render(SamplingPage);

      const desktopWidthInput = container.querySelector('#sample-width-0') as HTMLInputElement;
      expect(desktopWidthInput).toBeInTheDocument();

      // Enter an incomplete draft in desktop width input
      await fireEvent.input(desktopWidthInput, { target: { value: '640' } });

      // Switch breakpoint to mobile
      setMobileBreakpoint(true);
      await rerender({});

      // Mobile: card width input mounted, desktop width input unmounted
      const mobileWidthInput = container.querySelector('#card-width-0') as HTMLInputElement;
      expect(mobileWidthInput).toBeInTheDocument();
      expect(container.querySelector('#sample-width-0')).not.toBeInTheDocument();

      // Draft value '640' is retained in newly mounted mobile card view
      expect(mobileWidthInput.value).toBe('640');
    });
  });
});
