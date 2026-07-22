import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import ConsoleDrawer from './ConsoleDrawer.svelte';

it('renders console drawer container', () => {
  render(ConsoleDrawer, { open: true });
  expect(screen.getByRole('region', { name: 'Console Output' })).toBeVisible();
});
