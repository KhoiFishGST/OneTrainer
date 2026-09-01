import { beforeEach, describe, expect, it, vi } from 'vitest';

function setSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('appearance store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-motion');
    setSystemDark(true);
    vi.resetModules();
  });

  it('defaults to system with animations on, matching the server default', async () => {
    const { appearance } = await import('./appearance.svelte');
    expect(appearance.theme).toBe('system');
    expect(appearance.animations).toBe(true);
  });

  it('resolves the default through the OS rather than assuming dark', async () => {
    setSystemDark(false);
    const { appearance } = await import('./appearance.svelte');
    expect(appearance.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies a theme change to the document and the cache immediately', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('webui.theme')).toBe('light');
  });

  it('resolves system through the OS preference', async () => {
    setSystemDark(false);
    const { appearance } = await import('./appearance.svelte');
    appearance.setTheme('system');
    expect(appearance.theme).toBe('system');
    expect(appearance.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets data-motion=off and caches it when animations are disabled', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.setAnimations(false);
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
    expect(localStorage.getItem('webui.animations')).toBe('false');
  });

  it('removes data-motion when animations are re-enabled', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.setAnimations(false);
    appearance.setAnimations(true);
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);
  });

  it('toggling from system leaves system and picks the opposite explicit theme', async () => {
    setSystemDark(true);
    const { appearance } = await import('./appearance.svelte');
    appearance.setTheme('system');
    expect(appearance.resolvedTheme).toBe('dark');
    appearance.toggleTheme();
    expect(appearance.theme).toBe('light');
  });

  it('notifies onChange with only the field that changed', async () => {
    const { appearance } = await import('./appearance.svelte');
    const seen: unknown[] = [];
    appearance.onChange = (update) => seen.push(update);
    appearance.setTheme('light');
    appearance.setAnimations(false);
    expect(seen).toEqual([{ theme: 'light' }, { animations: false }]);
  });

  it('reconciles from the server and rewrites the cache', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.acceptRemote({ theme: 'light', animations: false });
    expect(appearance.theme).toBe('light');
    expect(appearance.animations).toBe(false);
    expect(localStorage.getItem('webui.theme')).toBe('light');
    expect(localStorage.getItem('webui.animations')).toBe('false');
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
  });

  it('does not fire onChange when reconciling from the server', async () => {
    const { appearance } = await import('./appearance.svelte');
    const seen: unknown[] = [];
    appearance.onChange = (update) => seen.push(update);
    appearance.acceptRemote({ theme: 'light', animations: false });
    expect(seen).toEqual([]);
  });
});
