import { describe, expect, it } from 'vitest';

const svelteSources = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Modules that render before first paint, mapped to the heavy overlay
 * dependencies they must not pull in statically. Every entry here was measured
 * as sitting in the root-layout chunk graph; a static import puts it on the
 * critical path even though the user may never open the overlay.
 */
export const CRITICAL_PATH_MODULES: Record<string, string[]> = {
  '/src/lib/components/LayoutContent.svelte': [
    './shell/ConsoleDrawer.svelte',
    './directory/DirectoryPicker.svelte',
  ],
};

/**
 * Returns the specifiers of static `import ... from '...'` statements only.
 * A dynamic `import('...')` starts with `import(`, so it is skipped.
 */
export function findStaticImports(source: string): string[] {
  const specifiers: string[] = [];
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!/^import\s/.test(trimmed)) continue;
    const match = trimmed.match(/['"]([^'"]+)['"]/);
    if (match) specifiers.push(match[1]);
  }
  return specifiers;
}

describe('critical path boundary', () => {
  it('detects a static component import', () => {
    expect(findStaticImports("import Drawer from './shell/ConsoleDrawer.svelte';")).toEqual([
      './shell/ConsoleDrawer.svelte',
    ]);
  });

  it('ignores dynamic imports and type-position imports', () => {
    expect(findStaticImports("const m = import('./shell/ConsoleDrawer.svelte');")).toEqual([]);
    expect(
      findStaticImports("let C = $state<typeof import('./shell/ConsoleDrawer.svelte').default | null>(null);")
    ).toEqual([]);
  });

  it('keeps heavy overlays off the first-paint graph', () => {
    const violations = Object.entries(CRITICAL_PATH_MODULES).flatMap(([file, forbidden]) => {
      const source = svelteSources[file];
      if (source === undefined) return [`${file}: not found — did the file move?`];
      const imported = findStaticImports(source);
      return forbidden
        .filter((specifier) => imported.includes(specifier))
        .map((specifier) => `${file}: statically imports ${specifier}; use a dynamic import()`);
    });
    expect(violations).toEqual([]);
  });
});
