import { describe, expect, it } from 'vitest';

const routeSources = import.meta.glob('/src/routes/*/**/+page.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const MIGRATED_IN_THIS_TASK = [
  '/src/routes/(app)/general/+page.svelte',
  '/src/routes/(app)/model/+page.svelte',
  '/src/routes/(app)/training/+page.svelte',
  '/src/routes/(app)/lora/+page.svelte',
  '/src/routes/(app)/backup/+page.svelte',
];

describe('schema-form route containers', () => {
  it.each(MIGRATED_IN_THIS_TASK)('%s imports RoutePage', (file) => {
    expect(routeSources[file]).toContain('RoutePage');
  });

  it.each(MIGRATED_IN_THIS_TASK)('%s declares no width of its own', (file) => {
    expect(routeSources[file]).not.toContain('740px');
    expect(routeSources[file]).not.toContain('max-w-[740px]');
  });

  it.each(MIGRATED_IN_THIS_TASK)('%s no longer sets page padding locally', (file) => {
    expect(routeSources[file]).not.toMatch(/\.route-page\s*\{[^}]*padding:\s*1\.5rem/);
  });
});

const DASHBOARD_ROUTES = [
  '/src/routes/(app)/live/+page.svelte',
  '/src/routes/(app)/gallery/+page.svelte',
  '/src/routes/(app)/concepts/+page.svelte',
  '/src/routes/(app)/datasets/+page.svelte',
];

describe('dashboard and collection route containers', () => {
  it.each(DASHBOARD_ROUTES)('%s imports RoutePage', (file) => {
    expect(routeSources[file]).toContain('RoutePage');
  });

  it.each(DASHBOARD_ROUTES)('%s declares no width of its own', (file) => {
    const source = routeSources[file];
    expect(source).not.toContain('max-w-[1600px]');
    expect(source).not.toContain('max-width: 1600px');
    expect(source).not.toContain('max-width: 1200px');
    expect(source).not.toContain('w-[740px]');
  });
});

