import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import HeaderTestWrapper from './HeaderTestWrapper.svelte';
import { trainingStore } from '../../events/training-store';
import { api } from '../../api/client';


it('coerces training_method to first supported when new model_type does not support current training_method', async () => {
  const setRawCalls: [string, any][] = [];
  const mockWorkspace = {
    draft: {
      model_type: 'STABLE_DIFFUSION_15',
      training_method: 'TEXTUAL_INVERSION',
    },
    setRaw: (path: string, val: any) => {
      setRawCalls.push([path, val]);
      (mockWorkspace.draft as any)[path] = val;
    },
    state: 'saved',
    revision: 'rev-1',
  } as any;

  const mockMeta = {
    version: '1.0',
    model_types: [
      {
        value: 'STABLE_DIFFUSION_15',
        label: 'SD 1.5',
        training_methods: [
          { value: 'FINE_TUNE', label: 'Fine Tune' },
          { value: 'TEXTUAL_INVERSION', label: 'Textual Inversion' },
        ],
      },
      {
        value: 'FLUX_1',
        label: 'Flux 1',
        training_methods: [
          { value: 'FINE_TUNE', label: 'Fine Tune' },
          { value: 'LORA', label: 'LoRA' },
        ],
      },
    ],
  };

  render(HeaderTestWrapper, {
    workspace: mockWorkspace,
    metaData: mockMeta,
  });

  const modelSelect = screen.getByRole('combobox', { name: 'Model Type' });
  await fireEvent.change(modelSelect, { target: { value: 'FLUX_1' } });

  // Verify training_method was coerced to FINE_TUNE (first supported method for FLUX_1)
  expect(setRawCalls).toEqual([
    ['training_method', 'FINE_TUNE'],
    ['model_type', 'FLUX_1'],
  ]);
});

it('calls beforePresetSave when saving preset', async () => {
  const beforePresetSaveSpy = vi.fn().mockResolvedValue(undefined);
  const mockWorkspace = {
    draft: {
      model_type: 'STABLE_DIFFUSION_15',
      training_method: 'FINE_TUNE',
    },
    state: 'saved',
    beforePresetSave: beforePresetSaveSpy,
  } as any;

  render(HeaderTestWrapper, {
    workspace: mockWorkspace,
  });

  const savePresetBtn = screen.getByRole('button', { name: 'Save' });
  await fireEvent.click(savePresetBtn);

  expect(beforePresetSaveSpy).toHaveBeenCalled();
});

it('renders saved icon badge when workspace state is saved, hides during unsaved, and renders retry button on failure', () => {
  const savedWorkspace = { state: 'saved' } as any;
  const { rerender } = render(HeaderTestWrapper, { workspace: savedWorkspace });

  expect(screen.getByTestId('saved-icon-badge')).toBeInTheDocument();
  expect(screen.queryByText('Saved')).not.toBeInTheDocument();

  const unsavedWorkspace = { state: 'unsaved' } as any;
  rerender({ workspace: unsavedWorkspace });

  expect(screen.queryByTestId('saved-icon-badge')).not.toBeInTheDocument();
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();

  const failedWorkspace = { state: 'failed', retry: vi.fn() } as any;
  rerender({ workspace: failedWorkspace });

  expect(screen.getByText('Save Failed')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});
it('triggers save when pressing Enter in the save config input modal', async () => {
  const saveConfigFileSpy = vi.spyOn(api, 'saveConfigFile').mockResolvedValue({ filename: 'training_configs/my_enter_config.json' });
  const beforePresetSaveSpy = vi.fn().mockResolvedValue(undefined);
  const mockWorkspace = {
    draft: { model_type: 'STABLE_DIFFUSION_15', training_method: 'FINE_TUNE' },
    state: 'saved',
    beforePresetSave: beforePresetSaveSpy,
  } as any;

  render(HeaderTestWrapper, { workspace: mockWorkspace });

  const saveBtn = screen.getByRole('button', { name: 'Save' });
  await fireEvent.click(saveBtn);

  const input = screen.getByPlaceholderText('my_config');
  await fireEvent.input(input, { target: { value: 'my_enter_config' } });
  await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

  expect(saveConfigFileSpy).toHaveBeenCalledWith('my_enter_config', false);
});
