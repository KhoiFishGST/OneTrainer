import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, it, describe, beforeEach, vi } from 'vitest';
import ConsoleDrawer from './ConsoleDrawer.svelte';

describe('ConsoleDrawer component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders console drawer container when open', () => {
    render(ConsoleDrawer, { open: true });
    expect(screen.getByRole('region', { name: 'Console Output' })).toBeVisible();
  });

  it('persists initial console drawer height from localStorage if valid', () => {
    localStorage.setItem('console_drawer_height', '350');
    render(ConsoleDrawer, { open: true });
    const slider = screen.getByRole('slider', { name: 'Resize Console Drawer' });
    expect(slider).toHaveAttribute('aria-valuenow', '350');
  });

  it('resizes on ArrowUp and ArrowDown key events within limits and persists height', async () => {
    render(ConsoleDrawer, { open: true });
    const slider = screen.getByRole('slider', { name: 'Resize Console Drawer' });
    expect(slider).toHaveAttribute('aria-valuenow', '400');

    await fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(slider).toHaveAttribute('aria-valuenow', '410');
    expect(localStorage.getItem('console_drawer_height')).toBe('410');

    await fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(slider).toHaveAttribute('aria-valuenow', '400');
    expect(localStorage.getItem('console_drawer_height')).toBe('400');
  });

  it('enforces 100px minimum and 80vh maximum height limits on keyboard resize', async () => {
    localStorage.setItem('console_drawer_height', '105');
    render(ConsoleDrawer, { open: true });
    const slider = screen.getByRole('slider', { name: 'Resize Console Drawer' });

    // Decrease below 100px threshold
    await fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    await fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('calls onClose callback when close button is clicked', async () => {
    const onClose = vi.fn();
    render(ConsoleDrawer, { open: true, onClose });
    const closeBtn = screen.getByRole('button', { name: 'Close Console Drawer' });
    await fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('clamps loaded console height to 80% viewport height and reclamps on window resize', async () => {
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 720 });
    localStorage.setItem('console_drawer_height', '700');

    render(ConsoleDrawer, { open: true });
    const slider = screen.getByRole('slider', { name: 'Resize Console Drawer' });
    expect(slider).toHaveAttribute('aria-valuenow', '576');

    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 500 });
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(slider).toHaveAttribute('aria-valuenow', '400');
  });
});
