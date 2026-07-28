# Post-Cutover UI Defects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven user-reported UI defects that shipped with the shadcn-svelte cutover, tracing each to its root cause rather than its symptom.

**Architecture:** Four independent root causes. The largest is a Tailwind v4 / Bits UI attribute mismatch in the canonical `ui/` layer: bare `data-foo:` variants compile to attribute-*presence* selectors, but Bits UI emits `data-state="..."` values. That single defect kills hover feedback, active-nav highlighting, and every Switch's paint. A second defect in `Dialog.Content` clamps every modal in the app to 336px. The remaining two are local to the datasets and embeddings routes. Each phase lands independently, with a source-lint guard added so the variant mismatch cannot silently return.

**Tech Stack:** Svelte 5, SvelteKit 2, TypeScript, shadcn-svelte/Bits UI, Tailwind CSS v4, Vitest, Testing Library, Playwright, Bun.

---

## Global Constraints

- Baseline is `16d98664`. All commands run from `web/` unless stated otherwise.
- Preserve route URLs, backend payload shapes, saved configuration formats, and persistence keys.
- Phone behaviour is below `768px`; desktop starts at `768px`.
- Do not reintroduce `:global()` selectors or `min-height: 0` — `src/lib/components/style-boundary.test.ts` enforces both.
- Do not modify the untracked `.github/hooks/` directory.
- Add a failing test before each fix. Do not weaken a test to make it pass.

## Environment Notes

Three facts constrain how this work is verified. Violating any of them produces a test that passes for the wrong reason.

1. **jsdom performs no layout.** `getBoundingClientRect()` returns zeros. Element size and position can only be asserted in Playwright.
2. **`src/app.css` is not loaded by `vitest-setup.ts`.** Design tokens do not exist in the jsdom CSSOM, so `getComputedStyle(el).backgroundColor` cannot resolve them. All colour assertions must be Playwright.
3. **Port 7801 may be occupied by the developer's own dev server** (`python scripts/train_ui_web.py --dev`). Check with `ss -lptn 'sport = :7801'`. If it is running, do not kill it and do not point tests at it — clicking a Switch on `/general` autosaves into real user config. Ask the developer to stop it, or run diagnostics against a separate fixture server on a free port:

```bash
python ../tests/webui/e2e_server.py --root .e2e --port 7899
```

## Root Cause Reference

All values below were measured at a 1280x720 viewport against the fixture server. Re-measure before fixing; do not take them on faith.

| Symptom | Root cause | Measured evidence |
|---|---|---|
| Hover invisible; active nav not distinguishable | `data-active:` compiles to `[data-active]`, a presence selector. `SidebarMenuButton` emits `data-active="false"`, which matches. | `/general` (active), `/datasets`, `/live` (inactive) all paint `rgb(31,42,55)`. Hover delta 0 in dark and light. |
| "Checkboxes" never check | These are `Switch`. Its `data-checked:` / `data-unchecked:` compile to `[data-checked]` / `[data-unchecked]`; Bits UI emits `data-state`. | `backgroundColor` is `rgba(0,0,0,0)` before **and** after clicking, while `data-state` flips `unchecked`→`checked`. |
| Concepts checkboxes *do* work | `Checkbox` uses `data-[state=checked]:bg-primary` — the correct value-based form. | Toggles correctly on `/sampling` and `/concepts`. Use as the reference pattern. |
| Concept modal too narrow, content spills | `Dialog.Content` base contains `sm:max-w-sm`. A consumer's unmodified `max-w-4xl` is a different tailwind-merge key, so both survive; the `sm:`-wrapped rule is emitted later and wins at >=640px. | Modal measured **336px** wide (`max-width: 336px`). `max-w-sm` = 24rem, root font-size 14px, 24 x 14 = 336. |
| Dataset click blanks the page and reloads | `DatasetCollection.svelte:83` uses `window.location.href`. `goto()` appears nowhere in the codebase. | A marker set on `window` before the click is `GONE` after. |
| Datasets renders a list | Desktop branch renders `Table`/`Table.Row`. **Intentional** — see Task 9. | — |
| Embeddings content floats centred | Its scoped `.route-page` has `max-width:1200px; margin:0 auto`. The other five routes that define `.route-page` use only `padding:1.5rem`. | Measured `maxWidth:1200px`, `margin:0px 2px`. |
| Gallery modal missing image and nav | **Not reproduced** — fixture server has no gallery images. Hypothesis: same 336px clamp. | See Task 10. |

Generated CSS proving the variant mismatch:

```
.data-active\:bg-sidebar-accent[data-active]{background-color:var(--sidebar-accent)}
.data-checked\:bg-primary[data-checked]{background-color:var(--primary)}
.data-unchecked\:bg-input[data-unchecked]{background-color:var(--input)}
```

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/lib/components/ui-variant-boundary.test.ts` | Source lint forbidding bare `data-*:` variants in `ui/`, with a verified allowlist |
| `e2e/paint-states.spec.ts` | Browser tests asserting hover, active-nav, and switch actually change computed colour |

**Modified:** listed per task.

---

## Phase 1 — The `data-*` variant mismatch

### Task 1: Prove the mismatch and pin the real attributes

**Files:**
- Create: `web/e2e/paint-states.spec.ts`

**Interfaces:**
- Three browser tests asserting computed `backgroundColor` differs between states.
- All three must fail against current code before any fix.

- [ ] **Step 1: Write the failing paint tests**

Create `web/e2e/paint-states.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Interactive state paint", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("active and inactive nav items paint differently", async ({ page }) => {
    await page.goto("/general");
    const active = await page
      .locator('a[href="/general"]')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    const inactive = await page
      .locator('a[href="/datasets"]')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(active).not.toBe(inactive);
  });

  test("nav item changes colour on hover in dark theme", async ({ page }) => {
    await page.goto("/general");
    const el = page.locator('a[href="/datasets"]');
    const rest = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    await el.hover();
    await page.waitForTimeout(250);
    const hover = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(hover).not.toBe(rest);
  });

  test("nav item changes colour on hover in light theme", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: /switch to light theme/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const el = page.locator('a[href="/datasets"]');
    const rest = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    await el.hover();
    await page.waitForTimeout(250);
    const hover = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(hover).not.toBe(rest);
  });

  test("switch paints differently when toggled", async ({ page }) => {
    await page.goto("/general");
    const sw = page.locator('[data-slot="switch"]').first();
    await expect(sw).toBeVisible();
    const before = await sw.evaluate((e) => getComputedStyle(e).backgroundColor);
    await sw.click();
    await page.waitForTimeout(300);
    const after = await sw.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(after).not.toBe(before);
  });
});
```

- [ ] **Step 2: Register the spec in the desktop project**

In `web/playwright.config.ts`, add `paint-states` to `chromium-desktop.testMatch`:

```ts
      testMatch: /phase-a|phase-b|phase-c|console|theme|responsive-workflows|accessibility|visual|paint-states/,
```

- [ ] **Step 3: Run and verify all four fail**

```bash
bun run build
bunx playwright test e2e/paint-states.spec.ts --project=chromium-desktop
```

Expected: 4 failed. The nav tests report identical `rgb(31, 42, 55)` for both states; the switch test reports `rgba(0, 0, 0, 0)` for both.

- [ ] **Step 4: Record what attributes Bits UI actually emits**

Do not guess from variant names. Dump the real attributes for each affected primitive. Add this temporary test to `paint-states.spec.ts`, run it, record the output in your notes, then delete the test before committing:

```ts
  test("TEMP attribute dump", async ({ page }) => {
    await page.goto("/general");
    const dump = async (sel: string) => {
      const el = page.locator(sel).first();
      if (!(await el.count())) return { sel, missing: true };
      return el.evaluate((e) => ({
        tag: e.tagName,
        attrs: Object.fromEntries(Array.from(e.attributes).map((a) => [a.name, a.value])),
      }));
    };
    console.log(JSON.stringify({
      switch: await dump('[data-slot="switch"]'),
      navItem: await dump('a[href="/datasets"]'),
      slider: await dump('[data-slot="slider"]'),
    }, null, 2));
  });
```

Known from prior measurement, to confirm rather than assume:

- Switch root: `data-state="checked"|"unchecked"`, `aria-checked`. No `data-checked`/`data-unchecked`.
- Dialog content: `data-state="open"|"closed"`. No `data-open`/`data-closed`.
- Nav item: `data-active="true"|"false"` — emitted by our own `SidebarMenuButton`, always present.

- [ ] **Step 5: Commit the failing tests**

```bash
git add web/e2e/paint-states.spec.ts web/playwright.config.ts
git commit -m "test(web): assert interactive states actually change colour"
```

Committing red is intentional here: it records the defect. Phase 1 turns it green.

---

### Task 2: Fix the Switch

**Files:**
- Modify: `web/src/lib/components/ui/switch/switch.svelte:44`

**Interfaces:**
- Switch paints `--primary` when checked and `--input` when unchecked, driven by `data-state`.

- [ ] **Step 1: Replace the presence variants with value variants**

In `web/src/lib/components/ui/switch/switch.svelte`, in the root `cn(...)` class string, replace:

```
data-checked:bg-primary data-unchecked:bg-input
```

with:

```
data-[state=checked]:bg-primary data-[state=unchecked]:bg-input
```

and replace:

```
dark:data-unchecked:bg-input/80
```

with:

```
dark:data-[state=unchecked]:bg-input/80
```

This matches the pattern `checkbox.svelte` already uses successfully (`data-[state=checked]:bg-primary`).

- [ ] **Step 2: Fix the thumb translation classes**

Still in `switch.svelte`, the thumb span uses `data-checked:` / `data-unchecked:` for its transform. Replace:

```
group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]
group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]
group-data-[size=default]/switch:data-unchecked:translate-x-0
group-data-[size=sm]/switch:data-unchecked:translate-x-0
```

with the `data-[state=...]` equivalents:

```
group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]
group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]
group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0
group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0
```

Verify against the file's actual current content — the exact class list may differ. Convert every `data-checked:` and `data-unchecked:` occurrence in the file.

- [ ] **Step 3: Verify the switch test passes**

```bash
bun run build
bunx playwright test e2e/paint-states.spec.ts --project=chromium-desktop -g "switch"
```

Expected: PASS. The thumb should also visibly slide — confirm by eye or with a screenshot.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/components/ui/switch/switch.svelte
git commit -m "fix(web): drive switch paint from data-state"
```

---

### Task 3: Fix nav active and hover state

**Files:**
- Modify: `web/src/lib/components/ui/sidebar/sidebar-menu-button.svelte:64`
- Modify: `web/src/lib/components/shell/RailContent.svelte:140,146`

**Interfaces:**
- `data-active` is absent when the item is inactive, so `[data-active]` matches only genuinely active items.
- Exactly one hover background declaration survives on the nav anchor.

- [ ] **Step 1: Omit the attribute when inactive**

In `web/src/lib/components/ui/sidebar/sidebar-menu-button.svelte`, change the `buttonProps` derived object:

```ts
	const buttonProps = $derived({
		class: cn(sidebarMenuButtonVariants({ variant, size }), className),
		"data-slot": "sidebar-menu-button",
		"data-sidebar": "menu-button",
		"data-size": size,
		"data-active": isActive ? "true" : undefined,
		...restProps,
	});
```

Svelte renders `data-active="false"` for a boolean `false` on a `data-*` attribute, which is why the presence selector matched every item. `undefined` omits the attribute entirely.

- [ ] **Step 2: Apply the same fix to the sub-button**

`web/src/lib/components/ui/sidebar/sidebar-menu-sub-button.svelte` also uses `data-active:` variants. Check how it emits the attribute and apply the identical `isActive ? "true" : undefined` treatment. If it does not emit `data-active` at all, leave it alone and note that in your report.

- [ ] **Step 3: Resolve the duplicate hover declaration**

`RailContent.svelte` puts `hover:bg-muted hover:text-foreground` on the nav anchor, but `props.class` from `SidebarMenuButton` is merged last, so tailwind-merge drops it in favour of `hover:bg-sidebar-accent`. Confirm first:

```bash
bunx playwright test e2e/paint-states.spec.ts --project=chromium-desktop -g "hover in dark"
```

and inspect the rendered class list — `hover:bg-muted` is absent today.

Keep the canonical sidebar hover and remove the dead one. In `RailContent.svelte`, delete `hover:bg-muted hover:text-foreground` from the enabled nav anchor's class string (around line 140). Leave `text-muted-foreground` and the rest intact. Do not leave two competing hover declarations in the file.

- [ ] **Step 4: Verify hover now produces a visible delta**

```bash
bun run build
bunx playwright test e2e/paint-states.spec.ts --project=chromium-desktop
```

Expected: all four PASS.

If hover technically changes colour but is still too faint to see, stop and report the measured before/after values rather than adjusting `--sidebar-accent`. Retuning the palette is a design decision, not part of this fix.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/ui/sidebar/sidebar-menu-button.svelte web/src/lib/components/ui/sidebar/sidebar-menu-sub-button.svelte web/src/lib/components/shell/RailContent.svelte
git commit -m "fix(web): emit data-active only when active"
```

---

### Task 4: Sweep the remaining bare `data-*` variants and add a guard

**Files:**
- Modify: `web/src/lib/components/ui/dialog/dialog-content.svelte`, `dialog/dialog-overlay.svelte`, `alert-dialog/alert-dialog-content.svelte`, `alert-dialog/alert-dialog-overlay.svelte`, `sheet/sheet-content.svelte`, `drawer/drawer-overlay.svelte`, `tooltip/tooltip-content.svelte`, `dropdown-menu/dropdown-menu-content.svelte`, `dropdown-menu/dropdown-menu-sub-content.svelte`, `dropdown-menu/dropdown-menu-sub-trigger.svelte`, `sidebar/sidebar-menu-action.svelte`, `tabs/tabs-trigger.svelte`, `slider/slider.svelte`, `scroll-area/scroll-area-scrollbar.svelte`
- Create: `web/src/lib/components/ui-variant-boundary.test.ts`

**Interfaces:**
- Every `data-*` variant in `ui/` either uses the value-based form or is on a verified presence allowlist.
- A Vitest source lint fails the build if a new bare variant appears.

- [ ] **Step 1: Write the failing guard test**

Create `web/src/lib/components/ui-variant-boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const uiSources = import.meta.glob('/src/lib/components/ui/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Tailwind v4 compiles a bare `data-foo:` variant to `[data-foo]` — an attribute
 * PRESENCE selector. Bits UI mostly emits `data-state="..."` values instead, so a
 * bare variant silently never matches (or matches always, when we emit the
 * attribute with a "false" value). Only these are verified real presence
 * attributes and may be used bare.
 */
const PRESENCE_ATTRIBUTES = ['disabled', 'inset', 'selected', 'placeholder'];

export function findBareDataVariants(source: string, filename: string): string[] {
  const violations: string[] = [];
  // Matches `data-foo:` but not `data-[foo=bar]:`
  const bare = /(?<![[\w-])data-([a-z][a-z0-9-]*):/g;
  let m: RegExpExecArray | null;
  while ((m = bare.exec(source)) !== null) {
    const attr = m[1];
    if (PRESENCE_ATTRIBUTES.includes(attr)) continue;
    violations.push(`${filename}: bare variant data-${attr}: matches [data-${attr}] by presence`);
  }
  return violations;
}

describe('UI data-variant boundary', () => {
  it('flags a bare variant in fixture source', () => {
    expect(findBareDataVariants('class="data-checked:bg-primary"', '/x.svelte')).toHaveLength(1);
  });

  it('allows the value-based form', () => {
    expect(findBareDataVariants('class="data-[state=checked]:bg-primary"', '/x.svelte')).toEqual([]);
  });

  it('allows verified presence attributes', () => {
    expect(findBareDataVariants('class="data-disabled:opacity-50"', '/x.svelte')).toEqual([]);
  });

  it('has no bare data variants anywhere in ui/', () => {
    const violations = Object.entries(uiSources).flatMap(([file, source]) =>
      findBareDataVariants(source, file)
    );
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify the sweep fails**

```bash
bun run test -- src/lib/components/ui-variant-boundary.test.ts
```

Expected: the three fixture tests PASS; "has no bare data variants anywhere in ui/" FAILS listing roughly 100 violations across `data-open`, `data-closed`, `data-active`, `data-vertical`, `data-horizontal`.

- [ ] **Step 3: Convert open/closed variants**

In every file listed under **Files** above that uses them, replace:

| Bare | Value-based |
|---|---|
| `data-open:` | `data-[state=open]:` |
| `data-closed:` | `data-[state=closed]:` |

This covers 32 `data-open:` and 28 `data-closed:` occurrences and restores dialog, sheet, drawer, dropdown, and tooltip enter/exit animations, which are currently dead.

Note the compound forms in `sheet-content.svelte`, e.g. `data-[side=left]:data-open:slide-in-from-left-10` becomes `data-[side=left]:data-[state=open]:slide-in-from-left-10`.

- [ ] **Step 4: Convert orientation variants**

In `slider/slider.svelte` and `scroll-area/scroll-area-scrollbar.svelte`, replace:

| Bare | Value-based |
|---|---|
| `data-vertical:` | `data-[orientation=vertical]:` |
| `data-horizontal:` | `data-[orientation=horizontal]:` |

Confirm the real attribute first by rendering a slider and dumping its attributes, as in Task 1 Step 4. There is no slider on `/training`; find a route that renders one (search for `Slider` usage under `src/`) or mount it in a scratch Playwright page. If Bits UI turns out to emit something other than `data-orientation`, use whatever it actually emits.

- [ ] **Step 5: Convert the remaining active variants**

`tabs/tabs-trigger.svelte` and `sidebar/sidebar-menu-action.svelte` use `data-active:` / `data-open:`. For `tabs-trigger`, Bits UI controls the attribute — dump it and convert to whichever value form is correct. Do not assume it matches the sidebar's convention, which we emit ourselves.

- [ ] **Step 6: Verify the guard and the full suite**

```bash
bun run test
bun run check
bun run build
bunx playwright test --project=chromium-desktop
bunx playwright test --project=chromium-phone
```

Expected: `ui-variant-boundary.test.ts` fully green, `paint-states.spec.ts` green, check 0 errors 0 warnings.

Dialog and dropdown visual baselines may change now that animations run. Because screenshots are taken with `animations: "disabled"`, they should not — if one does change, inspect it before regenerating.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/ui web/src/lib/components/ui-variant-boundary.test.ts
git commit -m "fix(web): use value-based data-state variants throughout canonical UI"
```

---

## Phase 2 — Modal width

### Task 5: Stop `Dialog.Content` clamping every modal to 336px

**Files:**
- Modify: `web/src/lib/components/ui/dialog/dialog-content.svelte:31`

**Interfaces:**
- A consumer's unmodified `max-w-*` wins over the component default.
- The dialog still never exceeds the viewport on small screens.

**Context:** six consumers currently pass a width that is silently ignored — `SampleDetailModal.svelte:117` (`max-w-xl`), `routes/sampling/+page.svelte:381` (`max-w-md`), `DatasetPickerModal.svelte:67` (`max-w-3xl`), `OptimizerParamsModal.svelte:193` (`max-w-4xl`), `GalleryImageViewer.svelte:181` (`max-w-4xl`), `ConceptDetailModal.svelte:153` (`max-w-4xl`). Every one renders at 336px.

- [ ] **Step 1: Write the failing width test**

Create `web/e2e/dialog-width.spec.ts` and add `dialog-width` to `chromium-desktop.testMatch` in `web/playwright.config.ts`, alongside `paint-states` from Task 1:

```ts
import { test, expect } from "@playwright/test";

test.describe("Dialog width", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("a dialog honours a consumer max-w override", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(box!.width).toBeGreaterThan(600);
  });

  test("a dialog still fits inside a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
  });
});
```

- [ ] **Step 2: Run and verify the first test fails**

```bash
bun run build
bunx playwright test e2e/dialog-width.spec.ts --project=chromium-desktop
```

Expected: "honours a consumer max-w override" FAILS, reporting a width of 336. The phone test should already pass.

- [ ] **Step 3: Make the default overridable**

In `web/src/lib/components/ui/dialog/dialog-content.svelte`, in the base class string, replace:

```
grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 text-sm ring-1 duration-100 sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none
```

with:

```
grid w-[calc(100%-2rem)] max-w-sm gap-4 rounded-xl p-4 text-sm ring-1 duration-100 fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none
```

Three changes, each deliberate:

- `sm:max-w-sm` is removed. It was in a different tailwind-merge key from a consumer's `max-w-4xl`, so both survived and the media-query rule won.
- The default cap becomes the unmodified `max-w-sm`, which lives in the *same* key as consumer overrides, so tailwind-merge resolves it correctly and the consumer wins.
- `max-w-[calc(100%-2rem)]` becomes `w-[calc(100%-2rem)]` (replacing `w-full`), so the viewport clamp now lives on `width` and no longer competes with `max-width`.

Result: width is `min(100% - 2rem, <consumer cap or 24rem>)`.

- [ ] **Step 4: Verify both tests pass**

```bash
bun run build
bunx playwright test e2e/dialog-width.spec.ts --project=chromium-desktop
```

Expected: both PASS. Open `/concepts` and confirm by eye that the concept modal's content no longer overflows its panel.

- [ ] **Step 5: Check the other five consumers**

Open each and confirm it now renders at its intended width and its content fits: `SampleDetailModal`, the sampling page dialog, `DatasetPickerModal`, `OptimizerParamsModal`, `GalleryImageViewer`. Report any that still look wrong — do not patch them individually.

- [ ] **Step 6: Check the sibling primitives**

`alert-dialog-content.svelte:27` has `data-[size=default]:sm:max-w-sm` and `sheet-content.svelte:38` has `data-[side=left]:sm:max-w-sm` / `data-[side=right]:sm:max-w-sm` — the same trap. Search for consumers passing `max-w-*` to `AlertDialog.Content` or to `ResponsiveDialogSheet`:

```bash
rg -n "AlertDialog.Content|ResponsiveDialogSheet" src --glob '*.svelte' -A3 | grep -n "max-w-"
```

If no consumer is affected, leave both files alone and note it in your report. Do not pre-emptively refactor primitives with no broken consumer.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/ui/dialog/dialog-content.svelte web/e2e/dialog-width.spec.ts web/playwright.config.ts
git commit -m "fix(web): let dialog consumers override the default max width"
```

---

## Phase 3 — Datasets route

### Task 6: Restore SPA navigation

**Files:**
- Modify: `web/src/lib/components/datasets/DatasetCollection.svelte:83`
- Create test in: `web/e2e/responsive-workflows.spec.ts`

**Interfaces:**
- Opening a dataset performs a client-side transition; the document is never reloaded.
- Middle-click, ctrl-click, and "open in new tab" continue to work.

- [ ] **Step 1: Write the failing navigation test**

Add to `web/e2e/responsive-workflows.spec.ts`, inside the desktop describe block:

```ts
    test("opening a dataset does not reload the document", async ({ page }) => {
      await page.goto("/datasets");
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => {
        (window as any).__spaMarker = "alive";
      });

      const target = page.locator("tbody tr, [data-dataset-card]").first();
      await expect(target).toBeVisible();
      await target.click();

      await page.waitForURL(/\/datasets\/.+/);
      const marker = await page.evaluate(() => (window as any).__spaMarker ?? "GONE");
      expect(marker).toBe("alive");
    });
```

- [ ] **Step 2: Run and verify it fails**

```bash
bun run build
bunx playwright test e2e/responsive-workflows.spec.ts --project=chromium-desktop -g "does not reload"
```

Expected: FAIL with `Expected: "alive" / Received: "GONE"`.

- [ ] **Step 3: Replace the imperative navigation with a link**

`DatasetCollection.svelte:83` currently reads:

```svelte
<Table.Row class="hover:bg-muted/50 cursor-pointer" onclick={() => window.location.href = `/datasets/${encodeURIComponent(ds.name)}`}>
```

`window.location.href` triggers a full document navigation, which is why the page blanks and the whole app re-boots.

Prefer a real anchor over a click handler, so middle-click, ctrl-click, and right-click "open in new tab" keep working — a `goto()` inside `onclick` silently breaks all three. Make the dataset name cell an `<a href="/datasets/{encodeURIComponent(ds.name)}">` that stretches across the row, and drop the row-level `onclick`:

```svelte
<Table.Row class="hover:bg-muted/50">
  <Table.Cell>
    <a
      href="/datasets/{encodeURIComponent(ds.name)}"
      class="no-underline text-foreground hover:underline"
    >
      {ds.name}
    </a>
  </Table.Cell>
  <!-- remaining cells unchanged -->
</Table.Row>
```

Keep the existing delete button's `e.stopPropagation()` so it does not follow the link.

If Task 7 replaces the table with cards, that card link supersedes this markup — do Task 6 first anyway, so the navigation fix is isolated in its own commit and independently bisectable.

- [ ] **Step 4: Verify the test passes**

```bash
bun run build
bunx playwright test e2e/responsive-workflows.spec.ts --project=chromium-desktop -g "does not reload"
```

Expected: PASS.

- [ ] **Step 5: Verify the back link**

The detail page's back link (`web/src/routes/datasets/[id]/+page.svelte:88`) is already a plain `<a href="/datasets">`, which SvelteKit intercepts. Navigate into a dataset and back, and confirm no reload. If it still reloads, stop and report — that is a separate defect this task does not cover.

- [ ] **Step 6: Confirm no other imperative navigation remains**

```bash
rg -n "window.location.href|location.assign" src --glob '*.svelte'
```

Expected: only `routes/login/+page.svelte:36`, which is a deliberate post-login full reload. Leave it.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/datasets/DatasetCollection.svelte web/e2e/responsive-workflows.spec.ts
git commit -m "fix(web): navigate to datasets client-side"
```

---

### Task 7: Restore the desktop card gallery

**Files:**
- Modify: `web/src/lib/components/datasets/DatasetCollection.svelte`
- Modify: `web/src/lib/components/datasets/DatasetCollection.test.ts`
- Modify: `web/e2e/visual.spec.ts:34-56`
- Replace: `web/e2e/visual.spec.ts-snapshots/dataset-collection-desktop-table-chromium-desktop-linux.png`
- Modify: `docs/superpowers/plans/2026-07-28-shadcn-svelte-review-fixes.md`

**This reverses an earlier deliberate decision.** `2026-07-28-shadcn-svelte-review-fixes.md` Task 7 specified "DatasetCollection renders canonical Table at 768px and above and visible-action Cards below 768px." The product owner has since asked for the pre-cutover card gallery back on desktop. Update the record as well as the code so the two do not contradict each other.

- [ ] **Step 1: Update the unit test to expect cards**

In `web/src/lib/components/datasets/DatasetCollection.test.ts`, find the desktop describe block asserting `screen.getByRole('table')`. Replace the table assertion with a card assertion:

```ts
    it('renders a card gallery and no table on desktop', () => {
      mockIsMobile.current = false;
      render(DatasetCollection, { props: { datasets: mockDatasets } });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByText('Dataset Alpha')).toBeInTheDocument();
      expect(screen.getByText('Dataset Beta')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /Dataset (Alpha|Beta)/ })).toHaveLength(2);
    });
```

Match the existing file's mocking style for `isMobile` — copy it from the phone describe block in the same file.

- [ ] **Step 2: Run and verify it fails**

```bash
bun run test -- src/lib/components/datasets/DatasetCollection.test.ts
```

Expected: FAIL — a table is still present.

- [ ] **Step 3: Render cards at both breakpoints**

The phone branch already renders exactly the gallery that is wanted. Collapse the `{#if isDesktop} ... {:else} ... {/if}` split so this one block renders unconditionally, and delete the table branch along with the now-unused `Table` import and the `isDesktop` state:

```svelte
<div class="datasets-grid grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
  <AddCard label="Add Dataset" onClick={onAdd} />

  {#each datasets as ds (ds.name)}
    <a href="/datasets/{encodeURIComponent(ds.name)}" class="dataset-card-link no-underline text-inherit flex flex-col">
      <Card.Root class="card relative group overflow-hidden bg-card border border-border rounded-lg flex flex-col h-[220px] p-0 transition-all hover:border-primary hover:-translate-y-0.5">
        <div class="relative flex-1 bg-muted overflow-hidden">
          {#if ds.thumbnail_url}
            <img src={ds.thumbnail_url} alt={ds.name} class="w-full h-full object-cover" />
          {/if}
          <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-end">
            <span class="font-semibold text-white text-sm drop-shadow">{ds.name}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="btn-delete absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-destructive border-none p-2 rounded cursor-pointer opacity-100"
            aria-label="Delete dataset"
            title="Delete dataset"
            disabled={isDeleting || isPendingDelete}
            onclick={(e: MouseEvent) => promptDelete(e, ds.name)}
          >
            <Trash2 size={18} />
          </Button>
        </div>
        <Card.Footer class="p-2.5 bg-card border-t border-border">
          <Badge variant="secondary" class="text-xs text-muted-foreground">
            {ds.image_count} {ds.image_count === 1 ? 'image' : 'images'} • {ds.caption_count} {ds.caption_count === 1 ? 'caption' : 'captions'}
          </Badge>
        </Card.Footer>
      </Card.Root>
    </a>
  {/each}
</div>
```

This markup is copied verbatim from the current phone branch, so it already satisfies Task 6 (the card is a real `<a href>`), keeps the delete button visible without hover with its 44px target, and keeps `promptDelete(e, ds.name)` — which already calls `e.stopPropagation()` and `e.preventDefault()`.

Removing `isDesktop` also removes this component's private `matchMedia` listener. Confirm nothing else in the file reads `isDesktop` before deleting it.

Do not add a breakpoint-varying grid template. `repeat(auto-fill, minmax(220px, 1fr))` already yields more columns on wider viewports, which is the whole point of `auto-fill`.

- [ ] **Step 4: Update the visual test and its baseline**

In `web/e2e/visual.spec.ts`, the desktop case named `dataset collection desktop table` asserts `await expect(page.getByRole("table")).toBeVisible();`. Rename it to `dataset collection desktop cards`, change the assertion to `await expect(page.locator(".datasets-grid")).toBeVisible();`, and change the screenshot name to `dataset-collection-desktop-cards.png`.

Delete the now-unused baseline:

```bash
git rm web/e2e/visual.spec.ts-snapshots/dataset-collection-desktop-table-chromium-desktop-linux.png
```

- [ ] **Step 5: Record the reversal in the earlier plan**

In `docs/superpowers/plans/2026-07-28-shadcn-svelte-review-fixes.md`, under Task 7, add a note directly beneath the Interfaces bullet about the Table:

```markdown
> **Superseded 2026-07-28:** desktop now renders the card gallery, not a Table.
> Reversed by `docs/superpowers/plans/2026-07-28-post-cutover-ui-defects.md` Task 7
> at the product owner's request. The Table was a regression from the pre-cutover UI.
```

- [ ] **Step 6: Regenerate the baseline and verify**

```bash
bun run test
bun run check
bun run build
bunx playwright test e2e/visual.spec.ts --project=chromium-desktop --update-snapshots
bunx playwright test --project=chromium-desktop
bunx playwright test --project=chromium-phone
```

Open the new `dataset-collection-desktop-cards` image and confirm it shows a card grid containing "Seeded Dataset 1", not a table. Confirm `e2e/touch-targets.spec.ts` still passes on `/datasets` at phone width.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/datasets web/e2e/visual.spec.ts web/e2e/visual.spec.ts-snapshots docs/superpowers/plans
git commit -m "feat(web): restore dataset card gallery on desktop"
```

---

## Phase 4 — Embeddings layout

### Task 8: Stop the embeddings route centring its content

**Files:**
- Modify: `web/src/routes/embeddings/+page.svelte:228-237`

**Interfaces:**
- `.route-page` on `/embeddings` matches the convention used by the other five routes that define it.

- [ ] **Step 1: Confirm embeddings is the outlier**

```bash
for f in embeddings training model lora general backup; do
  echo "-- $f --"
  sed -n '/^  \.route-page {/,/^  }/p' src/routes/$f/+page.svelte
done
```

Expected: `training`, `model`, `lora`, `general`, and `backup` all declare only `padding: 1.5rem`. `embeddings` additionally declares `max-width: 1200px` and `margin: 0 auto`, which is what centres it with gutters on wide monitors.

If that expectation does not hold — if most routes constrain and centre and `general` is the outlier — STOP and report. The correct fix would then be the opposite of this task, and that is a decision for the product owner, not a six-file edit.

- [ ] **Step 2: Remove the centring**

In `web/src/routes/embeddings/+page.svelte`, change the `.route-page` rule from:

```css
  .route-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
```

to:

```css
  .route-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
  }
```

`max-width`, `margin`, `width`, and `box-sizing` all go. The flex column and gap stay — those are this route's own layout, not the centring.

Do not refactor `.route-page` into a shared component or utility class. Six routes each declaring it is pre-existing duplication and outside this fix.

- [ ] **Step 3: Verify at two viewport widths**

```bash
bun run build
bunx playwright test --project=chromium-desktop
```

Then measure manually and record the numbers for your report:

```bash
python ../tests/webui/e2e_server.py --root .e2e --port 7899 &
```

Load `/embeddings` at 1280px and at 2560px and confirm `.route-page` starts at the left content edge at both, rather than floating centred at 2560px.

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/embeddings/+page.svelte
git commit -m "fix(web): align embeddings page width with other routes"
```

---

## Phase 5 — Gallery viewer

### Task 9: Reproduce and fix the gallery image modal

**Files:**
- Modify: `web/src/lib/components/training/GalleryImageViewer.svelte` (only if Step 3 confirms a defect remains)
- Create: `web/e2e/gallery-viewer.spec.ts`

**This defect was never reproduced.** The e2e fixture server returns no gallery images, so the reported "modal opens without the image component and nav components not showing" could not be observed. The leading hypothesis is that Task 5 already fixed it: `GalleryImageViewer.svelte:181` passes the same `max-w-4xl` that measured 336px on `ConceptDetailModal`, and at 336px its inner `grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 min-h-[400px]` cannot fit a 300px sidebar beside an image, while the stage's `overflow-hidden` would clip the image and the `absolute`-positioned prev/next buttons.

- [ ] **Step 1: Write a test that seeds gallery data**

Create `web/e2e/gallery-viewer.spec.ts`. Three endpoints back this route (`src/lib/api/client.ts:258-263`):

```
GET /api/gallery/runs                 -> GalleryRunsResponse
GET /api/gallery/runs/:runKey         -> GalleryRunModel
GET /api/gallery/current              -> GalleryRunModel
GET /api/gallery/runs/:runKey/images/:filename   -> image bytes
```

`GalleryRunModel` is consumed by `GalleryImageViewer.svelte` as `batches[]` (each with `expected_prompt_ids`, `expected_variants`, `prompt_revision_id`, and `samples[]` keyed by `webui_prompt_id` + `variant` + `status`) plus a `revisions` map whose `prompts[]` carry `webui_id`, `prompt`, `negative_prompt`, `width`, `height`, `diffusion_steps`, `cfg_scale`, `noise_scheduler`, and `seed`.

Start from this fixture and reconcile every field against the real definitions in `src/lib/api/types.ts` before running — if a required field is missing the component renders nothing and the test would fail for the wrong reason:

```ts
const RUN_KEY = "fixture-run";
const GALLERY = {
  run_key: RUN_KEY,
  revisions: {
    rev1: {
      prompts: [
        {
          webui_id: "p1",
          prompt: "a fixture prompt",
          negative_prompt: "",
          width: 512,
          height: 512,
          diffusion_steps: 30,
          cfg_scale: 7.5,
          noise_scheduler: "EULER_A",
          seed: 1234,
        },
      ],
    },
  },
  batches: [
    {
      id: 1,
      prompt_revision_id: "rev1",
      expected_prompt_ids: ["p1"],
      expected_variants: ["default"],
      samples: [
        { webui_prompt_id: "p1", variant: "default", status: "available", filename: "a.png" },
      ],
    },
    {
      id: 2,
      prompt_revision_id: "rev1",
      expected_prompt_ids: ["p1"],
      expected_variants: ["default"],
      samples: [
        { webui_prompt_id: "p1", variant: "default", status: "available", filename: "b.png" },
      ],
    },
  ],
};

// A 1x1 transparent PNG, so image requests resolve without real files on disk.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
```

Two batches are deliberate: the prev/next controls are only meaningful when a timeline has more than one entry.

Then write:

```ts
import { test, expect } from "@playwright/test";

test.describe("Gallery image viewer", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("opening an image shows the image and both nav controls", async ({ page }) => {
    await page.route("**/api/gallery/runs", (route) =>
      route.fulfill({ status: 200, json: { runs: [{ run_key: RUN_KEY, label: "Fixture Run" }] } })
    );
    await page.route("**/api/gallery/current", (route) =>
      route.fulfill({ status: 200, json: GALLERY })
    );
    await page.route(`**/api/gallery/runs/${RUN_KEY}`, (route) =>
      route.fulfill({ status: 200, json: GALLERY })
    );
    await page.route("**/api/gallery/runs/*/images/*", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG })
    );

    await page.goto("/gallery");
    await page.waitForLoadState("networkidle");

    const thumb = page.locator("main img").first();
    await expect(thumb).toBeVisible();
    await thumb.click();

    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();

    const full = dlg.locator("img").first();
    await expect(full).toBeVisible();
    const imgBox = await full.boundingBox();
    expect(imgBox!.width).toBeGreaterThan(200);
    expect(imgBox!.height).toBeGreaterThan(200);

    await expect(dlg.getByRole("button", { name: /previous/i })).toBeVisible();
    await expect(dlg.getByRole("button", { name: /next/i })).toBeVisible();
  });
});
```

Match the prev/next accessible names to whatever `GalleryImageViewer.svelte` actually sets — read lines 218 to 240 and use the real `aria-label` values.

Register the spec in `chromium-desktop.testMatch` in `playwright.config.ts`.

- [ ] **Step 2: Run it against the current code**

```bash
bun run build
bunx playwright test e2e/gallery-viewer.spec.ts --project=chromium-desktop
```

- [ ] **Step 3: Branch on the result**

**If it PASSES:** Task 5 already fixed this. Do not change `GalleryImageViewer.svelte`. Commit the test as a regression guard and record in your report that the gallery symptom shared the dialog-width root cause.

**If it FAILS with the image and buttons present but clipped or zero-sized:** the width fix was necessary but not sufficient. Inspect the dialog's measured width and the inner grid's computed columns, then fix the sizing in `GalleryImageViewer.svelte`. Report the measurements.

**If it FAILS with the image or buttons absent from the DOM entirely:** STOP. That is a different defect — a data or conditional-rendering problem, not a layout one — and this plan does not cover it. Report what you found and do not attempt a fix.

- [ ] **Step 4: Commit**

```bash
git add web/e2e/gallery-viewer.spec.ts web/playwright.config.ts
git commit -m "test(web): guard gallery viewer image and nav controls"
```

Add `web/src/lib/components/training/GalleryImageViewer.svelte` to the commit only if Step 3 required a change to it.

---

## Phase 6 — Audit

### Task 10: Full verification

**Files:**
- Verification only. Route any defect back to the task that owns it.

- [ ] **Step 1: Clean verification from a fresh install**

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
bunx playwright test --project=chromium-desktop
bunx playwright test --project=chromium-phone
```

Expected: check reports 0 errors and 0 warnings; all unit tests pass; both provisioned browser projects pass.

Firefox and WebKit are not installed locally — report them as deferred to CI via `.github/workflows/web.yml` rather than as passing.

Known pre-existing flake, unrelated to this work: `console.spec.ts:6` ("CR progress ends as single 20% row") fails intermittently in full-suite ordering and passes in isolation. If you hit it, confirm it passes standalone and leave it alone.

- [ ] **Step 2: Verify the guard greps**

```bash
rg -n "window.location.href" src --glob '*.svelte'          # only login
rg -n "sm:max-w-sm" src/lib/components/ui/dialog             # empty
rg -nE "(?<![[\w-])data-(open|closed|active|checked|unchecked|vertical|horizontal):" src/lib/components/ui   # empty
rg ":global\(" src/lib/components src/routes --glob '*.svelte' | grep -v ConsoleView   # empty
rg "min-height:\s*0" src --glob '*.svelte'                   # empty
```

- [ ] **Step 3: Confirm each reported symptom by hand**

Load the app and check all seven, recording the outcome for your report:

1. Hover any nav item — background visibly changes, dark and light.
2. The current route's nav item is visibly distinct from the others.
3. Toggle a switch on `/general` — it visibly changes colour and the thumb slides.
4. `/datasets` shows a card gallery on desktop.
5. Clicking a dataset transitions without the page blanking; back does the same.
6. `/embeddings` content starts at the left edge on a wide window.
7. The concept modal is wide enough that its content does not spill.
8. Clicking a gallery image shows the image and both nav controls.

- [ ] **Step 4: Route any remaining defect back to its owning task**

If verification finds a defect, reopen the task that owns that contract, add a failing regression there, make the smallest fix, rerun that task's verification, and use that task's commit message. If verification is clean, create no commit.
