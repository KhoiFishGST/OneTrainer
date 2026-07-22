import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import ConsoleDrawer from './ConsoleDrawer.svelte';

it('renders console drawer container', () => {
  render(ConsoleDrawer, { open: true });
  expect(screen.getByRole('region', { name: 'Console Output' })).toBeVisible();
});

it('resizes on ArrowUp and ArrowDown key events', async () => {
  render(ConsoleDrawer, { open: true });
  const slider = screen.getByRole('slider', { name: 'Resize Console Drawer' });
  expect(slider).toHaveAttribute('aria-valuenow', '200');

  await fireEvent.keyDown(slider, { key: 'ArrowUp' });
  expect(slider).toHaveAttribute('aria-valuenow', '210');

  await fireEvent.keyDown(slider, { key: 'ArrowDown' });
  expect(slider).toHaveAttribute('aria-valuenow', '200');
});
