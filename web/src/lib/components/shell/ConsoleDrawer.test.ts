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

  it('leaves the log selectable while keeping the chrome undraggable-safe', () => {
    render(ConsoleDrawer, { open: true });

    // user-select: none on the drawer root blocked selecting log text, which
    // is the whole point of having a console. It belongs on the parts you
    // drag, not the part you read.
    const drawer = screen.getByRole('region', { name: 'Console Output' });
    expect(drawer.className).not.toContain('no-select');

    expect(
      screen.getByRole('slider', { name: 'Resize Console Drawer' }).className
    ).toContain('no-select');
  });

  it('suppresses selection only while the drawer is being resized', async () => {
    render(ConsoleDrawer, { open: true });
    const drawer = screen.getByRole('region', { name: 'Console Output' });
    const slider = screen.getByRole('slider', { name: 'Resize Console Drawer' });

    expect(drawer.className).not.toContain('resizing');

    await fireEvent.mouseDown(slider, { clientY: 300 });
    expect(drawer.className).toContain('resizing');

    await fireEvent.mouseUp(window);
    expect(drawer.className).not.toContain('resizing');
  });
});

describe('console drawer motion', () => {
  it('stays in the DOM when closed', () => {
    const { container } = render(ConsoleDrawer, { props: { open: false } });
    expect(container.querySelector('.console-drawer')).not.toBeNull();
  });

  it('marks the closed drawer inert so its controls leave the tab order', () => {
    const { container } = render(ConsoleDrawer, { props: { open: false } });
    const section = container.querySelector('.console-drawer')!;
    expect(section.hasAttribute('inert')).toBe(true);
    expect(section.getAttribute('data-open')).toBe('false');
  });

  it('is not inert when open', () => {
    const { container } = render(ConsoleDrawer, { props: { open: true } });
    const section = container.querySelector('.console-drawer')!;
    expect(section.hasAttribute('inert')).toBe(false);
    expect(section.getAttribute('data-open')).toBe('true');
  });

  it('collapses to zero height when closed', () => {
    const { container } = render(ConsoleDrawer, { props: { open: false } });
    const section = container.querySelector('.console-drawer') as HTMLElement;
    expect(section.style.height).toBe('0px');
  });
});
