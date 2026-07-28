import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, describe, beforeEach, vi } from 'vitest';
import StatusBarTestWrapper from './StatusBarTestWrapper.svelte';
import { trainingStore } from '../../events/training-store';
import { api } from '../../api/client';

describe('StatusBar component', () => {
  beforeEach(() => {
    trainingStore.reset();
    vi.restoreAllMocks();
  });

  it('renders training status pill and handles Start Training action when IDLE', async () => {
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

    render(StatusBarTestWrapper, {});

    const startBtn = screen.getByRole('button', { name: 'Start Training' });
    await fireEvent.click(startBtn);

    expect(startSpy).toHaveBeenCalled();
  });

  it('handles Pause, Stop, Sample, and Backup actions when TRAINING', async () => {
    trainingStore.setStatus({
      state: 'TRAINING',
      step: 10,
      max_steps: 100,
      epoch: 1,
      max_epochs: 10,
      speed_its: 1.5,
      elapsed_seconds: 10,
      eta_seconds: 90,
      has_snapshot: true,
    });

    const pauseSpy = vi.spyOn(api, 'pauseTraining').mockResolvedValue({ state: 'PAUSED' } as any);
    const stopSpy = vi.spyOn(api, 'stopTraining').mockResolvedValue({ state: 'STOPPING' } as any);
    const sampleSpy = vi.spyOn(api, 'requestSample').mockResolvedValue(undefined as any);
    const backupSpy = vi.spyOn(api, 'requestBackup').mockResolvedValue(undefined as any);

    render(StatusBarTestWrapper, {});

    await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pauseSpy).toHaveBeenCalled();

    await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(stopSpy).toHaveBeenCalled();

    await fireEvent.click(screen.getByRole('button', { name: 'Sample' }));
    expect(sampleSpy).toHaveBeenCalled();

    await fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
    expect(backupSpy).toHaveBeenCalled();
  });

  it('handles Resume action when PAUSED', async () => {
    trainingStore.setStatus({
      state: 'PAUSED',
      step: 20,
      max_steps: 100,
      epoch: 2,
      max_epochs: 10,
      speed_its: 0,
      elapsed_seconds: 20,
      eta_seconds: 80,
      has_snapshot: true,
    });

    const resumeSpy = vi.spyOn(api, 'resumeTraining').mockResolvedValue({ state: 'TRAINING' } as any);

    render(StatusBarTestWrapper, {});

    await fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(resumeSpy).toHaveBeenCalled();
  });

  it('disables Stop button when STOPPING', () => {
    trainingStore.setStatus({
      state: 'STOPPING',
      step: 30,
      max_steps: 100,
      epoch: 3,
      max_epochs: 10,
      speed_its: 0,
      elapsed_seconds: 30,
      eta_seconds: 0,
      has_snapshot: true,
    });

    render(StatusBarTestWrapper, {});

    const stopBtn = screen.getByRole('button', { name: 'Stop' });
    expect(stopBtn).toBeDisabled();
  });
});
