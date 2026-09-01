import { describe, expect, it } from 'vitest';

const source = (
  import.meta.glob('/src/routes/(app)/secrets/+page.svelte', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)['/src/routes/(app)/secrets/+page.svelte'];

describe('secrets layout', () => {
  it('uses the shared page container', () => {
    expect(source).toContain('RoutePage');
  });

  it('no longer caps itself at 900px', () => {
    expect(source).not.toContain('max-width: 900px');
  });

  it('lays its settings cards out as a responsive grid', () => {
    expect(source).toMatch(/\.card-grid\s*\{[^}]*display:\s*grid/);
    expect(source).toContain('repeat(auto-fit, minmax(min(420px, 100%), 1fr))');
  });
});
