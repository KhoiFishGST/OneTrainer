import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relative: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf-8');
}

describe('font application', () => {
  it('gives the wordmark the brand face', () => {
    const source = read('lib/components/shell/Header.svelte');

    expect(source).toMatch(/\.app-title\s*\{[^}]*font-family:\s*var\(--brand-font\)/);
  });

  it('gives the page title the display face', () => {
    const source = read('lib/components/layout/PageHeader.svelte');

    expect(source).toMatch(
      /:where\(\.page-title\)\s*\{[^}]*font-family:\s*var\(--display-font\)/
    );
  });

  it('gives every heading the display face', () => {
    const source = read('app.css');

    expect(source).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*font-family:\s*var\(--display-font\)/);
  });

  it('keeps the brand face off everything except the wordmark', () => {
    // Bricolage at weight 800 is a wordmark face. Using it anywhere else is
    // the fastest way to make the UI look like a poster.
    const componentsDir = path.resolve(__dirname, '../components');
    const uses = fs
      .readdirSync(componentsDir, { recursive: true })
      // Normalise separators so this passes on Windows too.
      .map((entry) => String(entry).split(path.sep).join('/'))
      .filter((entry) => entry.endsWith('.svelte'))
      .filter((entry) =>
        fs.readFileSync(path.join(componentsDir, entry), 'utf-8').includes('var(--brand-font)')
      );

    expect(uses).toEqual(['shell/Header.svelte']);
  });
});
