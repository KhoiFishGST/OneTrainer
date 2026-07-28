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
});
