import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import Wrapper from './CompoundsTestWrapper.svelte';

it('renders heading snippets, controlled dialog tabs, alert semantics, and hidden skeleton rows', async () => {
  const onSelect = vi.fn();
  const { container } = render(Wrapper, { onSelect });

  expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  expect(screen.getByText('Page description')).toBeVisible();
  expect(screen.getByText('Ready')).toBeVisible();

  expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
  await fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
  expect(onSelect).toHaveBeenCalledWith('two');

  expect(screen.getByRole('alert')).toHaveTextContent('Persistent failure');
  expect(screen.getByRole('status', { name: 'Loading settings' })).toBeVisible();
  expect(container.querySelectorAll('.skeleton')).toHaveLength(2);
  expect(container.querySelector('.skeleton')).toHaveAttribute('aria-hidden', 'true');
});

it('restarts and clears the toast timer', async () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();

  const result = render(Wrapper, { message: 'First', tone: 'success', duration: 1000, onDismiss });
  await vi.advanceTimersByTimeAsync(600);
  await result.rerender({ message: 'First', tone: 'error', duration: 1000, onDismiss });
  await vi.advanceTimersByTimeAsync(600);
  expect(onDismiss).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(400);
  expect(onDismiss).toHaveBeenCalledOnce();

  result.unmount();
  await vi.runAllTimersAsync();
  expect(onDismiss).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
