import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import StatusBarTestWrapper from './StatusBarTestWrapper.svelte';
import { trainingStore } from '../../events/training-store';
import { api } from '../../api/client';

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

  render(StatusBarTestWrapper, {});

  const startBtn = screen.getByRole('button', { name: 'Start Training' });
  await fireEvent.click(startBtn);

  expect(startSpy).toHaveBeenCalled();
  startSpy.mockRestore();
});
