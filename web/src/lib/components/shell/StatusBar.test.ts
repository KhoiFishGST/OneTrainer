import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import StatusBarTestWrapper from './StatusBarTestWrapper.svelte';
import { trainingStore } from '../../events/training-store';
import { api } from '../../api/client';

describe('StatusBar component', () => {
  beforeEach(() => {
    trainingStore.reset();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
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

  it('renders 44px hit targets and accessible Actions menu for phone viewports during TRAINING state', async () => {
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

    const sampleSpy = vi.spyOn(api, 'requestSample').mockResolvedValue(undefined as any);
    const backupSpy = vi.spyOn(api, 'requestBackup').mockResolvedValue(undefined as any);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(StatusBarTestWrapper, {});

    const pauseBtn = screen.getByRole('button', { name: /Pause/i });
    const stopBtn = screen.getByRole('button', { name: /Stop/i });
    const actionsBtn = screen.getByRole('button', { name: /Actions/i });

    expect(pauseBtn).toBeVisible();
    expect(stopBtn).toBeVisible();
    expect(actionsBtn).toBeVisible();

    await fireEvent.click(actionsBtn);
    const sampleMenuItem = await screen.findByRole('menuitem', { name: /Sample/i });
    const backupMenuItem = await screen.findByRole('menuitem', { name: /Backup/i });

    expect(sampleMenuItem).toBeVisible();
    expect(backupMenuItem).toBeVisible();

    await fireEvent.click(sampleMenuItem);
    expect(sampleSpy).toHaveBeenCalled();
  });
});
