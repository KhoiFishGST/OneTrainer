# Overlay Residuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop overlay body content painting over the footer on short phones, and make the picker's regression test able to catch it.

**Architecture:** A previous branch gave `ResponsiveDialogDrawer`'s Drawer branch a `min-h-0` body wrapper plus an opt-in `bodyClass` prop, and used both to keep the directory picker's actions inside its card. Three other overlays got the `min-h-0` but not the rest of the treatment, so their bodies now overflow the wrapper and paint through the (background-less) footer. This applies the proven pattern to those three and closes the test gap that let the picker's version of the same defect ship.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind 4, shadcn-svelte (bits-ui), vaul-svelte, Vitest + @testing-library/svelte, Playwright.

## Background

`Drawer.Footer` is `gap-2 p-4 mt-auto flex flex-col` with **no background**, and `Drawer.Content`
sets no `overflow`, so a body taller than its wrapper paints straight through the footer region.
Measured overlap of body content into the footer's box, at 390px wide:

| consumer | 390×844 | 390×667 | 390×600 | 390×500 |
|---|---|---|---|---|
| `OptimizerParamsModal` | 0 | **112px** | **166px** | **246px** |
| `ConceptDetailModal` | 0 | **14px** | **34px** | **64px** |
| `DatasetPickerModal` | 0 | 0 | 0 | **50px** |

390×667 is an iPhone SE/8. A real SE's *visible* `dvh` is roughly 553px, between the 667 and 600
columns. Nothing in the suite sees this: `chromium-phone` runs at 390×844, where all three fit
exactly, and no visual baseline covers any of them.

**This is not a reason to revert `min-h-0`.** Before it, those same footers sat *below the viewport
floor* — `OptimizerParamsModal`'s Cancel/Save by 99–233px, `ConceptDetailModal`'s by 1–51px — i.e.
unreachable. The current state trades unreachable actions for overlapping text, which is the right
direction. This plan finishes the job.

Four other consumers were measured and need nothing: `SampleDetailModal` fits at every height,
`OptionSheet` and `GalleryImageViewer` are self-limiting via their own `max-h`/`overflow-y-auto`, and
the header's save-config drawer has a small body.

## The proven pattern

`DirectoryPicker.svelte` is the reference. Read it before writing anything. Three parts, all
required — the re-review mutation-tested them and each is load-bearing:

1. Pass `bodyClass="flex min-h-0 flex-col"` to `ResponsiveDialogDrawer`, making the shared body
   wrapper a shrinkable flex column. `min-h-0` on the wrapper alone is not enough: Chrome will not
   resolve a percentage height against a flex-shrunk block, so an unshrunk block child stays at full
   height inside a shrunk wrapper.
2. The body's own root element gets `flex min-h-0 flex-col`.
3. Every child *except* the one meant to scroll gets `shrink-0`. Without this, `overflow-x-auto` rows
   steal the shrink and collapse — the picker's breadcrumb and roots bars went 52px → 30px with
   their 44px tap targets overhanging.

The scrolling child keeps a preferred height and gains a `min-h` floor. It shrinks to that floor
because a flex item's default `flex-shrink: 1` applies down to its `min-height`.

## Global Constraints

- **Working directory is `web/`.** All paths and commands are relative to it.
- **Node is not on the default PATH.** Shell functions shadow `node`/`npx` and fail with
  `_load_nvm: command not found`. Prefix every command:
  `PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH" $HOME/.nvm/versions/node/v22.21.1/bin/node node_modules/.bin/<tool> …`
- **Port 7801 is the user's dev server — do NOT kill it.** Run all e2e with the override config,
  which rebuilds first and serves on 7811:
  `--config=/tmp/claude-1000/-home-khoifish-GST-github-OneTrainer/a00d225a-476e-41f6-99c7-ab1ead2597ef/scratchpad/pw-reuse.config.ts`
  If that file is gone, recreate it: import `web/playwright.config`, spread it, override `use.baseURL`
  and `webServer.command` to `cd <web> && vite build && python ../tests/webui/e2e_server.py --root .e2e --port 7811`,
  and `webServer.url` to the matching `/api/health`.
- **The e2e suite serves the static `build/` directory.** The override config rebuilds automatically.
  If you inspect built CSS by hand, rebuild first or you are reading stale output.
- **Use `chromium-phone` and `chromium-desktop`.** `webkit-phone` cannot launch here (missing
  `libicu74`). Report it as unverified, never as passing.
- **Desktop must not change.** `Dialog.Content` is `grid` with `max-height: none`, so there is no
  shrink pressure to distribute and these changes are inert there — but prove it, don't assume it.
  `chromium-desktop` must finish with **zero** snapshot drift, and never pass `--update-snapshots`
  for desktop.
- **Measure rendered boxes; do not infer from classes.** The parent branch shipped three separate
  Tailwind specificity traps and two assertions that went green against broken layout. Every
  geometry claim in your report needs numbers from a real browser.
- **Branch is `feat/svelte-web-ui`.** Commit there; conventional prefixes.

---

## File Structure

**Modify:**

| File | Change |
|---|---|
| `e2e/mobile-layout.spec.ts` | Add a listing-vs-card assertion to the picker test |
| `src/lib/components/form/OptimizerParamsModal.svelte` | Apply the pattern; `params-grid` becomes the scroller |
| `src/lib/components/concepts/ConceptDetailModal.svelte` | Apply the pattern; existing `ScrollArea` becomes shrinkable |
| `src/lib/components/datasets/DatasetPickerModal.svelte` | Apply the pattern; lower the `min-h` that blocks shrinking |
| `src/lib/components/form/SchedulerParamsModal.svelte` | Only if measurement says it needs it (Task 3) |

---

### Task 1: Make the picker's test catch what it currently misses

The assertion added by the parent branch measures the footer and the Select button. That is a real
improvement over measuring the card's height, but the footer is pulled back inside the card by the
shared wrapper's `min-h-0` **alone** — so the other three parts of the picker's fix are unguarded.

The re-review proved it by mutation: **delete just `bodyClass="flex min-h-0 flex-col"` from
`DirectoryPicker.svelte` and the test still passes**, while the listing spills out of the card by
1px at 390×600, 91px at 390×500 and 136px at 390×450.

**Files:**
- Modify: `e2e/mobile-layout.spec.ts` (the test titled `the file dialog's actions stay inside the card on short viewports`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Add the measurement and the assertion**

In that test's `page.evaluate` block, add a query for the listing's root element alongside the
existing ones:

```ts
        const body = document.querySelector(".picker-body") as HTMLElement;
```

Add its bottom edge to the returned object:

```ts
          listBottom: r(body).bottom,
```

Then, immediately after the existing `footerBottom > cardBottom` check, add:

```ts
      // The footer is pulled back inside the card by the shared wrapper's
      // `min-h-0` alone, so asserting only the footer leaves the rest of the
      // fix unguarded -- deleting `bodyClass` from DirectoryPicker keeps this
      // test green while listing rows spill out of the rounded card and paint
      // behind the footer. Measure the listing's own bottom edge too.
      if (m.listBottom > m.cardBottom + 1) {
        problems.push(
          `${at} listing bottom ${Math.round(m.listBottom)} is ` +
            `${Math.round(m.listBottom - m.cardBottom)}px below the card bottom ` +
            `${Math.round(m.cardBottom)}`
        );
      }
```

Note `.picker-body` is the `ScrollArea` root, not its viewport. The existing `view` query targets
`.picker-body [data-slot='scroll-area-viewport']` for the scroll measurements — leave that as it is.

- [ ] **Step 2: Prove the new assertion bites, by mutation**

Temporarily delete the line `bodyClass="flex min-h-0 flex-col"` from
`src/lib/components/directory/DirectoryPicker.svelte`.

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "actions stay inside the card"`
Expected: FAIL, reporting the listing below the card bottom at the shorter viewports.

Capture that output for your report, then **restore the deleted line** and confirm the test passes
again. A test that was never seen to fail proves nothing — this is the third assertion on this
feature and the first two both went green against broken layout.

- [ ] **Step 3: Commit**

```bash
git add e2e/mobile-layout.spec.ts
git commit -m "test(web): catch listing overflow, not just an escaped footer"
```

---

### Task 2: Apply the pattern to the three measured overlays

Do all three in one task — they share one pattern and one verification sweep, and a reviewer would
accept or reject them together.

**Files:**
- Modify: `src/lib/components/form/OptimizerParamsModal.svelte:189-226` and its `<style>` block
- Modify: `src/lib/components/concepts/ConceptDetailModal.svelte:165-203` and its `<style>` block
- Modify: `src/lib/components/datasets/DatasetPickerModal.svelte:63-69`

**Interfaces:**
- Consumes: `ResponsiveDialogDrawer`'s `bodyClass?: string` prop (already exists; it is `cn()`-merged
  onto the Drawer branch's body wrapper, which already carries `min-h-0`).
- Produces: nothing.

- [ ] **Step 1: Write the failing e2e assertions**

Add a new test to `e2e/mobile-layout.spec.ts`, inside the existing `test.describe("Phone layout", …)`
block. It opens each overlay and asserts its body stays inside the card:

```ts
  // Drawer.Footer has no background and Drawer.Content sets no overflow, so a
  // body taller than its wrapper paints straight through the footer. The parent
  // branch gave these three the shared wrapper's `min-h-0` -- which rescued
  // their footers from below the viewport floor -- without the rest of the
  // treatment, so their bodies overflow instead.
  const OVERFLOW_CASES = [
    { name: "optimizer params", route: "/training", open: "Optimizer Params", body: ".opt-modal-body" },
    { name: "concept editor", route: "/concepts", open: "Configure", body: ".concept-modal-body" },
  ];

  for (const c of OVERFLOW_CASES) {
    test(`${c.name} body stays inside its card on short viewports`, async ({ page }) => {
      const problems: string[] = [];
      for (const height of [844, 667, 600, 500]) {
        await page.setViewportSize({ width: 390, height });
        await page.goto(c.route);
        await page.getByRole("button", { name: new RegExp(c.open, "i") }).first().click();
        const dialog = page.getByRole("dialog").first();
        await expect(dialog).toBeVisible();
        await page.evaluate(async () => {
          await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
        });

        const m = await page.evaluate((sel) => {
          const card = document.querySelector("[data-slot='drawer-content']") as HTMLElement;
          const body = document.querySelector(sel) as HTMLElement;
          if (!card || !body) return null;
          return {
            cardBottom: card.getBoundingClientRect().bottom,
            bodyBottom: body.getBoundingClientRect().bottom,
          };
        }, c.body);

        if (!m) {
          problems.push(`${height}px tall: could not find card or ${c.body}`);
          continue;
        }
        if (m.bodyBottom > m.cardBottom + 1) {
          problems.push(
            `${height}px tall: body bottom ${Math.round(m.bodyBottom)} is ` +
              `${Math.round(m.bodyBottom - m.cardBottom)}px below the card bottom ` +
              `${Math.round(m.cardBottom)}`
          );
        }
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
```

The button names (`Optimizer Params`, `Configure`) and the routes are best guesses — **verify them
against the actual UI and correct them before running.** If an overlay is not reachable from the e2e
fixture's data, say so in your report and measure that one by hand instead of guessing; do not delete
the case silently. `DatasetPickerModal` is deliberately not in this list: it only overflows at
390×500 and its trigger depends on fixture data — measure it by hand in Step 5.

- [ ] **Step 2: Run them and record the failures**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "stays inside its card"`
Expected: FAIL. The expected overlaps are ~112/166/246px for the optimizer modal and ~14/34/64px for
the concept editor at 667/600/500, with 844 clean. Put the actual numbers in your report — if they
differ materially from these, say so, because it means the layout has moved since it was measured.

- [ ] **Step 3: Fix `OptimizerParamsModal`**

It has no internal scroller, which is why it overflows worst. Give it one.

On the `<ResponsiveDialogDrawer` opening tag (around line 189), add:

```svelte
  bodyClass="flex min-h-0 flex-col"
```

In its `<style>` block, `.opt-modal-body` is already `display: flex; flex-direction: column; gap: 1rem`.
Add the shrink permission:

```css
  .opt-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }
```

Make the non-scrolling children hold their size, and the params grid the thing that scrolls:

```css
  .header-bar,
  .params-divider {
    flex-shrink: 0;
  }

  .params-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    overflow-y: auto;
    min-height: 6rem;
  }
```

`6rem` (96px) is the floor the picker settled on; the parent branch verified a smaller floor is
usable and a larger one pushes the footer back out at 390×500.

The error alert above `.header-bar` is a Tailwind-classed `div` (around line 197) — add `shrink-0` to
its class list so it cannot be squeezed either.

- [ ] **Step 4: Fix `ConceptDetailModal`**

It already has a `ScrollArea`; the body just cannot shrink to let it work.

On the `<ResponsiveDialogDrawer` opening tag (around line 165), add:

```svelte
    bodyClass="flex min-h-0 flex-col"
```

In its `<style>` block:

```css
  .concept-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }
```

The `SubNav` component (around line 174) renders its own two breakpoint variants, so it cannot take a
`shrink-0` class directly — wrap it:

```svelte
      <div class="shrink-0">
        <SubNav … />
      </div>
```

Keep every prop `SubNav` already receives. Then give the `ScrollArea` (around line 181) a floor so it
shrinks rather than the body overflowing:

```svelte
      <ScrollArea class="h-[520px] max-h-[60dvh] min-h-[96px]">
```

- [ ] **Step 5: Fix `DatasetPickerModal`**

Its `ScrollArea` is the body's direct child, and its `min-h-[280px]` is exactly what blocks shrinking.

On the `<ResponsiveDialogDrawer` opening tag (around line 63), add:

```svelte
    bodyClass="flex min-h-0 flex-col"
```

Then, on the `ScrollArea` (around line 69):

```svelte
    <ScrollArea class="min-h-[120px] max-h-[480px] py-2">
```

`min-h-[280px]` becomes `min-h-[120px]`. Keep `py-2` — the parent branch restored it deliberately, as
`Drawer.Content` has no `gap` utility and it is the only vertical breathing room on mobile.

Measure this one by hand at 390×{844, 667, 600, 500}: the body's bottom must stay inside the card,
and the grid must still show at least one full dataset card at 500. Report the numbers.

- [ ] **Step 6: Run the new assertions, now expecting green**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "stays inside its card"`
Expected: PASS. Put the after-numbers beside the before-numbers from Step 2.

- [ ] **Step 7: Confirm the footers did not regress back off-screen**

The whole point of the parent branch's `min-h-0` was to bring these footers back inside the viewport.
Measure, for all three overlays at 390×{667, 600, 500}, that the primary action button's bottom edge
is inside both the card and the viewport. Report the numbers. If any action moved back below the
viewport floor, that is a regression — stop and report it rather than accepting it.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/form/OptimizerParamsModal.svelte src/lib/components/concepts/ConceptDetailModal.svelte src/lib/components/datasets/DatasetPickerModal.svelte e2e/mobile-layout.spec.ts
git commit -m "fix(web): keep overlay bodies inside their card on short phones"
```

---

### Task 3: Decide `SchedulerParamsModal` on evidence, then verify everything

`SchedulerParamsModal` has the same shape as `OptimizerParamsModal` — a plain `div` body
(`.scheduler-modal-body`, already `display: flex; flex-direction: column; gap: 1rem`) with no
internal scroller — so it inherits the same hazard by construction. But its body is one field plus an
optional alert, and its trigger was not reachable from the e2e fixture when this was measured, so
nobody has confirmed it actually overflows.

Measure first. Do not apply the pattern to an overlay whose body cannot overflow.

**Files:**
- Modify: `src/lib/components/form/SchedulerParamsModal.svelte` — only if the measurement says so

**Interfaces:**
- Consumes: Task 2's pattern.
- Produces: nothing.

- [ ] **Step 1: Measure it**

Open the scheduler params modal at 390×{844, 667, 600, 500} and measure `.scheduler-modal-body`'s
bottom against the card's bottom, and the footer's primary button against the viewport.

If the trigger is not reachable from the e2e fixture, drive it however you can — a scratch Playwright
spec that stubs whatever the component needs, or a temporary route. Say in your report how you
reached it.

- [ ] **Step 2: Apply the pattern only if it overflows**

If the body's bottom exceeds the card's bottom at any height, apply exactly what Task 2 Step 3 did to
`OptimizerParamsModal`: `bodyClass="flex min-h-0 flex-col"`, `min-height: 0` on
`.scheduler-modal-body`, `flex-shrink: 0` on the non-scrolling children, and make the field area
scroll with a `min-height: 6rem` floor.

If it does **not** overflow at any height, change nothing. Record the measurements and say plainly
that no change was warranted. That is a valid and preferred outcome — the note in this plan is not
an instruction to edit the file.

- [ ] **Step 3: Full unit and type gate**

Run: `npx vitest run`
Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error`
Expected: PASS, 0 errors.

- [ ] **Step 4: Full phone suite**

Run: `npx playwright test --project=chromium-phone`
Expected: PASS. If a visual baseline shifts, open its `-diff.png`, describe it in your report, and
only regenerate if the diff is explained by an overlay body resizing. Anything else: stop and report
BLOCKED.

- [ ] **Step 5: Full desktop suite**

Run: `npx playwright test --project=chromium-desktop`
Expected: PASS with **zero** snapshot changes. `Dialog.Content` is `grid` with `max-height: none`, so
none of this should reach desktop — a desktop diff means it did. Do not pass `--update-snapshots`;
report the failure instead.

- [ ] **Step 6: Commit**

```bash
git add -A src/ e2e/
git commit -m "fix(web): finish the short-viewport overlay sweep"
```

---

## Self-Review

**Coverage:**

| Residual finding | Task |
|---|---|
| Picker assertion cannot distinguish "fixed" from "footer rescued, content escaping" | 1 |
| `OptimizerParamsModal` body overlaps footer by 112–246px | 2 |
| `ConceptDetailModal` body overlaps footer by 14–64px | 2 |
| `DatasetPickerModal` body overlaps footer by 50px at 390×500 | 2 |
| `SchedulerParamsModal` same shape, never measured | 3 |
| Footers must not regress back below the viewport | 2 Step 7 |

**Consistency:** `bodyClass="flex min-h-0 flex-col"` is the same string in Tasks 2 and 3 and matches
what `DirectoryPicker.svelte` already passes. The `min-h` floor is `6rem`/`96px` everywhere, matching
the picker's verified floor. `.opt-modal-body`, `.concept-modal-body` and `.scheduler-modal-body` are
the actual class names in those files, each already a flex column needing only `min-height: 0`.

**Known soft spots, stated rather than hidden:**
- Task 2 Step 1's button names and routes are guesses. The step says so and requires verifying them
  against the UI before running, with hand measurement as the fallback if an overlay is unreachable
  from fixture data.
- No visual baseline covers any of these three overlays in either project, so "desktop unchanged" for
  them rests on the `Dialog.Content` grid argument plus Task 3 Step 5's zero-drift gate, not on a
  snapshot of the overlays themselves.
- `webkit-phone` remains unrunnable here, and these viewports (600, 500) are stand-ins for a real
  iPhone SE's ~553px visible `dvh`. No iOS evidence either way.
