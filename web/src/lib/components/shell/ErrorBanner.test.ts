import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import ErrorBanner from './ErrorBanner.svelte';

it('displays error message and allows dismissal', async () => {
  render(ErrorBanner, { message: 'Network Failure' });

  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByText('Network Failure')).toBeVisible();

  const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
  await fireEvent.click(dismissBtn);

  expect(screen.queryByRole('alert')).toBeNull();
});
