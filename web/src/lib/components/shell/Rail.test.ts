import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, describe, beforeEach } from 'vitest';
import Rail from './Rail.svelte';

describe('Rail component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists pinned expansion in webui.railExpanded and enables configuration routes', async () => {
    render(Rail, { currentPath: '/general', mobile: false });
    await fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(localStorage.getItem('webui.railExpanded')).toBe('true');
    expect(screen.getByText('General')).toBeVisible();

    for (const name of ['Model', 'Concepts', 'Training', 'Sampling', 'LoRA', 'Datasets', 'Live']) {
      const link = screen.getByRole('link', { name });
      expect(link).not.toHaveAttribute('aria-disabled');
    }

    expect(screen.queryByRole('link', { name: 'Data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cloud' })).not.toBeInTheDocument();
  });

  it('opens phone navigation as an ephemeral modal drawer without writing to localStorage', async () => {
    render(Rail, { currentPath: '/general', mobile: true });
    await fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    expect(localStorage.getItem('webui.railExpanded')).toBeNull();
  });

  it('places enabled Gallery navigation directly after Live', () => {
    render(Rail, { currentPath: '/live', mobile: false });
    const links = screen.getAllByRole('link');
    const liveIndex = links.findIndex((link) => link.textContent?.includes('Live'));
    expect(links[liveIndex + 1]).toHaveTextContent('Gallery');
    expect(links[liveIndex + 1]).toHaveAttribute('href', '/gallery');
    expect(links[liveIndex + 1]).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('disables unavailable routes such as Tools', () => {
    render(Rail, { currentPath: '/live', mobile: false });
    const toolsLink = screen.getByRole('link', { name: 'Tools' });
    expect(toolsLink).toHaveAttribute('aria-disabled', 'true');
  });

  it('enforces accessible modal mobile navigation behavior (aria-modal, focus trap, Escape, scroll lock, clean state reset)', async () => {
    const { rerender } = render(Rail, { currentPath: '/general', mobile: true });
    const openBtn = screen.getByRole('button', { name: 'Open navigation' });
    openBtn.focus();
    await fireEvent.click(openBtn);

    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Focus an element inside dialog and dispatch Tab key event(s) to verify focus remains trapped inside the open mobile drawer
    const firstLink = screen.getByRole('link', { name: 'Live' });
    firstLink.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await fireEvent.keyDown(firstLink, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await fireEvent.keyDown(document.activeElement || firstLink, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    expect(
      document.body.style.overflow === 'hidden' ||
      document.body.hasAttribute('data-scroll-locked') ||
      document.body.classList.contains('scroll-locked')
    ).toBe(true);

    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openBtn);

    await fireEvent.click(openBtn);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeVisible();

    await rerender({ currentPath: '/general', mobile: false });
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();

    await rerender({ currentPath: '/general', mobile: true });
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });
});
