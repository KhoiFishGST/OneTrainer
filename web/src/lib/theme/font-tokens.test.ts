import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP_CSS = fs.readFileSync(path.resolve(__dirname, '../../app.css'), 'utf-8');

function blockFor(selector: string): string {
  const start = APP_CSS.indexOf(selector + ' {');
  if (start === -1) throw new Error(`No ${selector} block in app.css`);
  const end = APP_CSS.indexOf('\n}', start);
  return APP_CSS.slice(start, end);
}

function stackFor(name: string): string {
  const match = blockFor(':root').match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Token --${name} is not defined in :root`);
  return match[1].trim();
}

const ROLES = [
  { token: 'brand-font', theme: 'font-brand', face: "'Bricolage Grotesque'" },
  { token: 'display-font', theme: 'font-display', face: "'Outfit'" },
  { token: 'body-font', theme: 'font-sans', face: "'Inter'" },
  { token: 'mono-font', theme: 'font-mono', face: "'JetBrains Mono'" },
];

describe('font tokens', () => {
  for (const role of ROLES) {
    it(`--${role.token} leads with ${role.face}`, () => {
      expect(stackFor(role.token)).toContain(role.face);
    });

    // The whole design rests on this: if the build-time fetch failed, every
    // stack has to land on something the OS already has.
    it(`--${role.token} ends in a system font`, () => {
      expect(stackFor(role.token)).toMatch(/(sans-serif|monospace)$/);
    });

    it(`--${role.token} is registered as --${role.theme} in @theme inline`, () => {
      expect(blockFor('@theme inline')).toContain(
        `--${role.theme}: var(--${role.token});`
      );
    });
  }

  it('no longer hardcodes a font family anywhere', () => {
    // Both :root and body used to name Inter directly, which is why the app
    // claimed Inter and silently rendered system-ui.
    expect(APP_CSS).not.toContain('font-family: Inter');
  });
});
