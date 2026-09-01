import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'src/app.html'), 'utf-8');

function prepaintScript(): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error('no inline script found in app.html');
  return match[1];
}

function runPrepaint() {
  // eslint-disable-next-line no-new-func
  new Function(prepaintScript())();
}

function setSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('pre-paint appearance script', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.style.colorScheme = '';
    setSystemDark(true);
  });

  it('defaults to the OS preference, matching the server default of system', () => {
    // Anything else would paint one theme and then flip to the other when
    // the appearance query resolves -- the flash this script prevents.
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);

    setSystemDark(false);
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('applies an explicit light choice', () => {
    localStorage.setItem('webui.theme', 'light');
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('resolves system to the OS preference', () => {
    localStorage.setItem('webui.theme', 'system');
    setSystemDark(false);
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    setSystemDark(true);
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sets data-motion=off when animations are disabled', () => {
    localStorage.setItem('webui.animations', 'false');
    runPrepaint();
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
  });

  it('never throws, because a throw here blanks the page', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('storage disabled');
      },
    });
    expect(() => runPrepaint()).not.toThrow();
  });
});
