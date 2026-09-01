import { describe, expect, it } from 'vitest';

const allSources = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The widths that used to be copy-pasted. RoutePage owns them now. */
const OWNED_WIDTHS = ['740px', '900px', '1200px', '1600px'];

/**
 * Vendored shadcn primitives carry their own max-w-* utilities legitimately,
 * and overlay widths are dialog sizing rather than page sizing.
 */
const WIDTH_EXEMPT = [
  '/src/lib/components/ui/',
  '/src/lib/components/overlays/',
];

/**
 * A full-height terminal pane, not a scrolling document. A max-width would be
 * wrong for it, so it is the one route that owns its own container.
 */
const ROUTE_PAGE_EXEMPT = ['/src/routes/(app)/console/+page.svelte'];

export function findHardcodedPageWidth(source: string, filename: string): string[] {
  if (WIDTH_EXEMPT.some((prefix) => filename.startsWith(prefix))) return [];

  const violations: string[] = [];
  const widths = OWNED_WIDTHS.join('|');
  // CSS declarations: `max-width: 740px`, `width:1600px`, `min-width : 900px`
  const cssDecl = new RegExp(`(?:max-|min-)?width\\s*:\\s*(?:${widths})`, 'g');
  // Tailwind arbitrary utilities: `w-[740px]`, `max-w-[1600px]`, `min-w-[900px]`
  const twUtil = new RegExp(`(?:max-|min-)?w-\\[(?:${widths})\\]`, 'g');

  source.split('\n').forEach((line, i) => {
    // A breakpoint is not a page width. `@media (max-width: 900px)` and
    // `@container (min-width: 900px)` are legitimate uses of these numbers.
    if (line.includes('@media') || line.includes('@container')) return;

    for (const pattern of [cssDecl, twUtil]) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        violations.push(
          `${filename}:${i + 1}: "${match[0]}" — page width belongs to RoutePage / --width-page`
        );
      }
    }
  });
  return violations;
}

export function findRoutesMissingRoutePage(source: string, filename: string): string[] {
  if (!filename.startsWith('/src/routes/(app)/')) return [];
  if (!filename.endsWith('/+page.svelte')) return [];
  if (ROUTE_PAGE_EXEMPT.includes(filename)) return [];
  if (source.includes('RoutePage')) return [];
  return [`${filename}: route must wrap its content in RoutePage`];
}

export function findFixedControlWidth(source: string, filename: string): string[] {
  if (!filename.startsWith('/src/lib/components/form/')) return [];

  const violations: string[] = [];
  source.split('\n').forEach((line, i) => {
    if (/flex:\s*0\s+0\s+\d+px/.test(line)) {
      violations.push(
        `${filename}:${i + 1}: fixed control basis — use var(--width-field-control)`
      );
    }
  });
  return violations;
}

describe('layout boundary', () => {
  it('flags a hardcoded CSS width in fixture source', () => {
    expect(findHardcodedPageWidth('  width: 740px;', '/src/x.svelte')).toHaveLength(1);
  });

  it('flags a hardcoded Tailwind width utility in fixture source', () => {
    expect(
      findHardcodedPageWidth('<div class="max-w-[1600px] w-full">', '/src/x.svelte')
    ).toHaveLength(1);
  });

  it('allows breakpoints that happen to use an owned number', () => {
    expect(
      findHardcodedPageWidth('  @media (max-width: 900px) {', '/src/x.svelte')
    ).toEqual([]);
    expect(
      findHardcodedPageWidth('  @container (min-width: 900px) {', '/src/x.svelte')
    ).toEqual([]);
  });

  it('ignores unrelated dimensions that merely share a number', () => {
    expect(findHardcodedPageWidth('  height: 740px;', '/src/x.svelte')).toEqual([]);
    expect(findHardcodedPageWidth('<Skeleton class="h-[900px]" />', '/src/x.svelte')).toEqual([]);
  });

  it('exempts vendored ui primitives and overlays', () => {
    expect(
      findHardcodedPageWidth('  max-width: 900px;', '/src/lib/components/ui/card/card.svelte')
    ).toEqual([]);
    expect(
      findHardcodedPageWidth('class="max-w-[740px]"', '/src/lib/components/overlays/x.svelte')
    ).toEqual([]);
  });

  it('flags an app route that does not use RoutePage', () => {
    expect(
      findRoutesMissingRoutePage('<div class="p-6">x</div>', '/src/routes/(app)/foo/+page.svelte')
    ).toHaveLength(1);
  });

  it('exempts the console route and non-route files', () => {
    expect(
      findRoutesMissingRoutePage('<div>x</div>', '/src/routes/(app)/console/+page.svelte')
    ).toEqual([]);
    expect(
      findRoutesMissingRoutePage('<div>x</div>', '/src/lib/components/shell/Header.svelte')
    ).toEqual([]);
  });

  it('flags a fixed control basis in a form component', () => {
    expect(
      findFixedControlWidth('    flex: 0 0 420px;', '/src/lib/components/form/Field.svelte')
    ).toHaveLength(1);
  });

  it('allows the token-driven flexible basis', () => {
    expect(
      findFixedControlWidth(
        '    flex: 0 1 var(--width-field-control);',
        '/src/lib/components/form/Field.svelte'
      )
    ).toEqual([]);
  });

  it('has no hardcoded page widths anywhere in the application', () => {
    const violations = Object.entries(allSources).flatMap(([file, source]) =>
      findHardcodedPageWidth(source, file)
    );
    expect(violations).toEqual([]);
  });

  it('has every app route wrapped in RoutePage', () => {
    const violations = Object.entries(allSources).flatMap(([file, source]) =>
      findRoutesMissingRoutePage(source, file)
    );
    expect(violations).toEqual([]);
  });

  it('has no fixed control widths in form components', () => {
    const violations = Object.entries(allSources).flatMap(([file, source]) =>
      findFixedControlWidth(source, file)
    );
    expect(violations).toEqual([]);
  });
});
