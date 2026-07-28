import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import ErrorBanner from './ErrorBanner.svelte';
import HeaderTestWrapper from './HeaderTestWrapper.svelte';
import Rail from './Rail.svelte';
import headerRaw from './Header.svelte?raw';
import railContentRaw from './RailContent.svelte?raw';

it('displays error message and allows dismissal', async () => {
  render(ErrorBanner, { message: 'Network Failure' });

  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByText('Network Failure')).toBeVisible();

  const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
  await fireEvent.click(dismissBtn);

  expect(screen.queryByRole('alert')).toBeNull();
});

it('resets dismissal when a non-empty message changes or is cleared and re-emitted', async () => {
  const { rerender } = render(ErrorBanner, { message: 'First' });
  expect(screen.getByRole('alert')).toBeVisible();

  const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
  await fireEvent.click(dismissBtn);
  expect(screen.queryByRole('alert')).toBeNull();

  // Rerendering with the same message without clearing keeps it dismissed
  await rerender({ message: 'First' });
  expect(screen.queryByRole('alert')).toBeNull();

  // Clearing message then re-emitting the same message resets dismissal
  await rerender({ message: '' });
  expect(screen.queryByRole('alert')).toBeNull();

  await rerender({ message: 'First' });
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByText('First')).toBeVisible();

  // Rerendering with a new non-empty message resets dismissal
  await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByRole('alert')).toBeNull();

  await rerender({ message: 'Second' });
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByText('Second')).toBeVisible();
});

it('ensures IDLE status pill uses distinct text token and active navigation uses semantic tokens', () => {
  render(HeaderTestWrapper, {});
  const statusPill = screen.getByTestId('training-status-pill');
  expect(statusPill).toHaveTextContent('IDLE');
  expect(statusPill.className).toContain('status-idle');

  // Verify Rail active navigation item uses semantic tokens
  render(Rail, { currentPath: '/live' });
  const liveLink = screen.getByRole('link', { name: /Live/i });
  expect(liveLink.className).toContain('active');

  // Inspect component style declarations to verify CSS tokens
  // IDLE status text uses --muted-foreground
  expect(headerRaw).toMatch(/\.status-idle[\s\S]*?color:\s*var\(--muted-foreground/);

  // Active navigation uses --accent and --accent-foreground
  expect(railContentRaw).toMatch(/\.nav-item\.active[\s\S]*?background-color:\s*var\(--accent\)/);
  expect(railContentRaw).toMatch(/\.nav-item\.active[\s\S]*?color:\s*var\(--accent-foreground\)/);
});
