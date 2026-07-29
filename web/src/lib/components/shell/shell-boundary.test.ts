import { describe, expect, it } from 'vitest';

const allSources = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * The app shell must be sized in dvh, not vh.
 *
 * On iOS Safari `100vh` is the TALLEST viewport -- it excludes the browser
 * chrome that is actually on screen -- so a `100vh` shell overflows and its
 * last child (the StatusBar, holding every training control) is occluded by
 * the toolbar. The shell is `overflow-hidden`, so it cannot be scrolled back
 * into view.
 *
 * This is a source guard rather than an e2e assertion on purpose: headless
 * WebKit renders no browser chrome, so it cannot reproduce the occlusion and
 * a runtime test would pass against the regression.
 */
const VIEWPORT_UNIT_EXEMPT = [
  // A standalone centred page, not the app shell. It has no fixed footer to
  // occlude and no overflow-hidden ancestor.
  '/src/routes/login/+page.svelte',
];

export function findViewportUnitViolations(source: string, filename: string): string[] {
  if (VIEWPORT_UNIT_EXEMPT.includes(filename)) return [];

  const violations: string[] = [];
  source.split('\n').forEach((line, i) => {
    if (/\bh-screen\b/.test(line) || /\b100vh\b/.test(line)) {
      violations.push(
        `${filename}:${i + 1}: use 100dvh -- 100vh occludes the status bar on iOS Safari`
      );
    }
  });
  return violations;
}

/**
 * Shell chrome must pick its mobile/desktop presentation with CSS, not with
 * the JS `isMobile` media query.
 *
 * `isMobile.current` (and `sidebar.isMobile`, which is the same IsMobile
 * class) reads false until hydration. Rail used to gate on it and passed
 * `collapsible: 'none'` on a phone, which renders an unguarded in-flow div --
 * a full-width rail on first paint.
 */
const ISMOBILE_ALLOWED = [
  // Rail closes the portalled off-canvas sheet when the viewport grows past
  // md. The sheet renders into <body>, so a `md:hidden` wrapper cannot hide
  // it. This runs after hydration and never affects first paint.
  '/src/lib/components/shell/Rail.svelte',
];

const SHELL_PREFIX = '/src/lib/components/shell/';

export function findShellMediaQueryViolations(source: string, filename: string): string[] {
  const isShell =
    filename.startsWith(SHELL_PREFIX) ||
    filename === '/src/lib/components/LayoutContent.svelte';
  if (!isShell) return [];
  if (ISMOBILE_ALLOWED.includes(filename)) return [];
  if (filename.endsWith('TestWrapper.svelte')) return [];

  const violations: string[] = [];
  source.split('\n').forEach((line, i) => {
    if (line.includes('isMobile')) {
      violations.push(
        `${filename}:${i + 1}: shell chrome must switch on CSS breakpoints, not isMobile`
      );
    }
  });
  return violations;
}

describe('shell boundaries', () => {
  it('sizes the app shell in dvh so the status bar is never occluded', () => {
    const violations = Object.entries(allSources).flatMap(([filename, source]) =>
      findViewportUnitViolations(source, filename)
    );
    expect(violations).toEqual([]);
  });

  it('switches shell chrome on CSS breakpoints rather than the isMobile query', () => {
    const violations = Object.entries(allSources).flatMap(([filename, source]) =>
      findShellMediaQueryViolations(source, filename)
    );
    expect(violations).toEqual([]);
  });
});

