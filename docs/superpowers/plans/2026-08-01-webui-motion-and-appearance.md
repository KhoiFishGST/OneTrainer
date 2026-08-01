# Web UI Motion System and Appearance Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the OneTrainer web UI a single, deliberately small motion scale across overlays, route changes, the console drawer and the rail, plus a new "Web UI" settings tab where theme and animations persist server-side.

**Architecture:** All timing lives in one `--motion-*` token block in `web/src/app.css`. Overlays animate through `data-state` attribute selectors so no vendored shadcn component is edited and no animation dependency is added. Two kill switches (`html[data-motion='off']` and `prefers-reduced-motion`) work by overriding those same tokens. Theme and animations persist in `webui.json` through the existing `SettingsStore`, with localStorage kept as a synchronous pre-paint cache applied by the blocking script in `app.html`.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes, `ssr = false`), Tailwind v4, bits-ui / shadcn-svelte, TanStack Svelte Query, FastAPI, vitest + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-01-webui-motion-design.md`

## Global Constraints

- **No new runtime dependency.** Specifically not `tw-animate-css`. `web/package.json` dependencies must be unchanged at the end of this plan.
- **No edits to `web/src/lib/components/ui/**`.** These are vendored shadcn components. `ui-dependency-boundary.test.ts` guards their imports; this plan additionally treats their markup as read-only. Override from `app.css` instead.
- **No `:global()` in any `.svelte` file.** `style-boundary.test.ts` fails the build on this, exempting only `ConsoleView.svelte`.
- **No `min-height: 0` in any `.svelte` file.** Same test.
- **Every duration, easing, travel and scale value references a `--motion-*` token.** No literal `ms` values in animation or transition properties outside the token block itself.
- **Motion scale (Crisp), exact values:** enter `90ms`, exit `70ms`, layout `120ms`, enter easing `cubic-bezier(0, 0, 0.2, 1)`, exit easing `cubic-bezier(0.4, 0, 1, 1)`, travel `2px`, scale `0.99`.
- **Exits are faster than entrances, and this asymmetry is intentional.** Do not normalise it.
- **The two kill switches compose one-way.** `prefers-reduced-motion` always vetoes; the app setting can never re-enable motion against the OS.
- **Kill switches zero durations to `0.01ms`; they never use `animation: none`.** bits-ui holds closing overlays mounted until `animationend`, so removing the animation can strand a closed dialog in the DOM.
- **Naming is `appearance` at every layer:** `webui.json` key `appearance`, endpoint `/api/appearance`, store `lib/stores/appearance.svelte.ts`. Never `ui-preferences` — `lib/stores/ui-preferences.ts` already exists for gallery sort order and is unrelated.
- **Run commands from `web/` for frontend work** and from the repo root for Python work.

---

### Task 1: Motion tokens, kill switches, and the JS mirror

Establishes the vocabulary every later task consumes. Nothing animates yet.

**Files:**
- Modify: `web/src/app.css` (token block near the `:root` colour tokens; kill switch after it; extend the existing `prefers-reduced-motion` block at approximately line 205)
- Create: `web/src/lib/motion.ts`
- Test: `web/src/lib/motion.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - CSS custom properties `--motion-duration-enter`, `--motion-duration-exit`, `--motion-duration-layout`, `--motion-ease-enter`, `--motion-ease-exit`, `--motion-travel`, `--motion-scale`, defined inside `/* motion-tokens:start */` … `/* motion-tokens:end */` marker comments.
  - `MOTION: { readonly enterMs: 90; readonly exitMs: 70; readonly layoutMs: 120; readonly travelPx: 2 }` from `$lib/motion`.
  - `motionEnabled(): boolean` from `$lib/motion`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/motion.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION, motionEnabled } from './motion';

const css = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf-8');

/** Reads a token from inside the marker comments, so the kill-switch block's
 *  overrides of the same names cannot be mistaken for the real values. */
function token(name: string): string {
  const block = /\/\* motion-tokens:start \*\/([\s\S]*?)\/\* motion-tokens:end \*\//.exec(css);
  if (!block) throw new Error('motion-tokens marker block not found in app.css');
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(block[1]);
  if (!match) throw new Error(`token --${name} not found in the motion-tokens block`);
  return match[1].trim();
}

describe('motion tokens', () => {
  it('defines the Crisp scale in app.css', () => {
    expect(token('motion-duration-enter')).toBe('90ms');
    expect(token('motion-duration-exit')).toBe('70ms');
    expect(token('motion-duration-layout')).toBe('120ms');
    expect(token('motion-ease-enter')).toBe('cubic-bezier(0, 0, 0.2, 1)');
    expect(token('motion-ease-exit')).toBe('cubic-bezier(0.4, 0, 1, 1)');
    expect(token('motion-travel')).toBe('2px');
    expect(token('motion-scale')).toBe('0.99');
  });

  it('keeps motion.ts in sync with app.css', () => {
    expect(`${MOTION.enterMs}ms`).toBe(token('motion-duration-enter'));
    expect(`${MOTION.exitMs}ms`).toBe(token('motion-duration-exit'));
    expect(`${MOTION.layoutMs}ms`).toBe(token('motion-duration-layout'));
    expect(`${MOTION.travelPx}px`).toBe(token('motion-travel'));
  });

  it('zeroes every duration token when motion is off', () => {
    const killSwitch = /html\[data-motion=['"]off['"]\]\s*\{([\s\S]*?)\}/.exec(css);
    expect(killSwitch).not.toBeNull();
    const body = killSwitch![1];
    expect(body).toContain('--motion-duration-enter: 0.01ms');
    expect(body).toContain('--motion-duration-exit: 0.01ms');
    expect(body).toContain('--motion-duration-layout: 0.01ms');
    expect(body).toContain('--motion-travel: 0px');
    expect(body).toContain('--motion-scale: 1');
    // Never `animation: none` — bits-ui needs animationend to fire to unmount.
    expect(body).not.toContain('animation: none');
  });
});

describe('motionEnabled', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-motion');
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it('is true by default', () => {
    expect(motionEnabled()).toBe(true);
  });

  it('is false when the app setting is off', () => {
    document.documentElement.setAttribute('data-motion', 'off');
    expect(motionEnabled()).toBe(false);
  });

  it('is false when the OS requests reduced motion, even with the setting on', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(motionEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/motion.test.ts`
Expected: FAIL — `Failed to resolve import "./motion"`.

- [ ] **Step 3: Create `web/src/lib/motion.ts`**

```ts
/**
 * JavaScript mirror of the `--motion-*` tokens in app.css.
 *
 * Svelte's transition system takes numbers, not CSS custom properties, so the
 * scale has to exist twice. `motion.test.ts` parses app.css and fails if the
 * two ever disagree — do not change one without the other.
 */
export const MOTION = {
  enterMs: 90,
  exitMs: 70,
  layoutMs: 120,
  travelPx: 2,
} as const;

/**
 * Whether motion should run right now.
 *
 * Mirrors the CSS kill switches, and composes them the same one-way manner:
 * the OS preference vetoes unconditionally, and the app setting can never
 * turn motion back on against it.
 */
export function motionEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'off') return false;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  return true;
}
```

- [ ] **Step 4: Add the token block to `web/src/app.css`**

Insert immediately after the `--radius: 0.5rem;` line inside the existing `:root` block's file region — that is, as a new `:root` block placed directly after the closing brace of the first `:root { … }`:

```css
/* motion-tokens:start */
/*
  The single definition of the app's motion scale ("Crisp").

  Everything that animates references these and nothing else, so the whole feel
  is retunable here. Two properties are load-bearing and must not be
  "normalised": exits are deliberately faster than entrances (an entrance is
  information, an exit is an obstacle), and travel is coupled to duration
  (2px over 280ms looks broken; 14px over 90ms looks like a jump cut).

  --motion-duration-layout is longer because the rail travels 112px
  (48px -> 160px) and the console drawer travels its full height, while
  overlays travel 2px. 112px crammed into 90ms reads as a snap.
*/
:root {
  --motion-duration-enter: 90ms;
  --motion-duration-exit: 70ms;
  --motion-duration-layout: 120ms;
  --motion-ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --motion-travel: 2px;
  --motion-scale: 0.99;
}
/* motion-tokens:end */

/*
  Kill switch one of two: the user's "Animations" setting, applied to <html> by
  the blocking script in app.html and by the appearance store.

  Durations are zeroed rather than the animations removed. bits-ui keeps a
  closing overlay mounted until its animation ends, so `animation: none` can
  strand a closed dialog in the DOM; a 0.01ms animation still fires
  animationend, so the unmount always completes. 0.01ms is also the convention
  the prefers-reduced-motion block below already uses.
*/
html[data-motion='off'] {
  --motion-duration-enter: 0.01ms;
  --motion-duration-exit: 0.01ms;
  --motion-duration-layout: 0.01ms;
  --motion-travel: 0px;
  --motion-scale: 1;
}
```

- [ ] **Step 5: Extend the existing reduced-motion block in `web/src/app.css`**

The file already has a `@media (prefers-reduced-motion: reduce)` block containing the blanket `animation-duration: 0.01ms !important` rules. Add a `:root` rule inside that same block, above the existing `*` rule:

```css
@media (prefers-reduced-motion: reduce) {
  /*
    Kill switch two of two, and the one that wins. Overriding the tokens (rather
    than only clamping via the blanket rule below) means every token-driven
    transition collapses too, including the JS-side motionEnabled() checks that
    read the same signal. The app's Animations setting can turn motion off but
    can never turn it back on against this.
  */
  :root {
    --motion-duration-enter: 0.01ms;
    --motion-duration-exit: 0.01ms;
    --motion-duration-layout: 0.01ms;
    --motion-travel: 0px;
    --motion-scale: 1;
  }

  *,
  *::before,
  *::after {
    /* … existing rules unchanged … */
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd web && npx vitest run src/lib/motion.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Verify nothing else broke**

Run: `cd web && npx vitest run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: all tests pass; svelte-check reports no new errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/app.css web/src/lib/motion.ts web/src/lib/motion.test.ts
git commit -m "feat(webui): add the Crisp motion tokens and both kill switches"
```

---

### Task 2: Overlay animation via data-state selectors

Turns on modals, alert dialogs, dropdowns, selects, popovers, tooltips and their scrims. Retargets the existing sheet keyframes onto the tokens.

**Files:**
- Modify: `web/src/app.css` (the sheet animation section, approximately lines 215-300)
- Test: `web/e2e/motion.spec.ts` (create)

**Interfaces:**
- Consumes: the `--motion-*` tokens from Task 1.
- Produces: animated overlays. No new exported symbols.

- [ ] **Step 1: Write the failing test**

Create `web/e2e/motion.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Overlay motion", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("a dialog animates in at the Crisp enter duration", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const duration = await dlg.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0.09s");
  });

  test("the dialog scrim animates too", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    const scrim = page.locator("[data-dialog-overlay]").first();
    const duration = await scrim.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0.09s");
  });

  test("data-motion=off collapses the duration instead of removing the animation", async ({ page }) => {
    await page.goto("/concepts");
    await page.evaluate(() => document.documentElement.setAttribute("data-motion", "off"));
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const style = await dlg.evaluate((el) => {
      const s = getComputedStyle(el);
      return { duration: s.animationDuration, name: s.animationName };
    });
    expect(style.duration).toBe("0.00001s");
    expect(style.name).not.toBe("none");
  });

  test("a closed dialog is removed from the DOM after its exit animation", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx playwright test e2e/motion.spec.ts`
Expected: FAIL — `animationDuration` is `"0s"`, because no rule matches the dialog yet.

- [ ] **Step 3: Add the overlay rules to `web/src/app.css`**

Add directly below the existing sheet animation rules:

```css
/*
  Overlay motion.

  bits-ui sets data-state="open"|"closed" on every overlay it portals, and
  shadcn's wrappers set a data-slot / data-*-content attribute identifying the
  kind. Together they cover dialogs, alert dialogs, dropdowns, selects,
  popovers and tooltips from one place, with no edits to the vendored
  components and no animation plugin.

  Those components still carry upstream's animate-in / zoom-in-95 classes,
  which compile to nothing without tw-animate-css. These rules are unlayered
  and Tailwind's utilities are layered, so these win even if that plugin is
  ever added -- the same specificity property the phone min-height rule below
  relies on.
*/
@keyframes overlay-scrim-in {
  from { opacity: 0; }
}

@keyframes overlay-scrim-out {
  to { opacity: 0; }
}

@keyframes overlay-content-in {
  from {
    opacity: 0;
    transform: translateY(var(--motion-travel)) scale(var(--motion-scale));
  }
}

@keyframes overlay-content-out {
  to {
    opacity: 0;
    transform: translateY(var(--motion-travel)) scale(var(--motion-scale));
  }
}

[data-dialog-overlay][data-state='open'],
[data-alert-dialog-overlay][data-state='open'] {
  animation: overlay-scrim-in var(--motion-duration-enter) var(--motion-ease-enter);
}

[data-dialog-overlay][data-state='closed'],
[data-alert-dialog-overlay][data-state='closed'] {
  animation: overlay-scrim-out var(--motion-duration-exit) var(--motion-ease-exit);
}

/*
  Sheets are excluded here: they slide from an edge and have their own
  keyframes above. `:not([data-side])` is what distinguishes a plain dialog
  from a sheet, exactly as the sheet rules use [data-side] to select one.
*/
[data-dialog-content]:not([data-side])[data-state='open'],
[data-alert-dialog-content][data-state='open'],
[data-dropdown-menu-content][data-state='open'],
[data-dropdown-menu-sub-content][data-state='open'],
[data-select-content][data-state='open'],
[data-popover-content][data-state='open'],
[data-tooltip-content][data-state='open'],
[data-tooltip-content][data-state='delayed-open'] {
  animation: overlay-content-in var(--motion-duration-enter) var(--motion-ease-enter);
}

[data-dialog-content]:not([data-side])[data-state='closed'],
[data-alert-dialog-content][data-state='closed'],
[data-dropdown-menu-content][data-state='closed'],
[data-dropdown-menu-sub-content][data-state='closed'],
[data-select-content][data-state='closed'],
[data-popover-content][data-state='closed'],
[data-tooltip-content][data-state='closed'] {
  animation: overlay-content-out var(--motion-duration-exit) var(--motion-ease-exit);
}
```

- [ ] **Step 4: Retarget the existing sheet rules onto the tokens**

In the eight existing `[data-dialog-content][data-side='…'][data-state='…']` rules, replace every `200ms ease-in-out` with the tokens. Open states use enter values, closed states use exit values:

```css
[data-dialog-content][data-side='left'][data-state='open'] {
  animation: sheet-slide-in-left var(--motion-duration-layout) var(--motion-ease-enter);
}
[data-dialog-content][data-side='left'][data-state='closed'] {
  animation: sheet-slide-out-left var(--motion-duration-exit) var(--motion-ease-exit);
}
```

Apply the same substitution to the `right`, `top` and `bottom` pairs. Sheets use `--motion-duration-layout` on enter because they travel the full width or height of a panel, not 2px.

- [ ] **Step 5: Update the stale comments in `web/src/app.css`**

Two comments now contradict the code and must be rewritten, not left in place:

1. The sheet comment claiming the plugin was avoided because animating nine components "is a bigger visual change than the nav drawer needs" — that rationale is inverted by this change. Replace that paragraph with: the plugin is still not installed because its durations and travel are hardcoded per-component, so the Crisp scale would have to be edited into nine vendored files instead of living in one token block.
2. The comment stating duration and easing "match the desktop rail's `transition-[width] duration-200 ease-in-out`" — both now come from `--motion-duration-layout`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd web && npx playwright test e2e/motion.spec.ts`
Expected: PASS, 4 tests.

If the scrim test fails on the selector, confirm the real attribute by inspecting the rendered overlay:
`await page.locator('body').evaluate(() => [...document.querySelectorAll('[data-state]')].map(e => e.getAttributeNames().join(',')))`
and correct the selector in both the CSS and the test.

- [ ] **Step 7: Verify the suite**

Run: `cd web && npx vitest run && npx playwright test`
Expected: all pass. Watch overlay-heavy specs (`accessibility.spec.ts`, `dialog-width.spec.ts`, `gallery-viewer.spec.ts`) for new flakes now that overlays animate.

- [ ] **Step 8: Commit**

```bash
git add web/src/app.css web/e2e/motion.spec.ts
git commit -m "feat(webui): animate every bits-ui overlay from the motion tokens"
```

---

### Task 3: Route transition

**Files:**
- Modify: `web/src/lib/components/layout/RoutePage.svelte`
- Modify: `web/src/routes/(app)/console/+page.svelte`
- Test: `web/src/lib/components/layout/RoutePage.test.ts` (exists — add to it)

**Interfaces:**
- Consumes: the `--motion-*` tokens.
- Produces: a `route-page` element carrying a mount animation. `RoutePage`'s props are unchanged.

- [ ] **Step 1: Write the failing test**

Append to `web/src/lib/components/layout/RoutePage.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('route transition', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/lib/components/layout/RoutePage.svelte'),
    'utf-8'
  );

  it('animates on mount using the motion tokens', () => {
    expect(source).toContain('animation: route-page-in var(--motion-duration-enter)');
    expect(source).toContain('var(--motion-ease-enter)');
  });

  it('has no exit animation, which would delay navigation', () => {
    expect(source).not.toContain('--motion-duration-exit');
  });

  it('moves by the travel token rather than a literal distance', () => {
    expect(source).toContain('translateY(var(--motion-travel))');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/components/layout/RoutePage.test.ts`
Expected: FAIL — the source contains no `animation:` declaration.

- [ ] **Step 3: Add the animation to `RoutePage.svelte`**

In the component's `<style>` block, extend the existing `:where(.route-page)` rule and add the keyframes:

```css
  :where(.route-page) {
    width: 100%;
    max-width: var(--width-page);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-sizing: border-box;
    /*
      RoutePage is mounted fresh on every route change, so this fires by itself
      -- no {#key} block, no forced remount, no onNavigate hook.

      Enter-only, deliberately. An exit animation would put 70ms between the
      click and the new page, which is exactly the latency this motion scale
      exists to avoid. The outgoing page is removed immediately.

      This doubles as the skeleton-to-content crossfade: the schema-form pages
      render FormPageSkeleton outside RoutePage and swap to RoutePage when the
      workspace resolves, which mounts this element and runs this animation.
    */
    animation: route-page-in var(--motion-duration-enter) var(--motion-ease-enter);
  }

  @keyframes route-page-in {
    from {
      opacity: 0;
      transform: translateY(var(--motion-travel));
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/lib/components/layout/RoutePage.test.ts`
Expected: PASS.

- [ ] **Step 5: Give `/console` the same treatment**

`routes/(app)/console/+page.svelte` does not use `RoutePage`. Read it, and add the identical `animation` and `@keyframes route-page-in` declarations to its outermost wrapper element's style rule. If it has no `<style>` block, add one. Do not import `RoutePage` — the console page is deliberately full-bleed.

- [ ] **Step 6: Verify manually**

Run: `cd web && npm run dev`, then click between `/model`, `/lora` and `/sampling`. Content should fade up 2px. Navigation must feel instant — if there is any sense of waiting before the new page appears, an exit transition has crept in.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/layout/RoutePage.svelte "web/src/routes/(app)/console/+page.svelte" web/src/lib/components/layout/RoutePage.test.ts
git commit -m "feat(webui): fade route pages in on mount, enter-only"
```

---

### Task 4: Rail width transition

**Files:**
- Modify: `web/src/app.css`
- Test: `web/e2e/motion.spec.ts` (add a case)

**Interfaces:**
- Consumes: the `--motion-*` tokens.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append inside the existing `test.describe("Overlay motion", …)` block in `web/e2e/motion.spec.ts`:

```ts
  test("the rail transitions its width at the layout duration", async ({ page }) => {
    await page.goto("/model");
    const sidebar = page.locator('[data-slot="sidebar-gap"]').first();
    await expect(sidebar).toBeAttached();
    const duration = await sidebar.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe("0.12s");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx playwright test e2e/motion.spec.ts -g "rail"`
Expected: FAIL — duration is `0.2s`, from the vendored sidebar's hardcoded `duration-200`.

If the element is not found, list the available slots with
`await page.evaluate(() => [...document.querySelectorAll('[data-slot]')].map(e => e.dataset.slot))`
and use the sidebar slot that actually carries the width transition.

- [ ] **Step 3: Add the override to `web/src/app.css`**

```css
/*
  The vendored sidebar hardcodes `transition-[width] duration-200 ease-linear`
  in its class string. Rather than edit a vendored component, retarget it here:
  this rule is unlayered and Tailwind's utilities are layered, so it wins. The
  rail then follows the motion tokens and is covered by the kill switches for
  free.

  The rail uses the layout duration, not the enter duration -- it travels 112px
  (--rail-compact 48px to --rail-expanded 160px), and that distance in 90ms
  reads as a snap.
*/
[data-slot='sidebar-gap'],
[data-slot='sidebar-container'] {
  transition-duration: var(--motion-duration-layout);
  transition-timing-function: var(--motion-ease-enter);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx playwright test e2e/motion.spec.ts -g "rail"`
Expected: PASS.

- [ ] **Step 5: Verify manually**

Run `cd web && npm run dev`, toggle the rail. It should expand and collapse noticeably faster than before, without a snap.

- [ ] **Step 6: Commit**

```bash
git add web/src/app.css web/e2e/motion.spec.ts
git commit -m "feat(webui): retarget the rail width transition onto the motion tokens"
```

---

### Task 5: Console drawer open/close

The riskiest task: the drawer stops unmounting.

**Files:**
- Modify: `web/src/lib/components/shell/ConsoleDrawer.svelte`
- Test: `web/src/lib/components/shell/ConsoleDrawer.test.ts` (exists — add to it)

**Interfaces:**
- Consumes: the `--motion-*` tokens.
- Produces: `ConsoleDrawer`'s props are unchanged (`open`, `store`, `onClose`, `children`). The root `<section class="console-drawer">` is now always rendered when the component is mounted, carrying `data-open="true"|"false"` and `inert` when closed.

- [ ] **Step 1: Write the failing test**

Append to `web/src/lib/components/shell/ConsoleDrawer.test.ts` (match the existing file's import style and render helper):

```ts
describe('console drawer motion', () => {
  it('stays in the DOM when closed', () => {
    const { container } = render(ConsoleDrawer, { props: { open: false } });
    expect(container.querySelector('.console-drawer')).not.toBeNull();
  });

  it('marks the closed drawer inert so its controls leave the tab order', () => {
    const { container } = render(ConsoleDrawer, { props: { open: false } });
    const section = container.querySelector('.console-drawer')!;
    expect(section.hasAttribute('inert')).toBe(true);
    expect(section.getAttribute('data-open')).toBe('false');
  });

  it('is not inert when open', () => {
    const { container } = render(ConsoleDrawer, { props: { open: true } });
    const section = container.querySelector('.console-drawer')!;
    expect(section.hasAttribute('inert')).toBe(false);
    expect(section.getAttribute('data-open')).toBe('true');
  });

  it('collapses to zero height when closed', () => {
    const { container } = render(ConsoleDrawer, { props: { open: false } });
    const section = container.querySelector('.console-drawer') as HTMLElement;
    expect(section.style.height).toBe('0px');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/components/shell/ConsoleDrawer.test.ts`
Expected: FAIL — `.console-drawer` is null when `open` is false, because of the `{#if open}` gate.

- [ ] **Step 3: Replace the `{#if open}` gate in `ConsoleDrawer.svelte`**

Remove the `{#if open}` / `{/if}` wrapper entirely and change the `<section>` opening tag to:

```svelte
<section
  class="console-drawer {isDragging ? 'resizing' : ''}"
  aria-label="Console Output"
  data-open={open ? 'true' : 'false'}
  inert={!open}
  style="height: {open ? drawerHeight : 0}px;"
>
```

Everything inside the section is unchanged.

- [ ] **Step 4: Add the transition to the component's `<style>` block**

Extend the existing `.console-drawer` rule and add the drag exemption:

```css
  .console-drawer {
    background-color: var(--card);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    /*
      The drawer is a flex child, so animating height reflows the main content
      above it. That is correct: the drawer pushes content rather than covering
      it, and a transform would leave main content sitting underneath.

      Layout duration, not enter duration -- it travels its full height.
    */
    transition: height var(--motion-duration-layout) var(--motion-ease-enter);
  }

  /*
    The resize handle writes inline height on every mousemove. A transition
    there makes the drawer lag the pointer, so the drag suppresses it. This
    class already existed to suppress text selection during a drag.
  */
  .console-drawer.resizing {
    user-select: none;
    transition: none;
  }
```

- [ ] **Step 5: Fix the mobile rule**

The existing `@media (max-width: 768px)` block sets `height: 75dvh !important`, which overrides the inline height in both states. Replace that rule so the closed state is explicit:

```css
  @media (max-width: 768px) {
    .resize-handle {
      display: none;
    }

    /*
      `!important` is needed to beat the inline height, which means the closed
      state cannot be inherited from the desktop rule and has to be declared
      here too.
    */
    .console-drawer[data-open='true'] {
      height: 75dvh !important;
      max-height: 80dvh;
      flex: 1;
    }

    .console-drawer[data-open='false'] {
      height: 0 !important;
      flex: none;
    }
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/components/shell/ConsoleDrawer.test.ts`
Expected: PASS, including the pre-existing cases in that file.

- [ ] **Step 7: Check that a closed drawer does not keep working**

The drawer no longer unmounts, so `ConsoleView` stays mounted while closed. Read `web/src/lib/components/console/ConsoleView.svelte` and confirm it does no per-event work (rendering, scrolling, measuring) that would now run continuously off-screen. If it does, pass `open` down and gate that work on it. Do **not** revert the animation to solve this.

- [ ] **Step 8: Verify manually and run the console e2e**

Run: `cd web && npm run dev` — open and close the console; it should slide rather than pop, and the drag-resize must still track the pointer with no lag. Tab through the page with the console closed and confirm its buttons are not reachable.

Run: `cd web && npx playwright test e2e/console.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/components/shell/ConsoleDrawer.svelte web/src/lib/components/shell/ConsoleDrawer.test.ts
git commit -m "feat(webui): slide the console drawer open instead of popping it"
```

---

### Task 6: In-page state changes

**Files:**
- Modify: `web/src/lib/components/datasets/DatasetCollection.svelte`
- Modify: `web/src/lib/components/shell/TrainingStatusPill.svelte`
- Modify: `web/src/app.css` (sonner durations)
- Test: `web/src/lib/motion.test.ts` (add a case)

**Interfaces:**
- Consumes: `MOTION` and `motionEnabled()` from `$lib/motion`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `web/src/lib/motion.test.ts`:

```ts
describe('toast motion', () => {
  it('brings sonner durations under the token block', () => {
    const cssText = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf-8');
    expect(cssText).toContain('[data-sonner-toast]');
    expect(cssText).toMatch(/\[data-sonner-toast\][\s\S]{0,200}--motion-duration-enter/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/motion.test.ts`
Expected: FAIL — `app.css` contains no `[data-sonner-toast]` rule.

- [ ] **Step 3: Add the sonner override to `web/src/app.css`**

```css
/*
  svelte-sonner ships its own transitions, independent of Tailwind, so toasts
  already animate. They are left alone except for this: their durations are
  pulled onto the tokens so the kill switches reach them. A toast that keeps
  sliding after the user has turned animations off is the most visible way for
  the setting to look broken.
*/
[data-sonner-toast] {
  transition-duration: var(--motion-duration-enter);
  transition-timing-function: var(--motion-ease-enter);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/lib/motion.test.ts`
Expected: PASS.

- [ ] **Step 5: Add list transitions to `DatasetCollection.svelte`**

Read the file and find the `{#each}` that renders `DatasetFileCard`. Add to the script block:

```svelte
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { MOTION, motionEnabled } from '$lib/motion';
```

and on the element inside the `{#each}`:

```svelte
  animate:flip={{ duration: motionEnabled() ? MOTION.layoutMs : 0 }}
  in:fade={{ duration: motionEnabled() ? MOTION.enterMs : 0 }}
  out:fade={{ duration: motionEnabled() ? MOTION.exitMs : 0 }}
```

The `{#each}` must already be keyed (`{#each items as item (item.id)}`); `animate:flip` requires it. If it is not keyed, key it on the file name.

`motionEnabled()` is called inline rather than hoisted so it re-reads the current state each time the list changes — the user can toggle the setting while this page is open.

- [ ] **Step 6: Add the colour transition to `TrainingStatusPill.svelte`**

In its `<style>` block, on the pill's root rule:

```css
    /* Colour only. The pill sits in the header and must not move; a status
       change is a change of state, not of place. */
    transition: background-color var(--motion-duration-enter) var(--motion-ease-enter),
                color var(--motion-duration-enter) var(--motion-ease-enter);
```

If the pill is styled entirely with Tailwind classes and has no `<style>` block, add `transition-colors` to its class list instead and add a rule in `app.css` scoped to its `data-slot` retargeting the duration onto the token.

- [ ] **Step 7: Confirm the exclusions**

Do **not** add transitions to progress bars or `UploadSummaryBar.svelte`. They update at high frequency, and a width transition makes the bar lag the real number and display a value that is not true. Verify by grepping for accidental additions:

Run: `cd web && grep -rn "transition" src/lib/components/datasets/UploadSummaryBar.svelte`
Expected: no `width` or `transform` transition.

- [ ] **Step 8: Run the suite**

Run: `cd web && npx vitest run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/app.css web/src/lib/motion.test.ts web/src/lib/components/datasets/DatasetCollection.svelte web/src/lib/components/shell/TrainingStatusPill.svelte
git commit -m "feat(webui): animate list changes, status colour and toasts from the tokens"
```

---

### Task 7: SettingsStore appearance getter and setter

Backend work begins. Run these from the repo root.

**Files:**
- Modify: `modules/webui/settings_store.py`
- Test: `modules/webui/tests/test_settings_store.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEFAULT_APPEARANCE: dict[str, Any]` = `{"theme": "system", "animations": True}`
  - `SettingsStore.get_appearance() -> dict[str, Any]` — always returns both keys, never raises.
  - `SettingsStore.set_appearance(theme: str | None = None, animations: bool | None = None) -> dict[str, Any]` — partial update, returns the resulting appearance dict, raises `SettingsStoreUnreadableError` on an unparseable existing file.
  - Valid themes: `"light"`, `"dark"`, `"system"`.

- [ ] **Step 1: Write the failing test**

Append to `modules/webui/tests/test_settings_store.py`:

```python
def test_appearance_defaults_when_file_missing(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    assert store.get_appearance() == {"theme": "system", "animations": True}


def test_appearance_falls_back_on_malformed_file(tmp_path):
    path = tmp_path / "webui.json"
    path.write_text("{not valid json", encoding="utf-8")
    store = SettingsStore(path)
    # A broken settings file must not take down the UI.
    assert store.get_appearance() == {"theme": "system", "animations": True}


def test_appearance_round_trips(tmp_path):
    path = tmp_path / "webui.json"
    store = SettingsStore(path)
    assert store.set_appearance(theme="light") == {"theme": "light", "animations": True}
    assert store.get_appearance() == {"theme": "light", "animations": True}
    assert store.set_appearance(animations=False) == {"theme": "light", "animations": False}
    assert store.get_appearance() == {"theme": "light", "animations": False}


def test_appearance_rejects_an_unknown_theme(tmp_path):
    store = SettingsStore(tmp_path / "webui.json")
    with pytest.raises(ValueError):
        store.set_appearance(theme="solarized")


def test_appearance_ignores_junk_stored_values(tmp_path):
    path = tmp_path / "webui.json"
    path.write_text(
        json.dumps({"appearance": {"theme": "solarized", "animations": "yes"}}),
        encoding="utf-8",
    )
    store = SettingsStore(path)
    assert store.get_appearance() == {"theme": "system", "animations": True}


def test_appearance_setter_does_not_clobber_malformed_file(tmp_path):
    path = tmp_path / "webui.json"
    original = b"{not valid json"
    path.write_bytes(original)
    store = SettingsStore(path)
    with pytest.raises(SettingsStoreUnreadableError):
        store.set_appearance(theme="dark")
    assert path.read_bytes() == original


def test_appearance_setter_preserves_the_password(tmp_path):
    path = tmp_path / "webui.json"
    store = SettingsStore(path)
    store.set_password("hunter2")
    store.set_appearance(theme="dark")
    assert store.verify_password("hunter2") is True
    assert store.get_appearance()["theme"] == "dark"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest modules/webui/tests/test_settings_store.py -v`
Expected: FAIL — `AttributeError: 'SettingsStore' object has no attribute 'get_appearance'`.

- [ ] **Step 3: Implement in `modules/webui/settings_store.py`**

Add the module constants next to `DEFAULT_DATASETS_DIR`:

```python
VALID_THEMES = ("light", "dark", "system")
DEFAULT_APPEARANCE: dict[str, Any] = {"theme": "system", "animations": True}
```

Add the methods after `set_datasets_dir`:

```python
    def get_appearance(self) -> dict[str, Any]:
        """Theme and animation preferences for the web UI.

        Deliberately falls back rather than raising, like get_datasets_dir: a
        broken settings file should not take down the UI. Each key is validated
        independently, so one junk value does not discard the other.
        """
        document = self._read()
        stored = document.get("appearance") if document is not None else None
        if not isinstance(stored, dict):
            stored = {}

        theme = stored.get("theme")
        animations = stored.get("animations")
        return {
            "theme": theme if theme in VALID_THEMES else DEFAULT_APPEARANCE["theme"],
            "animations": animations
            if isinstance(animations, bool)
            else DEFAULT_APPEARANCE["animations"],
        }

    def set_appearance(
        self,
        theme: str | None = None,
        animations: bool | None = None,
    ) -> dict[str, Any]:
        """Partially update the appearance preferences and return the result.

        Raises ValueError for an unknown theme, and SettingsStoreUnreadableError
        if the existing file exists but cannot be parsed -- that file holds the
        password hash, so it must never be clobbered.
        """
        if theme is not None and theme not in VALID_THEMES:
            raise ValueError(f"unknown theme: {theme!r}")

        document = self._read_for_update()
        current = self.get_appearance()
        if theme is not None:
            current["theme"] = theme
        if animations is not None:
            current["animations"] = bool(animations)

        document["appearance"] = current
        self._write(document)
        return current
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest modules/webui/tests/test_settings_store.py -v`
Expected: PASS, including the pre-existing cases.

- [ ] **Step 5: Commit**

```bash
git add modules/webui/settings_store.py modules/webui/tests/test_settings_store.py
git commit -m "feat(webui): persist theme and animation preferences in webui.json"
```

---

### Task 8: The /api/appearance endpoints

**Files:**
- Create: `modules/webui/routers/appearance.py`
- Modify: `modules/webui/app.py` (imports, and the `include_router` block at approximately lines 254-267)
- Test: `modules/webui/tests/test_appearance_api.py` (create)

**Interfaces:**
- Consumes: `SettingsStore.get_appearance` / `set_appearance` from Task 7.
- Produces:
  - `GET /api/appearance` → `{"theme": str, "animations": bool}`
  - `PUT /api/appearance` with body `{"theme"?: str, "animations"?: bool}` → the full resulting document.
  - An unknown theme returns HTTP 400.

- [ ] **Step 1: Write the failing test**

Create `modules/webui/tests/test_appearance_api.py`:

```python
from modules.webui.app import create_app
from modules.webui.state import WebUISettings

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    settings = WebUISettings(
        config_path=tmp_path / "last_session.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=tmp_path / "static",
        root_dir=tmp_path,
        dev=True,
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


def test_get_returns_defaults(client):
    resp = client.get("/api/appearance")
    assert resp.status_code == 200
    assert resp.json() == {"theme": "system", "animations": True}


def test_put_applies_a_partial_update(client):
    resp = client.put("/api/appearance", json={"theme": "light"})
    assert resp.status_code == 200
    assert resp.json() == {"theme": "light", "animations": True}

    resp = client.put("/api/appearance", json={"animations": False})
    assert resp.status_code == 200
    assert resp.json() == {"theme": "light", "animations": False}


def test_put_persists_across_requests(client):
    client.put("/api/appearance", json={"theme": "dark", "animations": False})
    assert client.get("/api/appearance").json() == {"theme": "dark", "animations": False}


def test_put_rejects_an_unknown_theme(client):
    resp = client.put("/api/appearance", json={"theme": "solarized"})
    assert resp.status_code == 400


def test_put_with_an_empty_body_is_a_no_op(client):
    resp = client.put("/api/appearance", json={})
    assert resp.status_code == 200
    assert resp.json() == {"theme": "system", "animations": True}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest modules/webui/tests/test_appearance_api.py -v`
Expected: FAIL — 404 on `/api/appearance`.

- [ ] **Step 3: Create `modules/webui/routers/appearance.py`**

```python
from typing import Any

from modules.webui.state import AppState

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(tags=["appearance"])


class AppearanceUpdateRequest(BaseModel):
    # Both optional: the UI sends only the field the user touched, so a theme
    # change from one browser cannot stomp an animations change from another.
    theme: str | None = None
    animations: bool | None = None


@router.get("/appearance")
async def get_appearance(request: Request) -> dict[str, Any]:
    state: AppState = request.app.state.webui
    return state.settings_store.get_appearance()


@router.put("/appearance")
async def update_appearance(req: AppearanceUpdateRequest, request: Request) -> Any:
    state: AppState = request.app.state.webui
    try:
        return state.settings_store.set_appearance(
            theme=req.theme,
            animations=req.animations,
        )
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"detail": str(exc)})
```

- [ ] **Step 4: Register the router in `modules/webui/app.py`**

Add the import alongside the other router imports:

```python
from modules.webui.routers.appearance import router as appearance_router
```

and add to the `include_router` block:

```python
    app.include_router(appearance_router, prefix="/api")
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python -m pytest modules/webui/tests/test_appearance_api.py -v`
Expected: PASS, 5 tests.

- [ ] **Step 6: Confirm the endpoint sits behind auth like every other route**

Run: `python -m pytest modules/webui/tests/test_api_security.py -v`
Expected: PASS. Read that file; if it enumerates protected routes, add `/api/appearance` to the list.

- [ ] **Step 7: Commit**

```bash
git add modules/webui/routers/appearance.py modules/webui/app.py modules/webui/tests/test_appearance_api.py
git commit -m "feat(webui): add the /api/appearance endpoints"
```

---

### Task 9: API client and query bindings

**Files:**
- Modify: `web/src/lib/api/types.ts`
- Modify: `web/src/lib/api/client.ts`
- Modify: `web/src/lib/api/queries.ts`
- Test: `web/src/lib/api/client.test.ts` (exists — add to it)

**Interfaces:**
- Consumes: the endpoints from Task 8.
- Produces:
  - `type ThemeChoice = 'light' | 'dark' | 'system'`
  - `interface AppearanceSettings { theme: ThemeChoice; animations: boolean }`
  - `interface AppearanceUpdateRequest { theme?: ThemeChoice; animations?: boolean }`
  - `api.getAppearance(): Promise<AppearanceSettings>`
  - `api.putAppearance(data: AppearanceUpdateRequest): Promise<AppearanceSettings>`
  - `queryKeys.appearance(): ['appearance']`
  - `createAppearanceQuery()`
  - `createUpdateAppearanceMutation()`

- [ ] **Step 1: Write the failing test**

Append to `web/src/lib/api/client.test.ts`, matching that file's existing fetch-mocking style:

```ts
describe('appearance api', () => {
  it('gets the appearance settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ theme: 'dark', animations: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createApi().getAppearance();

    expect(fetchMock).toHaveBeenCalledWith('/api/appearance', expect.anything());
    expect(result).toEqual({ theme: 'dark', animations: true });
  });

  it('sends a partial update as a PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ theme: 'system', animations: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await createApi().putAppearance({ animations: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/appearance');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ animations: false });
  });
});
```

Adjust the mock shape to match the file's existing helper if it already has one — do not introduce a second mocking style.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/api/client.test.ts`
Expected: FAIL — `getAppearance is not a function`.

- [ ] **Step 3: Add the types to `web/src/lib/api/types.ts`**

```ts
export type ThemeChoice = 'light' | 'dark' | 'system';

export interface AppearanceSettings {
  theme: ThemeChoice;
  animations: boolean;
}

export interface AppearanceUpdateRequest {
  theme?: ThemeChoice;
  animations?: boolean;
}
```

- [ ] **Step 4: Add the methods to `createApi` in `web/src/lib/api/client.ts`**

Alongside the other endpoints, following the existing `request<T>` style:

```ts
    getAppearance: () => request<AppearanceSettings>(`${base}/api/appearance`),

    putAppearance: (data: AppearanceUpdateRequest) =>
      request<AppearanceSettings>(`${base}/api/appearance`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
```

Add `AppearanceSettings` and `AppearanceUpdateRequest` to the existing type import at the top of the file.

- [ ] **Step 5: Add the query bindings to `web/src/lib/api/queries.ts`**

Add to the `queryKeys` object:

```ts
  appearance: () => ['appearance'] as const,
```

and the query and mutation, following the file's existing patterns:

```ts
export function createAppearanceQuery() {
  return createQuery({
    queryKey: queryKeys.appearance(),
    queryFn: () => api.getAppearance(),
  });
}

export function createUpdateAppearanceMutation() {
  const client = getSafeQueryClient();
  return createMutation({
    mutationFn: (data: AppearanceUpdateRequest) => api.putAppearance(data),
    onSuccess: (result) => {
      client.setQueryData(queryKeys.appearance(), result);
    },
  });
}
```

Add `AppearanceUpdateRequest` to the existing type import at the top of the file.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/api/client.test.ts && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/api/types.ts web/src/lib/api/client.ts web/src/lib/api/queries.ts web/src/lib/api/client.test.ts
git commit -m "feat(webui): add appearance api client and query bindings"
```

---

### Task 10: Pre-paint script in app.html

The only code that runs before first paint (`routes/+layout.ts` sets `ssr = false`). Gets its own task because a throw here blanks the entire app.

**Files:**
- Modify: `web/src/app.html`
- Test: `web/src/lib/stores/prepaint.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: localStorage contract — key `webui.theme` holds `'light' | 'dark' | 'system'`, key `webui.animations` holds `'true' | 'false'`. On load `<html>` carries `.dark` (or not), `style.colorScheme`, and `data-motion="off"` when animations are disabled.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/stores/prepaint.test.ts`. It extracts the script from `app.html` and executes it, so the real shipped code is what gets tested:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'src/app.html'), 'utf-8');

function prepaintScript(): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error('no inline script found in app.html');
  return match[1];
}

function runPrepaint() {
  // eslint-disable-next-line no-new-func
  new Function(prepaintScript())();
}

function setSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('pre-paint appearance script', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.style.colorScheme = '';
    setSystemDark(true);
  });

  it('defaults to dark with motion on', () => {
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);
  });

  it('applies an explicit light choice', () => {
    localStorage.setItem('webui.theme', 'light');
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('resolves system to the OS preference', () => {
    localStorage.setItem('webui.theme', 'system');
    setSystemDark(false);
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    setSystemDark(true);
    runPrepaint();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sets data-motion=off when animations are disabled', () => {
    localStorage.setItem('webui.animations', 'false');
    runPrepaint();
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
  });

  it('never throws, because a throw here blanks the page', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('storage disabled');
      },
    });
    expect(() => runPrepaint()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/stores/prepaint.test.ts`
Expected: FAIL — `system` falls back to dark, `data-motion` is never set, and the throwing-localStorage case throws.

- [ ] **Step 3: Replace the inline script in `web/src/app.html`**

```html
    <script>
      /*
        Runs before first paint. routes/+layout.ts sets ssr = false, so this is
        the only opportunity to apply appearance without a flash of the wrong
        theme.

        localStorage is a cache here, not the source of truth -- webui.json is.
        The appearance store reconciles against the server once its query
        resolves. This script exists purely so the first frame is right.

        It must stay dependency-free, synchronous, and wrapped in try/catch: a
        throw here runs before the app mounts and leaves a blank page.
      */
      (() => {
        try {
          const stored = localStorage.getItem('webui.theme');
          const choice =
            stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
          const theme =
            choice === 'system'
              ? matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : choice;
          document.documentElement.classList.toggle('dark', theme === 'dark');
          document.documentElement.style.colorScheme = theme;

          if (localStorage.getItem('webui.animations') === 'false') {
            document.documentElement.setAttribute('data-motion', 'off');
          }
        } catch {
          /* Storage disabled or unavailable: fall through to the CSS defaults
             (dark, motion on) rather than take the page down. */
        }
      })();
    </script>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run src/lib/stores/prepaint.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/app.html web/src/lib/stores/prepaint.test.ts
git commit -m "feat(webui): resolve theme and motion before first paint"
```

---

### Task 11: The appearance store and header toggle

**Files:**
- Create: `web/src/lib/stores/appearance.svelte.ts`
- Create: `web/src/lib/stores/appearance.test.ts`
- Delete: `web/src/lib/stores/theme.svelte.ts`
- Delete: `web/src/lib/stores/theme.test.ts`
- Modify: `web/src/lib/components/shell/ThemeToggle.svelte`
- Modify: `web/src/lib/components/shell/ThemeToggle.test.ts`
- Modify: `web/src/lib/components/LayoutContent.svelte` (mount the query and reconcile)

**Interfaces:**
- Consumes: `ThemeChoice`, `AppearanceSettings` from `$lib/api/types`; `createAppearanceQuery`, `createUpdateAppearanceMutation` from `$lib/api/queries`.
- Produces, from `$lib/stores/appearance.svelte`:
  - `appearance.theme: ThemeChoice` — the user's choice, which may be `'system'`.
  - `appearance.resolvedTheme: 'light' | 'dark'` — what is actually displayed.
  - `appearance.animations: boolean`
  - `appearance.setTheme(next: ThemeChoice): void`
  - `appearance.setAnimations(next: boolean): void`
  - `appearance.toggleTheme(): void` — sets an explicit `'light'` or `'dark'` from `resolvedTheme`, leaving `'system'`.
  - `appearance.acceptRemote(settings: AppearanceSettings): void` — reconcile from the server.
  - `appearance.onChange: ((update: AppearanceUpdateRequest) => void) | null` — assigned by `LayoutContent` to fire the mutation. The store itself performs no I/O, so it stays testable without a query client.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/stores/appearance.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

function setSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? dark : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('appearance store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-motion');
    setSystemDark(true);
    vi.resetModules();
  });

  it('defaults to dark with animations on', async () => {
    const { appearance } = await import('./appearance.svelte');
    expect(appearance.theme).toBe('dark');
    expect(appearance.animations).toBe(true);
  });

  it('applies a theme change to the document and the cache immediately', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('webui.theme')).toBe('light');
  });

  it('resolves system through the OS preference', async () => {
    setSystemDark(false);
    const { appearance } = await import('./appearance.svelte');
    appearance.setTheme('system');
    expect(appearance.theme).toBe('system');
    expect(appearance.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets data-motion=off and caches it when animations are disabled', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.setAnimations(false);
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
    expect(localStorage.getItem('webui.animations')).toBe('false');
  });

  it('removes data-motion when animations are re-enabled', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.setAnimations(false);
    appearance.setAnimations(true);
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);
  });

  it('toggling from system leaves system and picks the opposite explicit theme', async () => {
    setSystemDark(true);
    const { appearance } = await import('./appearance.svelte');
    appearance.setTheme('system');
    expect(appearance.resolvedTheme).toBe('dark');
    appearance.toggleTheme();
    expect(appearance.theme).toBe('light');
  });

  it('notifies onChange with only the field that changed', async () => {
    const { appearance } = await import('./appearance.svelte');
    const seen: unknown[] = [];
    appearance.onChange = (update) => seen.push(update);
    appearance.setTheme('light');
    appearance.setAnimations(false);
    expect(seen).toEqual([{ theme: 'light' }, { animations: false }]);
  });

  it('reconciles from the server and rewrites the cache', async () => {
    const { appearance } = await import('./appearance.svelte');
    appearance.acceptRemote({ theme: 'light', animations: false });
    expect(appearance.theme).toBe('light');
    expect(appearance.animations).toBe(false);
    expect(localStorage.getItem('webui.theme')).toBe('light');
    expect(localStorage.getItem('webui.animations')).toBe('false');
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
  });

  it('does not fire onChange when reconciling from the server', async () => {
    const { appearance } = await import('./appearance.svelte');
    const seen: unknown[] = [];
    appearance.onChange = (update) => seen.push(update);
    appearance.acceptRemote({ theme: 'light', animations: false });
    expect(seen).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/stores/appearance.test.ts`
Expected: FAIL — cannot resolve `./appearance.svelte`.

- [ ] **Step 3: Create `web/src/lib/stores/appearance.svelte.ts`**

```ts
import type { AppearanceSettings, AppearanceUpdateRequest, ThemeChoice } from '$lib/api/types';

export const THEME_STORAGE_KEY = 'webui.theme';
export const ANIMATIONS_STORAGE_KEY = 'webui.animations';

function readTheme(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
}

function readAnimations(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(ANIMATIONS_STORAGE_KEY) !== 'false';
}

function systemPrefersDark(): boolean {
  if (typeof matchMedia !== 'function') return true;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const effective = resolve(choice);
  document.documentElement.classList.toggle('dark', effective === 'dark');
  document.documentElement.style.colorScheme = effective;
}

function applyAnimations(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  // Absence means on, so the attribute is removed rather than set to "on".
  // This mirrors the app.html script, which only ever sets the off case.
  if (enabled) {
    document.documentElement.removeAttribute('data-motion');
  } else {
    document.documentElement.setAttribute('data-motion', 'off');
  }
}

let theme = $state<ThemeChoice>(readTheme());
let animations = $state<boolean>(readAnimations());

applyTheme(theme);
applyAnimations(animations);

// A 'system' choice must track the OS as it changes, not only at load.
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') applyTheme(theme);
  });
}

/**
 * Theme and animation preferences.
 *
 * webui.json is the source of truth; localStorage is a cache that exists so
 * app.html can paint the right frame before any of this runs. Every setter
 * applies to the DOM and the cache immediately and *then* notifies onChange,
 * so the UI never waits on the network to reflect the user's own click.
 *
 * The store performs no I/O itself. LayoutContent assigns onChange to fire the
 * mutation, which keeps this testable without a query client.
 */
export const appearance = {
  get theme(): ThemeChoice {
    return theme;
  },
  get resolvedTheme(): 'light' | 'dark' {
    return resolve(theme);
  },
  get animations(): boolean {
    return animations;
  },

  onChange: null as ((update: AppearanceUpdateRequest) => void) | null,

  setTheme(next: ThemeChoice): void {
    theme = next;
    applyTheme(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, next);
    this.onChange?.({ theme: next });
  },

  setAnimations(next: boolean): void {
    animations = next;
    applyAnimations(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ANIMATIONS_STORAGE_KEY, String(next));
    }
    this.onChange?.({ animations: next });
  },

  /** Toggle used by the header button. Writes an explicit light or dark based
   *  on what is currently displayed, so clicking it while on 'system' leaves
   *  system mode -- which is what a user expects from a two-state control. */
  toggleTheme(): void {
    this.setTheme(resolve(theme) === 'dark' ? 'light' : 'dark');
  },

  /** Reconcile from the server. Deliberately does not fire onChange: this is
   *  the server telling us, so echoing it back would be a write loop. */
  acceptRemote(settings: AppearanceSettings): void {
    theme = settings.theme;
    animations = settings.animations;
    applyTheme(theme);
    applyAnimations(animations);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(ANIMATIONS_STORAGE_KEY, String(animations));
    }
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/lib/stores/appearance.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Update `ThemeToggle.svelte`**

Replace the `theme` import and usage:

```svelte
<script lang="ts">
  import { appearance } from '$lib/stores/appearance.svelte';
  import { Sun, Moon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  const isDark = $derived(appearance.resolvedTheme === 'dark');
  const ariaLabel = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');

  function handleToggle() {
    appearance.toggleTheme();
  }
</script>
```

The markup below is unchanged.

- [ ] **Step 6: Delete the old store and migrate its test**

```bash
git rm web/src/lib/stores/theme.svelte.ts web/src/lib/stores/theme.test.ts
```

The behaviour those tests covered is now in `appearance.test.ts`, with one deliberate inversion: `theme.test.ts` asserted that a stored value of `'system'` is invalid and falls back to dark. Under this design `'system'` is valid, and `appearance.test.ts` asserts it resolves through `matchMedia` instead. Do not carry the old assertion over.

Update `ThemeToggle.test.ts` to import `appearance` instead of `theme`, and to set state via `appearance.setTheme(...)`.

- [ ] **Step 7: Wire the query in `LayoutContent.svelte`**

Add the import alongside the other query imports:

```ts
  import { createAppearanceQuery, createUpdateAppearanceMutation } from '../api/queries';
  import { appearance } from '$lib/stores/appearance.svelte';
```

and near the other query declarations:

```ts
  const appearanceQuery = createAppearanceQuery();
  const updateAppearanceMutation = createUpdateAppearanceMutation();

  // The store performs no I/O of its own; this is where a local change becomes
  // a write. Applying to the DOM already happened inside the setter, so a slow
  // or failed request never delays the user's own click.
  appearance.onChange = (update) => {
    $updateAppearanceMutation.mutate(update);
  };

  // Reconcile the localStorage cache against the server once it answers.
  $effect(() => {
    if ($appearanceQuery.data) {
      appearance.acceptRemote($appearanceQuery.data);
    }
  });
```

Do **not** add `$appearanceQuery.isError` to the existing `isApiError` derived value. A failed appearance fetch must not raise the connection-error banner — the cached values are perfectly usable.

- [ ] **Step 8: Run the suite**

Run: `cd web && npx vitest run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS. Any remaining import of `$lib/stores/theme.svelte` is a compile error — fix each to use `appearance`.

- [ ] **Step 9: Commit**

```bash
git add -A web/src/lib/stores web/src/lib/components/shell/ThemeToggle.svelte web/src/lib/components/shell/ThemeToggle.test.ts web/src/lib/components/LayoutContent.svelte
git commit -m "feat(webui): replace the theme store with a server-backed appearance store"
```

---

### Task 12: The Web UI settings tab

**Files:**
- Create: `web/src/lib/components/settings/WebUiSettingsPanel.svelte`
- Create: `web/src/lib/components/settings/WebUiSettingsPanel.test.ts`
- Modify: `web/src/routes/(app)/general/+page.svelte`
- Modify: `web/src/routes/(app)/general/page.test.ts`

**Interfaces:**
- Consumes: `appearance` from `$lib/stores/appearance.svelte`; `FormPanel`, `Field`, `ValueSelect` from `$lib/components/form`; `Switch` from `$lib/components/ui/switch`.
- Produces: `WebUiSettingsPanel` — no props.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/components/settings/WebUiSettingsPanel.test.ts`:

```ts
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebUiSettingsPanel from './WebUiSettingsPanel.svelte';
import { appearance } from '$lib/stores/appearance.svelte';

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced-motion') ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('WebUiSettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    setReducedMotion(false);
    appearance.setTheme('dark');
    appearance.setAnimations(true);
  });

  it('explains that these settings are not training config', () => {
    render(WebUiSettingsPanel);
    expect(screen.getByText(/not part of your training configuration/i)).toBeInTheDocument();
  });

  it('renders a theme control and an animations switch', () => {
    render(WebUiSettingsPanel);
    expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/animations/i)).toBeInTheDocument();
  });

  it('offers light, dark and system', () => {
    render(WebUiSettingsPanel);
    const select = screen.getByLabelText(/theme/i) as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['light', 'dark', 'system']));
  });

  it('notes that the OS is overriding when reduced motion is requested', () => {
    setReducedMotion(true);
    render(WebUiSettingsPanel);
    expect(screen.getByText(/system is set to reduce motion/i)).toBeInTheDocument();
  });

  it('shows no override note when the OS is not asking for reduced motion', () => {
    render(WebUiSettingsPanel);
    expect(screen.queryByText(/system is set to reduce motion/i)).toBeNull();
  });

  it('leaves the switch settable while the OS override is active', () => {
    setReducedMotion(true);
    render(WebUiSettingsPanel);
    expect(screen.getByLabelText(/animations/i)).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npx vitest run src/lib/components/settings/WebUiSettingsPanel.test.ts`
Expected: FAIL — cannot resolve `./WebUiSettingsPanel.svelte`.

- [ ] **Step 3: Create `web/src/lib/components/settings/WebUiSettingsPanel.svelte`**

```svelte
<script lang="ts">
  import { appearance } from '$lib/stores/appearance.svelte';
  import type { ThemeChoice } from '$lib/api/types';
  import Field from '$lib/components/form/Field.svelte';
  import FormPanel from '$lib/components/form/FormPanel.svelte';
  import ValueSelect from '$lib/components/form/ValueSelect.svelte';
  import { Switch } from '$lib/components/ui/switch';

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  // Read once per render rather than kept in state: the OS setting changes far
  // more rarely than this panel is opened, and a live listener here would
  // duplicate the one the appearance store already owns.
  const osReducesMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<FormPanel>
  <!--
    Every other setting on the General page is training config with
    workspace-draft semantics: edit a draft, it goes dirty, it saves. These two
    are client preferences that apply the instant they are touched and never
    enter the training config. Same page, two contracts -- so this says so.
  -->
  <p class="panel-note">
    These settings affect the OneTrainer web interface only. They are not part of
    your training configuration and apply immediately.
  </p>

  <Field id="appearance-theme" label="Theme">
    {#snippet children({ id })}
      <ValueSelect
        {id}
        ariaLabel="Theme"
        value={appearance.theme}
        options={themeOptions}
        onChange={(next) => appearance.setTheme(next as ThemeChoice)}
      />
    {/snippet}
  </Field>

  <Field id="appearance-animations" label="Animations">
    {#snippet children({ id })}
      <Switch
        {id}
        aria-label="Animations"
        checked={appearance.animations}
        onCheckedChange={(next) => appearance.setAnimations(next)}
      />
    {/snippet}
  </Field>

  {#if osReducesMotion}
    <!-- Without this the switch looks broken: it is on, and nothing moves. -->
    <p class="panel-note">
      Your system is set to reduce motion, so animations stay off regardless of
      this setting.
    </p>
  {/if}
</FormPanel>

<style>
  .panel-note {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    margin: 0 0 0.5rem;
    max-width: 60ch;
  }
</style>
```

Read `FormPanel.svelte`, `Field.svelte` and `ValueSelect.svelte` first and match their actual prop names and snippet signatures — the shapes above follow `Field`'s `children` snippet contract (`Snippet<[{ id, ariaDescribedBy }]>`) but the sibling components' props must be confirmed against their source.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npx vitest run src/lib/components/settings/WebUiSettingsPanel.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the tab to `web/src/routes/(app)/general/+page.svelte`**

Change the sub-tab type and list:

```ts
  type GeneralSubTab = 'workspace' | 'debug' | 'tensors' | 'hardware' | 'webui';

  const subnavTabs: Array<{ id: GeneralSubTab; label: string }> = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'debug', label: 'Debug' },
    { id: 'tensors', label: 'Tensors' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'webui', label: 'Web UI' },
  ];
```

Add the import:

```ts
  import WebUiSettingsPanel from '$lib/components/settings/WebUiSettingsPanel.svelte';
```

And branch the panel body — the schema knows nothing about this tab, so it must not reach `SchemaForm`:

```svelte
      <div class="tab-panel-body">
        {#if activeSubTab === 'webui'}
          <WebUiSettingsPanel />
        {:else}
          <SchemaForm
            {tab}
            {activeSubTab}
            hideGroupTitle={true}
            values={ctx.workspace.draft}
            issues={ctx.workspace.errors}
            setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
            openDirectory={ctx.openDirectory}
          />
        {/if}
      </div>
```

- [ ] **Step 6: Add a page-level test**

Append to `web/src/routes/(app)/general/page.test.ts`, matching that file's existing render helper and mocks:

```ts
it('offers a Web UI sub-tab', async () => {
  render(GeneralPage);
  expect(await screen.findByRole('tab', { name: 'Web UI' })).toBeInTheDocument();
});
```

- [ ] **Step 7: Run the tests**

Run: `cd web && npx vitest run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 8: Verify manually end to end**

Run the backend and `cd web && npm run dev`. Then:
1. Go to General → Web UI. Set Theme to Light. The page changes immediately and the header button's icon flips.
2. Click the header button. The tab's select follows it.
3. Set Theme to System and change your OS theme. The UI follows without a reload.
4. Turn Animations off. Open a modal — it appears with no motion.
5. Hard-reload. Everything is as you left it, with **no flash** of the wrong theme.
6. Check `webui.json` at the repo root — it contains an `appearance` key, and the `password` key is intact.
7. Open the app in a second browser. Your settings are already applied there.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/components/settings "web/src/routes/(app)/general"
git commit -m "feat(webui): add the Web UI settings tab for theme and animations"
```

---

### Task 13: Full verification and documentation

**Files:**
- Modify: `docs/WebUi.md`
- Test: the whole suite

- [ ] **Step 1: Run every test**

```bash
cd web && npx vitest run && npx svelte-check --tsconfig ./tsconfig.json && npx playwright test
cd .. && python -m pytest modules/webui/tests/ -v
```

Expected: all pass. Record any failure and fix it before continuing — do not proceed with a red suite.

- [ ] **Step 2: Confirm the global constraints held**

```bash
cd web && git diff master --stat -- src/lib/components/ui/    # must be empty
git diff master -- package.json                               # dependencies must be unchanged
grep -rn "tw-animate" web/                                    # must find nothing outside comments
```

Expected: no vendored component changed, no dependency added.

- [ ] **Step 3: Verify the kill switch reaches everything**

Run `cd web && npm run dev`, turn Animations off, then exercise: a modal, a dropdown, a tooltip, the rail toggle, the console drawer, a route change, and a toast. Nothing should move. Then set your OS to reduce motion, turn Animations back **on**, and repeat — nothing should move, because the OS vetoes.

- [ ] **Step 4: Document it in `docs/WebUi.md`**

Add a section covering: where the motion scale lives (`--motion-*` in `app.css`), that changing it is a four-line edit, that the two kill switches compose one-way, that `webui.json` now holds an `appearance` key, and that `/api/appearance` serves it.

- [ ] **Step 5: Commit**

```bash
git add docs/WebUi.md
git commit -m "docs(webui): document the motion tokens and appearance settings"
```

---

## Notes for the implementer

**Selector names are the most likely source of failure.** Tasks 2 and 4 assume bits-ui and shadcn emit `data-dialog-overlay`, `data-dropdown-menu-content`, `data-slot="sidebar-gap"` and similar. Those are informed guesses from the vendored source, not verified against a running browser. Each of those tasks includes a step telling you how to enumerate the real attributes if the test fails. Fix the selector in both the CSS and the test — do not weaken the assertion.

**Task 5 is the one with real behavioural risk.** The console drawer stops unmounting, so `ConsoleView` stays alive while closed. Step 7 exists specifically to check this. If it turns out to do continuous work, gate that work on `open`; do not solve it by reverting to `{#if open}`.

**If overlay e2e tests start flaking** after Task 2, the cause is assertions racing a 90ms animation. Prefer Playwright's auto-waiting `expect(locator).toBeVisible()` over immediate `boundingBox()` reads. Do not fix flake by removing the animation.
