import { describe, expect, it } from 'vitest';

const source = (
  import.meta.glob('/src/routes/(app)/embeddings/+page.svelte', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)['/src/routes/(app)/embeddings/+page.svelte'];

describe('embeddings layout', () => {
  it('uses the shared page container', () => {
    expect(source).toContain('RoutePage');
  });

  it('no longer defines its own page padding', () => {
    expect(source).not.toMatch(/\.route-page\s*\{/);
  });

  it('keeps the warning alert free of a bespoke width', () => {
    expect(source).not.toMatch(/embeddings-warning-alert[^"]*max-w-/);
  });
});
