import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import ThemeToggle from './ThemeToggle.svelte';
import { theme } from '$lib/stores/theme.svelte';

describe('ThemeToggle', () => {
  beforeEach(() => {
    theme.set('dark');
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
    expect(theme.value).toBe('light');
  });
});
