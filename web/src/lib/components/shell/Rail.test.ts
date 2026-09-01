import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, describe, beforeEach } from 'vitest';
import Rail from './Rail.svelte';
import RailTestWrapper from './RailTestWrapper.svelte';

describe('Rail component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists pinned expansion in webui.railExpanded and enables configuration routes', async () => {
    render(Rail, { currentPath: '/general' });
    await fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
    expect(localStorage.getItem('webui.railExpanded')).toBe('true');
    expect(screen.getAllByText('General').length).toBeGreaterThan(0);

    for (const name of ['Model', 'Concepts', 'Training', 'Sampling', 'LoRA', 'Datasets', 'Live']) {
      const links = screen.getAllByRole('link', { name });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]).not.toHaveAttribute('aria-disabled');
    }

    expect(screen.queryByRole('link', { name: 'Data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cloud' })).not.toBeInTheDocument();
  });

  it('opens phone navigation as an ephemeral modal drawer without writing to localStorage', async () => {
    render(RailTestWrapper, { currentPath: '/general' });
    await fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(localStorage.getItem('webui.railExpanded')).toBeNull();
  });

  it('places enabled Gallery navigation directly after Live', () => {
    render(Rail, { currentPath: '/live' });
    const links = screen.getAllByRole('link');
    const liveIndex = links.findIndex((link) => link.textContent?.includes('Live'));
    expect(links[liveIndex + 1]).toHaveTextContent('Gallery');
    expect(links[liveIndex + 1]).toHaveAttribute('href', '/gallery');
    expect(links[liveIndex + 1]).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('disables unavailable routes such as Tools', () => {
    render(Rail, { currentPath: '/live' });
    const toolsLinks = screen.getAllByRole('link', { name: 'Tools' });
    toolsLinks.forEach((link) => {
      expect(link).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('enforces accessible modal mobile navigation behavior (aria-modal, focus trap, Escape, scroll lock, clean state reset)', async () => {
    render(RailTestWrapper, { currentPath: '/general' });
    const openBtn = screen.getByRole('button', { name: 'Open navigation' });
    openBtn.focus();
    await fireEvent.click(openBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Focus an element inside dialog and dispatch Tab key event(s) to verify focus remains trapped inside the open mobile drawer
    const firstLink = screen.getAllByRole('link', { name: 'Live' })[0];
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(openBtn);

    await fireEvent.click(openBtn);
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
