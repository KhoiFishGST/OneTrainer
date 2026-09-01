import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import ThemeToggle from './ThemeToggle.svelte';
import { appearance } from '$lib/stores/appearance.svelte';

describe('ThemeToggle', () => {
  beforeEach(() => {
    appearance.setTheme('dark');
  });

  it('renders theme toggle button with accessible label "Switch to light theme" when dark', () => {
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(btn).toBeInTheDocument();
  });

  it('toggles mode when clicked', async () => {
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: 'Switch to light theme' });
    await fireEvent.click(btn);
    expect(appearance.theme).toBe('light');
  });
});
