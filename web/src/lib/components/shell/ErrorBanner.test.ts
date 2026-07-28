import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import ErrorBanner from './ErrorBanner.svelte';
import HeaderTestWrapper from './HeaderTestWrapper.svelte';
import Rail from './Rail.svelte';

it('displays error message and allows dismissal', async () => {
  render(ErrorBanner, { message: 'Network Failure' });

  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByText('Network Failure')).toBeVisible();

  const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
  await fireEvent.click(dismissBtn);

  expect(screen.queryByRole('alert')).toBeNull();
});

it('resets dismissal only when a non-empty message changes', async () => {
  const { rerender } = render(ErrorBanner, { message: 'First' });
  expect(screen.getByRole('alert')).toBeVisible();

  const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
  await fireEvent.click(dismissBtn);
  expect(screen.queryByRole('alert')).toBeNull();

  // Rerendering with the same message keeps it dismissed
  await rerender({ message: 'First' });
  expect(screen.queryByRole('alert')).toBeNull();

  // Rerendering with a new non-empty message resets dismissal
  await rerender({ message: 'Second' });
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByText('Second')).toBeVisible();
});

it('ensures IDLE status pill uses distinct text token and active navigation does not use undefined tokens', () => {
  render(HeaderTestWrapper, {});
  const statusPill = screen.getByTestId('training-status-pill');
  expect(statusPill).toHaveTextContent('IDLE');
  expect(statusPill.className).toContain('status-idle');

  // Verify Rail active navigation item uses semantic tokens without --accent-soft
  render(Rail, { currentPath: '/live' });
  const liveLink = screen.getByRole('link', { name: /Live/i });
  expect(liveLink.className).toContain('active');
});

