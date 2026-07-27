import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import Wrapper from './CompoundsTestWrapper.svelte';
import tabBarSource from './TabBar.svelte?raw';
import skeletonSource from './Skeleton.svelte?raw';

function stylesFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tabBarSource.match(new RegExp(`${escaped} \\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? '';
}

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

it('preserves page tab wrapping, overflow, and legacy button dimensions', () => {
  const { container } = render(Wrapper);
  const tabBar = container.querySelector('.tab-bar--page');
  const button = screen.getByRole('tab', { name: 'Page One' });

  expect(tabBar).toHaveClass('tab-bar', 'tab-bar--page', 'page-tabs-test');
  expect(button).toHaveClass('tab-bar__button', 'active');

  const barStyles = stylesFor(':where(.tab-bar--page)');
  expect(barStyles).toContain('flex-wrap: wrap;');
  expect(barStyles).toContain('overflow-x: auto;');
  expect(barStyles).toContain('overflow-y: hidden;');
  expect(barStyles).toContain('border-bottom: 1px solid var(--color-border, var(--line, #2d3741));');
  expect(barStyles).toContain('padding: 0 0.25rem;');

  const buttonStyles = stylesFor(':where(.tab-bar--page) :global(:where(.tab-bar__button))');
  expect(buttonStyles).toContain('padding: 0.5rem 0.875rem;');
  expect(buttonStyles).toContain('border: 1px solid transparent;');
  expect(buttonStyles).toContain('border-bottom: none;');
  expect(buttonStyles).toContain('border-top-left-radius: 6px;');
  expect(buttonStyles).toContain('border-top-right-radius: 6px;');
  expect(buttonStyles).toContain('border-bottom-left-radius: 0;');
  expect(buttonStyles).toContain('border-bottom-right-radius: 0;');
  expect(buttonStyles).toContain('font-size: 0.875rem;');
  expect(buttonStyles).toContain('font-weight: 500;');
  expect(buttonStyles).toContain('margin-bottom: -1px;');

  const hoverStyles = stylesFor(':where(.tab-bar--page) :global(:where(.tab-bar__button:hover))');
  expect(hoverStyles).toContain('color: var(--text, #f8fafc);');
  expect(hoverStyles).toContain('background-color: var(--panel-raised, #1d242c);');

  const activeStyles = stylesFor(':where(.tab-bar--page) :global(:where(.tab-bar__button.active))');
  expect(activeStyles).toContain('color: var(--color-text-title, var(--accent, #3b82f6));');
  expect(activeStyles).toContain('background-color: var(--color-bg-card, var(--panel, #181e25));');
  expect(activeStyles).toContain('border-color: var(--color-border, var(--line, #2d3741));');
  expect(activeStyles).toContain('border-bottom-color: var(--color-bg-card, var(--panel, #181e25));');

  expect(tabBarSource).toMatch(/@media \(min-width: 769px\)[\s\S]*?min-height: 0/);
});

it('preserves the distinct dialog tab wrapper and button dimensions', () => {
  const { container } = render(Wrapper);
  const tabBar = container.querySelector('.tab-bar--dialog');
  const button = screen.getByRole('tab', { name: 'One' });

  expect(tabBar).toHaveClass('tab-bar', 'tab-bar--dialog');
  expect(tabBar).not.toHaveClass('tab-bar--page');
  expect(button).toHaveClass('tab-bar__button', 'active');

  const barStyles = stylesFor(':where(.tab-bar--dialog)');
  expect(barStyles).toContain('border-bottom: 1px solid var(--color-border, var(--line, #2d3741));');
  expect(barStyles).toContain('background-color: var(--color-bg-panel, var(--control, #14191f));');
  expect(barStyles).toContain('padding: 0.25rem 0.5rem 0;');
  expect(barStyles).toContain('border-radius: 6px 6px 0 0;');

  const buttonStyles = stylesFor(':where(.tab-bar--dialog) :global(:where(.tab-bar__button))');
  expect(buttonStyles).toContain('padding: 0.5rem 1rem;');
  expect(buttonStyles).toContain('font-size: 0.8125rem;');
  expect(buttonStyles).toContain('font-weight: 500;');
  expect(buttonStyles).toContain('border-radius: 6px 6px 0 0;');

  const hoverStyles = stylesFor(':where(.tab-bar--dialog) :global(:where(.tab-bar__button:hover:not(.active)))');
  expect(hoverStyles).toContain('color: var(--text, #f8fafc);');
  expect(hoverStyles).toContain('background-color: var(--panel-raised, #1d242c);');

  const activeStyles = stylesFor(':where(.tab-bar--dialog) :global(:where(.tab-bar__button.active))');
  expect(activeStyles).toContain('color: var(--color-text-title, var(--accent, #3b82f6));');
  expect(activeStyles).toContain('background-color: var(--color-bg-card, var(--panel, #181e25));');
  expect(activeStyles).toContain('border-color: var(--color-border, var(--line, #2d3741));');
  expect(activeStyles).toContain('border-bottom-color: var(--color-bg-card, var(--panel, #181e25));');
});

it('preserves the light skeleton fallback', () => {
  expect(skeletonSource).toContain('background: var(--color-skeleton, #e5e7eb);');
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
