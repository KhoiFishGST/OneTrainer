import { describe, expect, it } from 'vitest';

const svelteSources = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The one place a :global() escape hatch is legitimate: ANSI spans the
 *  console renderer emits, which the application never authors. */
const ANSI_BOUNDARY = '/src/lib/components/console/ConsoleView.svelte';

export function findMinHeightZero(source: string, filename: string): string[] {
  const violations: string[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    if (/min-height:\s*0\s*(;|$)/.test(line)) {
      violations.push(`${filename}:${i + 1}: min-height: 0 defeats the phone 44px target`);
    }
  });
  return violations;
}

export function findGlobalSelectors(source: string, filename: string): string[] {
  if (filename === ANSI_BOUNDARY) return [];
  const violations: string[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    if (line.includes(':global(')) {
      violations.push(`${filename}:${i + 1}: :global() is a parent-to-child override`);
    }
  });
  return violations;
}

describe('style boundary', () => {
  it('flags min-height: 0 in fixture source', () => {
    const fixture = '  .x :global(.btn) {\n    min-height: 0;\n  }';
    expect(findMinHeightZero(fixture, '/src/x.svelte')).toHaveLength(1);
  });

  it('exempts only the ConsoleView ANSI boundary from the :global() rule', () => {
    const fixture = '  .console-view :global(.fg-red) { color: #ff6b6b; }';
    expect(findGlobalSelectors(fixture, ANSI_BOUNDARY)).toEqual([]);
    expect(findGlobalSelectors(fixture, '/src/other.svelte')).toHaveLength(1);
  });

  it('has no min-height: 0 anywhere in the application', () => {
    const violations = Object.entries(svelteSources).flatMap(([file, source]) =>
      findMinHeightZero(source, file)
    );
    expect(violations).toEqual([]);
  });

  it('has no :global() outside the ConsoleView ANSI boundary', () => {
    const violations = Object.entries(svelteSources).flatMap(([file, source]) =>
      findGlobalSelectors(source, file)
    );
    expect(violations).toEqual([]);
  });
});
