# Mobile Nav Drawer Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile navigation drawer narrow, fill its height without dead space, give every item a real 44px target, and slide in and out from the edge.

**Architecture:** The drawer's width finally comes from `SIDEBAR_WIDTH_MOBILE` by overriding the sheet's width rule at equal specificity. Items become flex children of a full-height list so they distribute across the drawer instead of clustering at the top, which also raises the row pitch past 44px and makes the fragile `::after` overlay unnecessary. The sheet's slide distance changes from a 10px nudge to a full-width slide.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind 4, shadcn-svelte (bits-ui), Vitest, Playwright.

## Background: measured state

With the drawer open on a 390×844 phone:

```
dialog        293 x 844   padding 12/12   row-gap 16px
scroll box    820 tall    content 538 tall   ->  282px unused
item          36 tall     pitch 38px      (14 items)
```

Four defects follow from those numbers:

1. **Every nav item mis-taps.** Pitch is 38px against a 44px requirement. The `after:-top-1 after:-bottom-1` overlays of adjacent items overlap, and the later sibling paints on top, so the lower corners of each item resolve to the *next* link. Probing Datasets: top corners → `/datasets`, bottom corners → `/concepts`. `e2e/touch-targets.spec.ts` fails on all 13 items. A tap near the bottom of "Training" navigates to "Sampling".
2. **`SIDEBAR_WIDTH_MOBILE` is inert.** It is set to `9rem` (144px) but the drawer measures 293px — `w-3/4` of the viewport. `ui/sheet/sheet-content.svelte:38` declares `data-[side=left]:w-3/4`, which compiles to a selector carrying an attribute qualifier and therefore outranks the plain `w-(--sidebar-width)` on the same element. Two requests to narrow the drawer had no effect for this reason.
3. **282px of dead space.** The list is top-aligned in a full-height drawer, so a third of it is empty while the rows are cramped.
4. **No slide animation.** `sheet-content.svelte:38` uses `slide-in-from-left-10` / `slide-out-to-left-10` — a 2.5rem nudge, not a slide from the edge.

Defect 2 also produced a tautological unit test (`ui/sidebar/constants.test.ts` asserts the constant equals its own literal), and placing that test inside the vendored `ui/` tree forced `ui-dependency-boundary.test.ts:117` to be weakened with a `.test.`/`.spec.` exemption.

**The fixes reinforce each other.** Distributing items across the full height raises the pitch well past 44px, which removes the need for the `::after` overlay that caused the mis-tap — so defects 1 and 3 have one fix.

## Global Constraints

- **Working directory is `web/`.**
- **Stop any dev server on port 7801 before running e2e.** `python scripts/train_ui_web.py --dev` binds it and Playwright uses `reuseExistingServer: false`.
- **`webkit-phone` cannot run on this machine** — missing system libraries (`libicu74`). Verify on `chromium-phone` and `chromium-desktop`; note WebKit as unverified rather than claiming it passed.
- **Row pitch on phones must be ≥44px** (consecutive item top-to-top). This is the invariant behind the touch-target rule; measuring the box alone is not sufficient, because overlapping overlays satisfy a box check while still mis-tapping.
- **Desktop must not change.** All new rules go behind `max-md:` or the `mobile` prop. `chromium-desktop` must finish with zero snapshot drift.
- **Vendored shadcn files** (`src/lib/components/ui/**`) require a `LOCAL MODIFICATION` comment naming what changed and that `shadcn-svelte add` reverts it — see `ui/sidebar/sidebar.svelte:6-11`.
- Commit after every task, conventional prefixes.

---

## File Structure

**Modify:**

| File | Change |
|---|---|
| `src/lib/components/ui-dependency-boundary.test.ts` | Restore the guard to its unexempted form |
| `src/lib/components/ui/sidebar/constants.test.ts` | Delete — replaced by a rendered-width assertion |
| `src/lib/components/shell/RailContent.svelte` | Win the width rule; fill height; drop the `::after` overlay |
| `src/lib/components/ui/sheet/sheet-content.svelte` | Full-width slide for left/right sheets, with marker |
| `src/lib/components/shell/RailContent.test.ts` | Cover the width and layout classes |
| `e2e/mobile-layout.spec.ts` | Assert drawer width, pitch, fill and no scrolling |
| `e2e/visual.spec.ts-snapshots/*.png` | Regenerate whatever the narrower drawer changes |

---

### Task 1: Restore the dependency guard and drop the tautological test

`ui/sidebar/constants.test.ts` asserts `SIDEBAR_WIDTH_MOBILE === '9rem'`. It restates a literal, so it passes forever and proves nothing — while the width it implies is not what renders. Worse, living inside the vendored `ui/` tree it tripped `ui-dependency-boundary.test.ts`, which was then weakened to exempt test files rather than moving the test out.

Task 2 replaces it with an assertion on the width the browser actually computes.

**Files:**
- Delete: `src/lib/components/ui/sidebar/constants.test.ts`
- Modify: `src/lib/components/ui-dependency-boundary.test.ts:114-119`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Delete the tautological test**

```bash
git rm src/lib/components/ui/sidebar/constants.test.ts
```

- [ ] **Step 2: Restore the guard**

In `src/lib/components/ui-dependency-boundary.test.ts`, revert the exemption:

```ts
  it('ensures no UI components import domain modules', () => {
    const violations = Object.entries(uiSources).flatMap(([file, source]) =>
      findForbiddenImports(source, file)
    );
    expect(violations).toEqual([]);
  });
```

- [ ] **Step 3: Run the suite**

Run: `npx vitest run src/lib/components/ui-dependency-boundary.test.ts`
Expected: PASS. The guard is unexempted and no test file remains under `ui/` to trip it.

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/components/ui-dependency-boundary.test.ts src/lib/components/ui/sidebar/
git commit -m "test(web): restore the ui dependency guard and drop a tautological constant test"
```

---

### Task 2: Make the drawer width real

`sidebar.svelte:60` already sets `style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE}"` on the sheet, and `sidebar.svelte:57` applies `w-(--sidebar-width)`. That loses to `sheet-content.svelte:38`'s `data-[side=left]:w-3/4`, because the variant compiles to a selector with an extra attribute qualifier and outranks a plain class.

The fix is to override at the *same* variant, from `RailContent`'s class prop. Because both classes then carry the identical variant and target the same property, `cn()`'s tailwind-merge keeps the later one — ours.

**Files:**
- Modify: `src/lib/components/shell/RailContent.svelte:71`
- Modify: `src/lib/components/shell/RailContent.test.ts`
- Modify: `e2e/mobile-layout.spec.ts`

**Interfaces:**
- Consumes: `SIDEBAR_WIDTH_MOBILE` (existing, `9rem`).
- Produces: the drawer renders at `SIDEBAR_WIDTH_MOBILE`, asserted in the browser.

- [ ] **Step 1: Write the failing e2e assertion**

Add to `e2e/mobile-layout.spec.ts`, inside `test.describe("Phone layout", ...)`:

```ts
  test("the navigation drawer is as narrow as its configured width", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Open navigation" }).click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();

    // 9rem at the app's 16px root. Asserting the rendered width rather than
    // the constant: the constant was already 9rem while the drawer rendered
    // at 293px, because the sheet's own `w-3/4` outranked it.
    const box = (await drawer.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(145);
    expect(box.width).toBeGreaterThanOrEqual(143);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "as narrow as its configured width"`
Expected: FAIL — received 293.

- [ ] **Step 3: Write the failing unit test**

Add to `src/lib/components/shell/RailContent.test.ts`, following the existing file's render-and-inspect style:

```ts
  it('overrides the sheet width at the same variant so the sidebar width wins', async () => {
    render(RailContentTestWrapper, { mobile: true });

    const trigger = screen.queryByTestId('open-sidebar');
    if (trigger) {
      await fireEvent.click(trigger);
    }

    const panel = screen.getByText('Live').closest('[role="dialog"]');
    // `w-(--sidebar-width)` alone loses to sheet-content's
    // `data-[side=left]:w-3/4`, which carries an attribute qualifier and so
    // has higher specificity. Matching the variant lets tailwind-merge drop
    // the loser instead.
    expect(panel?.className).toContain('data-[side=left]:w-[var(--sidebar-width)]');
  });
```

- [ ] **Step 4: Apply the override**

In `src/lib/components/shell/RailContent.svelte:71`, extend the mobile branch of the class expression:

```svelte
  class={cn(
    'rail w-[var(--rail-width)] bg-card border-r border-border flex flex-col h-full transition-[width] duration-200 ease-in-out overflow-hidden select-none',
    expanded && 'expanded',
    mobile && 'p-2 data-[side=left]:w-[var(--sidebar-width)]'
  )}
```

The `p-2.5 py-3` padding becomes a flat `p-2` — Task 3 relies on the tighter box.

- [ ] **Step 5: Run both tests**

Run: `npx vitest run src/lib/components/shell/RailContent.test.ts`
Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "as narrow as its configured width"`
Expected: PASS both.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/shell/RailContent.svelte src/lib/components/shell/RailContent.test.ts e2e/mobile-layout.spec.ts
git commit -m "fix(web): let the configured sidebar width actually size the mobile drawer"
```

---

### Task 3: Fill the height, and give every row a real 44px target

One change fixes both the dead space and the mis-tap. Making each item a flex child of a full-height list distributes the 282px of slack across the rows, which pushes the pitch from 38px to roughly 57px on a 844px screen. Once the pitch exceeds 44px on its own, the `after:-top-1 after:-bottom-1` overlay is not merely redundant — it is the bug, because adjacent overlays overlap and the later one steals the tap.

On a short phone the flex distribution collapses to the minimum and the existing scroll container takes over, so nothing breaks below the fold.

**Files:**
- Modify: `src/lib/components/shell/RailContent.svelte:89-158`
- Modify: `e2e/mobile-layout.spec.ts`

**Interfaces:**
- Consumes: Task 2's tighter padding.
- Produces: nav rows with pitch ≥44px and no `after:` overlay.

- [ ] **Step 1: Write the failing e2e assertions**

Add to `e2e/mobile-layout.spec.ts`, inside `test.describe("Phone layout", ...)`:

```ts
  test("navigation rows are at least 44px apart", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();

    const tooTight = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]')!;
      const rows = [...dlg.querySelectorAll('a[href]')] as HTMLElement[];
      const out: string[] = [];
      for (let i = 1; i < rows.length; i++) {
        const pitch =
          rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().top;
        if (pitch < 44) {
          out.push(`${rows[i - 1].textContent?.trim()} -> ${rows[i].textContent?.trim()}: ${Math.round(pitch)}px`);
        }
      }
      return out;
    });

    // Pitch, not box height: two 36px rows 2px apart satisfy a box check via
    // overlapping ::after overlays while the lower half of each row actually
    // activates its neighbour.
    expect(tooTight, `Rows closer than 44px:\n${tooTight.join("\n")}`).toEqual([]);
  });

  test("the navigation fills its drawer without dead space or scrolling", async ({ page }) => {
    for (const height of [844, 667]) {
      await page.setViewportSize({ width: 390, height });
      await page.goto("/general");
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();

      const fit = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
        const rows = [...dlg.querySelectorAll('a[href], button')] as HTMLElement[];
        const visible = rows.filter((r) => r.getBoundingClientRect().height > 0);
        const last = visible[visible.length - 1].getBoundingClientRect();
        const scroller = [...dlg.querySelectorAll('*')].find(
          (el) => getComputedStyle(el as HTMLElement).overflowY === 'auto'
        ) as HTMLElement | undefined;
        return {
          slackBelowLastRow: Math.round(dlg.getBoundingClientRect().bottom - last.bottom),
          scrolls: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : false,
        };
      });

      expect(fit.scrolls, `drawer scrolls at ${height}px tall`).toBe(false);
      expect(fit.slackBelowLastRow, `dead space at ${height}px tall`).toBeLessThanOrEqual(24);
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "navigation rows|fills its drawer"`
Expected: FAIL — every pair reports 38px, and the dead space reports ~282px at 844.

- [ ] **Step 3: Make the list fill the drawer**

In `src/lib/components/shell/RailContent.svelte:89-92`, let the content and list stretch:

```svelte
  <SidebarContent class={cn('flex flex-col p-2 gap-1 overflow-y-auto flex-1', mobile && 'p-0 gap-0')}>
    <SidebarGroup class={cn('p-0', mobile && 'flex-1')}>
      <SidebarGroupContent class={mobile ? 'h-full' : undefined}>
        <SidebarMenu
          class={mobile ? 'h-full gap-1' : 'gap-1'}
          aria-label={mobile ? 'Mobile Navigation' : 'Sidebar'}
        >
```

- [ ] **Step 4: Let each row take its share**

Every `<SidebarMenuItem>` in the loop — and the console item at line ~134 — becomes a flex child:

```svelte
            <SidebarMenuItem class={mobile ? 'flex-1 min-h-[40px]' : undefined}>
```

`flex-1` distributes the slack; `min-h-[40px]` plus the list's `gap-1` (4px) guarantees a 44px pitch when the screen is too short to distribute.

- [ ] **Step 5: Remove the overlay that steals taps**

In all three anchor/button class strings (lines ~100, ~115, ~139), delete this fragment:

```
 after:absolute after:-top-1 after:-bottom-1 after:left-0 after:right-0 after:content-[\'\']
```

and replace the height utilities `max-md:min-h-[36px] max-md:h-auto` with `max-md:h-full`, so the row fills the space `flex-1` gave its item. Keep `max-md:px-2 max-md:py-1 max-md:text-xs max-md:gap-2`, and keep the `relative` and `overflow-hidden`/`max-md:overflow-visible` classes as they are.

The overlay existed to stretch a 36px row to a 44px target. Rows now clear 44px on their own, and with items adjacent the overlays overlapped — which is what made the lower half of each row activate the next one.

- [ ] **Step 6: Update the unit test that pinned the old row shape**

`src/lib/components/shell/RailContent.test.ts` currently asserts
`max-md:min-h-[36px]` and describes itself as "uses 36px min height with touch
target overlay on mobile nav items". Both are exactly what this task removes.
Replace that test with one that pins the new shape:

```ts
  it('lets mobile nav rows share the drawer height instead of overlaying a target', async () => {
    render(RailContentTestWrapper, { mobile: true });

    const trigger = screen.queryByTestId('open-sidebar');
    if (trigger) {
      await fireEvent.click(trigger);
    }

    const liveLink = screen.getByText('Live').closest('a');
    expect(liveLink?.className).toContain('max-md:h-full');
    expect(liveLink?.className).toContain('max-md:px-2');
    expect(liveLink?.className).toContain('max-md:text-xs');
    // The ::after overlay is gone: adjacent overlays overlapped, and the
    // later sibling won the tap. Rows clear 44px on their own now.
    expect(liveLink?.className).not.toContain('after:-top-1');
    expect(liveLink?.closest('li')?.className).toContain('flex-1');
  });
```

- [ ] **Step 7: Run the layout assertions**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "navigation rows|fills its drawer"`
Expected: PASS.

- [ ] **Step 8: Run the touch-target suite — this is the regression that started this task**

Run: `npx playwright test e2e/touch-targets.spec.ts --project=chromium-phone`
Expected: PASS, including "the mobile navigation sheet has no undersized controls", which currently reports all 13 items as `264x36 box, no 44px target`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/shell/RailContent.svelte src/lib/components/shell/RailContent.test.ts e2e/mobile-layout.spec.ts
git commit -m "fix(web): distribute nav rows across the drawer so taps land on the right item"
```

---

### Task 4: Slide the drawer in and out from the edge

`sheet-content.svelte:38` animates left and right sheets with `slide-in-from-left-10` / `slide-out-to-left-10`. Tailwind's `-10` is a 2.5rem offset, so the panel fades in with a small nudge rather than sliding from the edge the way the desktop rail expands. `-full` translates by the element's own width, which is the intended sheet motion.

This is a vendored file and needs the local-modification marker. It also affects the directory picker's sheet — that one is full-screen, where a full slide is equally correct. Screenshots disable animations, so visual baselines are unaffected.

**Files:**
- Modify: `src/lib/components/ui/sheet/sheet-content.svelte:36-40`
- Modify: `src/lib/components/shell/shell-boundary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/components/shell/shell-boundary.test.ts`, inside the existing `describe('shell boundaries', ...)`:

```ts
  it('slides side sheets in from the edge rather than nudging them', () => {
    const source = allSources['/src/lib/components/ui/sheet/sheet-content.svelte'];

    // `-10` is a 2.5rem offset: the panel appears to fade with a nudge. `-full`
    // translates by the panel's own width, which is what makes the nav drawer
    // slide the way the desktop rail does.
    for (const side of ['left', 'right']) {
      expect(source).toContain(`data-[side=${side}]:data-[state=open]:slide-in-from-${side}-full`);
      expect(source).toContain(`data-[side=${side}]:data-[state=closed]:slide-out-to-${side}-full`);
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/components/shell/shell-boundary.test.ts`
Expected: FAIL — the source contains `slide-in-from-left-10`.

- [ ] **Step 3: Change the slide distance**

In `src/lib/components/ui/sheet/sheet-content.svelte`, within the long class string, replace these four fragments:

| Replace | With |
|---|---|
| `data-[side=left]:data-[state=open]:slide-in-from-left-10` | `data-[side=left]:data-[state=open]:slide-in-from-left-full` |
| `data-[side=right]:data-[state=open]:slide-in-from-right-10` | `data-[side=right]:data-[state=open]:slide-in-from-right-full` |
| `data-[side=left]:data-[state=closed]:slide-out-to-left-10` | `data-[side=left]:data-[state=closed]:slide-out-to-left-full` |
| `data-[side=right]:data-[state=closed]:slide-out-to-right-10` | `data-[side=right]:data-[state=closed]:slide-out-to-right-full` |

Leave `top` and `bottom` on `-10`; those sheets are shallow and a full slide overshoots.

Add above the component's `<SheetPrimitive.Content>`:

```svelte
<!--
  LOCAL MODIFICATION: left and right sheets slide by their own width
  (`-full`) instead of upstream's 2.5rem `-10` nudge, so the navigation
  drawer slides in from the edge like the desktop rail. Top and bottom
  sheets keep `-10`. Re-running `shadcn-svelte add sheet` will revert this.
-->
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/components/shell/shell-boundary.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch it once by hand**

Run: `npx playwright test e2e/mobile.spec.ts --project=chromium-phone -g "off-canvas rail" --headed`
Confirm the drawer slides in from the left edge and slides back out on Escape, rather than fading in place. An animation's quality is not something an assertion can judge; look at it.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ui/sheet/sheet-content.svelte src/lib/components/shell/shell-boundary.test.ts
git commit -m "fix(web): slide side sheets in from the edge instead of nudging them"
```

---

### Task 5: Refresh baselines and verify

**Files:**
- Modify: whichever `e2e/visual.spec.ts-snapshots/*.png` the narrower drawer changes

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Unit suite**

Run: `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 2: Type check**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error`
Expected: no errors.

- [ ] **Step 3: Phone suite**

Run: `npx playwright test --project=chromium-phone`
Expected: PASS except any visual baseline that legitimately shows the narrower drawer. Inspect each `-diff.png` under `test-results/` before touching it; if a diff shows anything other than the drawer's new width or row spacing, stop and investigate.

- [ ] **Step 4: Regenerate only what you inspected**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone --update-snapshots`

- [ ] **Step 5: Re-run the phone suite**

Run: `npx playwright test --project=chromium-phone`
Expected: PASS.

- [ ] **Step 6: Desktop suite**

Run: `npx playwright test --project=chromium-desktop`
Expected: PASS with **no** snapshot changes. Every change in this plan is behind `max-md:` or the `mobile` prop except the sheet slide distance, which desktop dialogs do not use. A desktop diff means something leaked past `md`.

- [ ] **Step 7: Commit**

```bash
git add e2e/visual.spec.ts-snapshots/
git commit -m "test(web): refresh phone baselines for the compact nav drawer"
```

---

## Self-Review

**Coverage:**

| Issue | Task |
|---|---|
| Nav items mis-tap; touch-target suite fails | 3 |
| `SIDEBAR_WIDTH_MOBILE` inert, drawer 293px not 144px | 2 |
| Tautological constant test; weakened dependency guard | 1 |
| 282px of dead space; items not filling the drawer | 3 |
| No slide-in/out animation | 4 |

**Ordering:** Task 1 clears the dead test before Task 2 replaces it with a real assertion. Task 2 narrows the drawer before Task 3 measures row distribution inside it. Task 4 is independent. Task 5 regenerates baselines only once the layout is final.

**Consistency:** the width override `data-[side=left]:w-[var(--sidebar-width)]` is introduced in Task 2 and asserted by both the unit test and the e2e width test. `min-h-[40px]` plus the list's `gap-1` in Task 3 is what guarantees the ≥44px pitch that Task 3's own e2e asserts and `touch-targets.spec.ts` independently re-checks.

**Risk noted:** Task 3 removes the `::after` overlays, which the app's convention (`app.css:212-233`) recommends for controls that must stay visually small. That convention still holds for switches and checkboxes; it does not apply here, because these rows are no longer small — they clear 44px on their own, and two adjacent overlays cannot both own the pixels between them.

**Not covered:** `webkit-phone` remains unverifiable on this machine for lack of system libraries. Say so rather than reporting it green.
