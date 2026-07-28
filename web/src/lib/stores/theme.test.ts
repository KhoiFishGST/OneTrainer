import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    vi.resetModules();
  });

  it('defaults to dark and applies the root class', async () => {
    const { theme } = await import('./theme.svelte');
    expect(theme.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists and applies an explicit light choice', async () => {
    const { theme } = await import('./theme.svelte');
    theme.set('light');
    expect(localStorage.getItem('webui.theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('ignores an invalid stored choice', async () => {
    localStorage.setItem('webui.theme', 'system');
    const { theme } = await import('./theme.svelte');
    expect(theme.value).toBe('dark');
  });

  it('toggles between dark and light themes', async () => {
    const { theme } = await import('./theme.svelte');
    expect(theme.value).toBe('dark');
    theme.toggle();
    expect(theme.value).toBe('light');
    expect(localStorage.getItem('webui.theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    theme.toggle();
    expect(theme.value).toBe('dark');
    expect(localStorage.getItem('webui.theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
