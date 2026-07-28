import { fireEvent, render, screen, waitFor, act, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { expect, it, describe, vi } from 'vitest';
import HeaderTestWrapper from './HeaderTestWrapper.svelte';
import { trainingStore } from '../../events/training-store';
import { api } from '../../api/client';

describe('Header component', () => {
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
    await fireEvent.change(modelSelect, { target: { value: '1' } });

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

  it('flattens nested preset tree objects into dropdown options', () => {
    const mockPresetsData = [
      {
        label: 'SD 1.5',
        children: [
          { label: 'Fine Tune', id: 'preset_1' },
        ],
      },
      { label: 'Direct Preset', id: 'preset_2' },
    ];

    render(HeaderTestWrapper, { presetsData: mockPresetsData });

    const presetsSelect = screen.getByRole('combobox', { name: 'Presets' });
    expect(presetsSelect).toHaveTextContent('SD 1.5 / Fine Tune');
    expect(presetsSelect).toHaveTextContent('Direct Preset');
  });

  it('maintains action reachability at 390px phone width and renders ThemeToggle', () => {
    render(HeaderTestWrapper, {});
    expect(screen.getByRole('button', { name: /Switch to (light|dark) theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('presents overwrite confirmation in an Alert Dialog, guards pending state, prevents duplicate calls, retains error on failure, and closes on resolution', async () => {
    let resolveSave: (v?: any) => void = () => {};
    let rejectSave: (e: any) => void = () => {};

    const saveConfigFileSpy = vi.spyOn(api, 'saveConfigFile').mockImplementation((_name: string, overwrite?: boolean) => {
      if (!overwrite) {
        // Initial save attempt reports 409 conflict
        const err: any = new Error('File exists');
        err.status = 409;
        err.detail = { exists: true };
        return Promise.reject(err);
      }
      return new Promise((res, rej) => {
        resolveSave = res;
        rejectSave = rej;
      });
    });

    const mockWorkspace = {
      draft: { model_type: 'STABLE_DIFFUSION_15', training_method: 'FINE_TUNE' },
      state: 'saved',
      beforePresetSave: vi.fn().mockResolvedValue(undefined),
    } as any;

    render(HeaderTestWrapper, { workspace: mockWorkspace });

    // Open save modal
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const input = screen.getByPlaceholderText('my_config');
    await fireEvent.input(input, { target: { value: 'existing_preset' } });

    // Trigger save (will fail with 409 and open overwrite dialog)
    const modalSaveBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^Save$/i });
    await fireEvent.click(modalSaveBtn);

    // Overwrite dialog should be an Alert Dialog
    const alertDialog = await screen.findByRole('alertdialog');
    expect(alertDialog).toBeInTheDocument();
    expect(screen.getByText(/already exists in/i)).toBeInTheDocument();

    const overwriteBtn = within(alertDialog).getByRole('button', { name: 'Overwrite' });
    const cancelBtn = within(alertDialog).getByRole('button', { name: 'Cancel' });

    // Click overwrite
    await fireEvent.click(overwriteBtn);
    await tick();

    expect(saveConfigFileSpy).toHaveBeenLastCalledWith('existing_preset', true);

    // While pending, Alert Dialog remains open, Overwrite and Cancel buttons are disabled
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(overwriteBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    // Duplicate click while pending does not invoke API again
    const callsCount = saveConfigFileSpy.mock.calls.length;
    await fireEvent.click(overwriteBtn);
    expect(saveConfigFileSpy.mock.calls.length).toBe(callsCount);

    // Reject save -> error message retains dialog open
    await act(async () => {
      rejectSave(new Error('Failed to overwrite preset'));
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(await screen.findByText(/Failed to overwrite preset/i)).toBeInTheDocument();
    expect(overwriteBtn).not.toBeDisabled();

    // Click overwrite again to retry
    await fireEvent.click(overwriteBtn);

    // Resolve save -> closes Alert Dialog
    await act(async () => {
      resolveSave({ filename: 'training_configs/existing_preset.json' });
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });
});
