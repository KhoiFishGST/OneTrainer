import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ThemeToggle from './ThemeToggle.svelte';
import { mode, setMode } from 'mode-watcher';

vi.mock('mode-watcher', () => {
  let currentMode: 'dark' | 'light' = 'dark';
  return {
    mode: {
      get current() {
        return currentMode;
      },
    },
    setMode: vi.fn((newMode: 'dark' | 'light') => {
      currentMode = newMode;
    }),
    toggleMode: vi.fn(),
  };
});

describe('ThemeToggle', () => {
  it('renders theme toggle button with accessible label "Switch to light theme" when dark', () => {
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(btn).toBeInTheDocument();
  });

  it('toggles mode when clicked', async () => {
    render(ThemeToggle);
    const btn = screen.getByRole('button', { name: 'Switch to light theme' });
    await fireEvent.click(btn);
    expect(setMode).toHaveBeenCalledWith('light');
  });
});
