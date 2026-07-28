import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const cssFromFile = fs.readFileSync(path.resolve(__dirname, '../../app.css'), 'utf-8');

const cssSource = import.meta.glob('/src/app.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_CSS = cssFromFile || Object.values(cssSource)[0];

function blockFor(selector: string): string {
  const start = APP_CSS.indexOf(selector + ' {');
  if (start === -1) throw new Error(`No ${selector} block in app.css`);
  const end = APP_CSS.indexOf('\n}', start);
  return APP_CSS.slice(start, end);
}

function readToken(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`));
  if (!match) throw new Error(`Token --${name} is not defined as a hex value`);
  return match[1];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const full = hex.length === 4
    ? '#' + [...hex.slice(1)].map((c) => c + c).join('')
    : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = ['success', 'warning', 'info', 'destructive'];
const THEMES = [':root', '.dark'];

describe('semantic status tokens', () => {
  for (const theme of THEMES) {
    for (const name of PAIRS) {
      // Tinted usage: text is --X on the pale/dark --X-surface.
      it(`${name} reaches AA on its own surface in ${theme}`, () => {
        const block = blockFor(theme);
        expect(
          contrastRatio(readToken(block, name), readToken(block, `${name}-surface`))
        ).toBeGreaterThanOrEqual(4.5);
      });

      // Solid usage: text is --X-foreground on a solid --X fill.
      it(`${name}-foreground reaches AA on solid ${name} in ${theme}`, () => {
        const block = blockFor(theme);
        expect(
          contrastRatio(readToken(block, `${name}-foreground`), readToken(block, name))
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('registers every status token in the @theme inline block', () => {
    const theme = blockFor('@theme inline');
    for (const name of PAIRS) {
      expect(theme).toContain(`--color-${name}-surface: var(--${name}-surface);`);
      expect(theme).toContain(`--color-${name}-foreground: var(--${name}-foreground);`);
    }
  });
});
