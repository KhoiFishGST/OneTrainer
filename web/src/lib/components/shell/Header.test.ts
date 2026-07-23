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

  const savePresetBtn = screen.getByRole('button', { name: 'Save Preset' });
  await fireEvent.click(savePresetBtn);

  expect(beforePresetSaveSpy).toHaveBeenCalled();
});

it('renders training status pill and handles Start Training action', async () => {
  trainingStore.reset();
  const startSpy = vi.spyOn(api, 'startTraining').mockResolvedValue({
    state: 'STARTING',
    step: 0,
    max_steps: 100,
    epoch: 0,
    max_epochs: 10,
    speed_its: 0,
    elapsed_seconds: 0,
    eta_seconds: 0,
    has_snapshot: false,
  });

  render(HeaderTestWrapper, {});

  const statusPill = screen.getByTestId('training-status-pill');
  expect(statusPill).toHaveTextContent('IDLE');

  const startBtn = screen.getByRole('button', { name: 'Start Training' });
  await fireEvent.click(startBtn);

  expect(startSpy).toHaveBeenCalled();
  startSpy.mockRestore();
});

it('renders action controls and handles Pause, Stop, Sample, Backup when TRAINING', async () => {
  trainingStore.setStatus({ state: 'TRAINING' });

  const pauseSpy = vi.spyOn(api, 'pauseTraining').mockResolvedValue({} as any);
  const stopSpy = vi.spyOn(api, 'stopTraining').mockResolvedValue({} as any);
  const sampleSpy = vi.spyOn(api, 'requestSample').mockResolvedValue({} as any);
  const backupSpy = vi.spyOn(api, 'requestBackup').mockResolvedValue({} as any);

  render(HeaderTestWrapper, {});

  expect(screen.getByTestId('training-status-pill')).toHaveTextContent('TRAINING');

  const pauseBtn = screen.getByRole('button', { name: 'Pause' });
  const stopBtn = screen.getByRole('button', { name: 'Stop' });
  const sampleBtn = screen.getByRole('button', { name: 'Sample' });
  const backupBtn = screen.getByRole('button', { name: 'Backup' });

  await fireEvent.click(pauseBtn);
  expect(pauseSpy).toHaveBeenCalled();

  await fireEvent.click(stopBtn);
  expect(stopSpy).toHaveBeenCalled();

  await fireEvent.click(sampleBtn);
  expect(sampleSpy).toHaveBeenCalled();

  await fireEvent.click(backupBtn);
  expect(backupSpy).toHaveBeenCalled();

  pauseSpy.mockRestore();
  stopSpy.mockRestore();
  sampleSpy.mockRestore();
  backupSpy.mockRestore();
});

it('renders Resume button when PAUSED and handles resume action', async () => {
  trainingStore.setStatus({ state: 'PAUSED' });

  const resumeSpy = vi.spyOn(api, 'resumeTraining').mockResolvedValue({} as any);

  render(HeaderTestWrapper, {});

  expect(screen.getByTestId('training-status-pill')).toHaveTextContent('PAUSED');

  const resumeBtn = screen.getByRole('button', { name: 'Resume' });
  await fireEvent.click(resumeBtn);
  expect(resumeSpy).toHaveBeenCalled();

  resumeSpy.mockRestore();
});

