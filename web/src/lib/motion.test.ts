import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION, motionEnabled } from './motion';

const css = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf-8');

/** Reads a token from inside the marker comments, so the kill-switch block's
 *  overrides of the same names cannot be mistaken for the real values. */
function token(name: string): string {
  const block = /\/\* motion-tokens:start \*\/([\s\S]*?)\/\* motion-tokens:end \*\//.exec(css);
  if (!block) throw new Error('motion-tokens marker block not found in app.css');
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(block[1]);
  if (!match) throw new Error(`token --${name} not found in the motion-tokens block`);
  return match[1].trim();
}

describe('motion tokens', () => {
  it('defines the Material-aligned scale in app.css', () => {
    expect(token('motion-duration-enter')).toBe('200ms');
    expect(token('motion-duration-exit')).toBe('150ms');
    expect(token('motion-duration-layout')).toBe('300ms');
    expect(token('motion-ease-enter')).toBe('cubic-bezier(0, 0, 0.2, 1)');
    expect(token('motion-ease-exit')).toBe('cubic-bezier(0.4, 0, 1, 1)');
    expect(token('motion-travel')).toBe('8px');
    expect(token('motion-scale')).toBe('0.98');
  });

  it('keeps motion.ts in sync with app.css', () => {
    expect(`${MOTION.enterMs}ms`).toBe(token('motion-duration-enter'));
    expect(`${MOTION.exitMs}ms`).toBe(token('motion-duration-exit'));
    expect(`${MOTION.layoutMs}ms`).toBe(token('motion-duration-layout'));
    expect(`${MOTION.travelPx}px`).toBe(token('motion-travel'));
  });

  it('zeroes every duration token when motion is off', () => {
    const killSwitch = /html\[data-motion=['"]off['"]\]\s*\{([\s\S]*?)\}/.exec(css);
    expect(killSwitch).not.toBeNull();
    const body = killSwitch![1];
    expect(body).toContain('--motion-duration-enter: 0.01ms');
    expect(body).toContain('--motion-duration-exit: 0.01ms');
    expect(body).toContain('--motion-duration-layout: 0.01ms');
    expect(body).toContain('--motion-travel: 0px');
    expect(body).toContain('--motion-scale: 1');
    // Never `animation: none` — bits-ui needs animationend to fire to unmount.
    expect(body).not.toContain('animation: none');
  });
});

describe('motionEnabled', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-motion');
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it('is true by default', () => {
    expect(motionEnabled()).toBe(true);
  });

  it('is false when the app setting is off', () => {
    document.documentElement.setAttribute('data-motion', 'off');
    expect(motionEnabled()).toBe(false);
  });

  it('is false when the OS requests reduced motion, even with the setting on', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(motionEnabled()).toBe(false);
  });
});

describe('toast motion', () => {
  // Source text only, so this proves the rule was typed, not that it wins the
  // cascade -- sonner's own rule is injected later at the same specificity, so
  // that distinction is the whole point. e2e/motion.spec.ts reads a real
  // toast's computed transition-duration; this keeps the selector honest.
  it('brings sonner durations under the token block, scoped to beat sonner', () => {
    const cssText = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf-8');
    expect(cssText).toContain('[data-sonner-toaster] [data-sonner-toast]');
    expect(cssText).toMatch(
      /\[data-sonner-toaster\] \[data-sonner-toast\][\s\S]{0,200}--motion-duration-enter/
    );
  });
});
