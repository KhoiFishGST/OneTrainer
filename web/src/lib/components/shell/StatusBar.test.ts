import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import StatusBarTestWrapper from './StatusBarTestWrapper.svelte';

it('renders connection state and status bar controls', () => {
  render(StatusBarTestWrapper, { connected: true });

  expect(screen.getByText('Connected')).toBeVisible();
});
