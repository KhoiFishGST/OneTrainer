# Mobile Overlay Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the file dialog slide up from the bottom like every other mobile overlay, and stop overlay content running flush to the card edge.

**Architecture:** `DirectoryPicker` moves from `ResponsiveDialogSheet` to `ResponsiveDialogDrawer`, which makes the sheet wrapper dead code and deletes it. The drawer gains a padded body slot in its Drawer branch only (the Dialog branch already gets `p-4` from `Dialog.Content`), with a `flush` opt-out for content that must run edge-to-edge. Viewport-relative overlay heights move from `vh` to `dvh`.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind 4, shadcn-svelte (bits-ui), vaul-svelte, Vitest + @testing-library/svelte, Playwright.

## Global Constraints

- **Working directory is `web/`.** All paths and commands are relative to it.
- **Node is not on the default PATH.** Shell functions shadow `node`/`npx` and fail with `_load_nvm: command not found`. Prefix every command:
  `PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH" $HOME/.nvm/versions/node/v22.21.1/bin/node node_modules/.bin/<tool> …`
- **Port 7801 is the user's dev server — do NOT kill it.** Run all e2e with the override config, which rebuilds first and serves on 7811:
  `--config=/tmp/claude-1000/-home-khoifish-GST-github-OneTrainer/a00d225a-476e-41f6-99c7-ab1ead2597ef/scratchpad/pw-reuse.config.ts`
- **Use `chromium-phone` and `chromium-desktop` only.** `webkit-phone` cannot launch on this machine (missing `libicu74`). Report it as unverified; never as passing.
- **The e2e suite serves the static `build/` directory.** The override config rebuilds automatically. If you inspect built CSS by hand, rebuild first or you are reading stale output.
- **Desktop must not change.** Every change is in the Drawer branch or the mobile picker path. `chromium-desktop` must finish with zero snapshot drift.
- **Vendored shadcn files** (`src/lib/components/ui/**`) require a `LOCAL MODIFICATION` comment naming what changed and that `shadcn-svelte add` reverts it — see `ui/sidebar/sidebar.svelte:6-11`.
- **Assert geometry, not classes, for anything visual.** A previous round of this project shipped a no-op because a test grepped source text for a Tailwind class that generated no CSS. Any test of position or motion must measure the rendered element.
- **Branch is `feat/svelte-web-ui`.** Commit there; conventional prefixes.

---

## File Structure

**Modify:**

| File | Change |
|---|---|
| `src/lib/components/overlays/ResponsiveDialogDrawer.svelte` | Add `flush` prop; wrap the Drawer branch's body in a padded container |
| `src/lib/components/overlays/ResponsiveDialogDrawerTestWrapper.svelte` | Expose `flush`, and make `title`/`footer` omittable so padding rules are testable |
| `src/lib/components/overlays/ResponsiveDialogDrawer.test.ts` | Cover the padding rules and the opt-out |
| `src/lib/components/ui/drawer/drawer-content.svelte` | Two `max-h-[80vh]` → `max-h-[80dvh]`; extend the LOCAL MODIFICATION marker |
| `src/lib/components/shell/shell-boundary.test.ts` | Widen `findViewportUnitViolations` to any `<n>vh` |
| `src/lib/components/concepts/ConceptDetailModal.svelte` | `90vh`/`60vh` → `dvh` |
| `src/lib/components/training/GalleryImageViewer.svelte` | Two `65vh` → `dvh`; pass `flush` |
| `src/routes/(app)/datasets/[id]/+page.svelte` | `90vh` → `dvh` |
| `src/lib/components/overlays/OptionSheet.svelte` | `60vh` → `dvh`; pass `flush` |
| `src/lib/components/datasets/DatasetPickerModal.svelte` | Drop the now-redundant `p-2` |
| `src/lib/components/directory/DirectoryPicker.svelte` | Use `ResponsiveDialogDrawer`; drop `p-1`; cap at `max-h-[90dvh]` |
| `src/lib/components/directory/DirectoryPicker.test.ts` | Replace the sheet-class assertion |
| `e2e/mobile-layout.spec.ts` | Slide-up geometry, width and height assertions |
| `e2e/responsive-workflows.spec.ts:94` | Replace the `/full-screen/` class assertion |
| `e2e/mobile.spec.ts:28` | Rename the test — "full-screen" is no longer accurate |
| `e2e/visual.spec.ts:129` | Rename to reflect a drawer, regenerate its baseline |

**Delete:**

- `src/lib/components/overlays/ResponsiveDialogSheet.svelte`
- `src/lib/components/overlays/ResponsiveDialogSheet.test.ts`
- `src/lib/components/overlays/ResponsiveDialogSheetTestWrapper.svelte`

---

### Task 1: Padded body slot with a `flush` opt-out

The drawer's `children` slot renders straight into `Drawer.Content`, which has no padding, so an
input or select touches the card border. `Drawer.Header` and `Drawer.Footer` each carry `p-4`; only
the body is unpadded.

The padding goes in the **Drawer branch only**. `ui/dialog/dialog-content.svelte` already applies
`p-4`, so a shared wrapper would double-pad desktop. The two branches are separate in this
component, so keeping it one-sided is structural rather than a breakpoint trick.

Both `title` and `footer` are optional, so vertical padding is conditional: the body needs `pt-4`
only when there is no header, and `pb-4` only when there is no footer.

**Files:**
- Modify: `src/lib/components/overlays/ResponsiveDialogDrawer.svelte:53-75`
- Modify: `src/lib/components/overlays/ResponsiveDialogDrawerTestWrapper.svelte`
- Test: `src/lib/components/overlays/ResponsiveDialogDrawer.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ResponsiveDialogDrawer` accepts `flush?: boolean` (default `false`). When false, the
  body is wrapped in a `div` carrying `px-4`, plus `pt-4` if no `title`/`description` and `pb-4` if
  no `footer`. When true, the body renders with no wrapper padding. Tasks 3 and 4 rely on this.

- [ ] **Step 1: Give the test wrapper the knobs the tests need**

The existing wrapper always passes `title`, `description` and `footer`, so the conditional padding
cannot be exercised. Replace `src/lib/components/overlays/ResponsiveDialogDrawerTestWrapper.svelte`
with:

```svelte
<script lang="ts">
  import ResponsiveDialogDrawer from './ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input/index.js';

  let {
    open = true,
    title = 'Test Title',
    description = 'Test Description',
    onOpenChange = () => {},
    parentCount = 0,
    flush = false,
    withFooter = true
  } = $props<{
    open?: boolean;
    title?: string;
    description?: string;
    onOpenChange?: (open: boolean) => void;
    parentCount?: number;
    flush?: boolean;
    withFooter?: boolean;
  }>();

  let text = $state('draft content');
</script>

<Button id="trigger-btn">Open Trigger</Button>
<ResponsiveDialogDrawer {open} {title} {description} {onOpenChange} {flush}>
  <div data-testid="content">
    <p>Parent count: {parentCount}</p>
    <Input data-testid="draft-input" value={text} onInput={(v) => text = v} />
  </div>
  {#if withFooter}
    {#snippet footer()}
      <Button data-testid="footer-btn">Submit</Button>
    {/snippet}
  {/if}
</ResponsiveDialogDrawer>
```

Passing `title={undefined}` from a test omits the header, and `withFooter={false}` omits the footer.

- [ ] **Step 2: Write the failing tests**

Append inside the existing `describe` block in
`src/lib/components/overlays/ResponsiveDialogDrawer.test.ts`:

```ts
  it('pads the drawer body so content clears the card edge', () => {
    mockMatchMedia(true);
    render(ResponsiveDialogDrawerTestWrapper, {});

    const body = screen.getByTestId('content').parentElement!;
    expect(body.className).toContain('px-4');
  });

  it('leaves the desktop dialog body unpadded, since Dialog.Content already pads it', () => {
    mockMatchMedia(false);
    render(ResponsiveDialogDrawerTestWrapper, {});

    const body = screen.getByTestId('content').parentElement!;
    // Doubling p-4 from Dialog.Content with another px-4 would inset desktop
    // content twice.
    expect(body.className).not.toContain('px-4');
  });

  it('drops body padding entirely when flush is set', () => {
    mockMatchMedia(true);
    render(ResponsiveDialogDrawerTestWrapper, { flush: true });

    const body = screen.getByTestId('content').parentElement!;
    expect(body.className).not.toContain('px-4');
    expect(body.className).not.toContain('pt-4');
    expect(body.className).not.toContain('pb-4');
  });

  it('adds top padding only when there is no header to supply it', () => {
    mockMatchMedia(true);
    const { unmount } = render(ResponsiveDialogDrawerTestWrapper, {});
    expect(screen.getByTestId('content').parentElement!.className).not.toContain('pt-4');
    unmount();
    cleanup();

    render(ResponsiveDialogDrawerTestWrapper, { title: undefined, description: undefined });
    expect(screen.getByTestId('content').parentElement!.className).toContain('pt-4');
  });

  it('adds bottom padding only when there is no footer to supply it', () => {
    mockMatchMedia(true);
    const { unmount } = render(ResponsiveDialogDrawerTestWrapper, {});
    expect(screen.getByTestId('content').parentElement!.className).not.toContain('pb-4');
    unmount();
    cleanup();

    render(ResponsiveDialogDrawerTestWrapper, { withFooter: false });
    expect(screen.getByTestId('content').parentElement!.className).toContain('pb-4');
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/components/overlays/ResponsiveDialogDrawer.test.ts`
Expected: FAIL — there is no wrapper element around the body, so `parentElement` is
`Drawer.Content` and carries none of these classes.

- [ ] **Step 4: Implement**

In `src/lib/components/overlays/ResponsiveDialogDrawer.svelte`, add `cn` to the imports:

```svelte
  import { cn } from '$lib/utils';
```

Add `flush` to the props destructuring and its type:

```svelte
    flush = false,
```
```ts
    flush?: boolean;
```

Then, in the **Drawer branch only** (the `{:else}` half), replace:

```svelte
      {#if children}
        {@render children()}
      {/if}
```

with:

```svelte
      {#if children}
        <!--
          Drawer.Content has no padding of its own, so an input rendered here
          would touch the card border. Header and Footer each carry p-4, so the
          body only supplies the vertical padding they are not already giving.
          This wrapper is deliberately absent from the Dialog branch above:
          Dialog.Content already applies p-4, and doubling it would inset
          desktop content twice.
        -->
        <div
          class={cn(
            !flush && 'px-4',
            !flush && !(title || description) && 'pt-4',
            !flush && !footer && 'pb-4'
          )}
        >
          {@render children()}
        </div>
      {/if}
```

Leave the Dialog branch untouched.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/components/overlays/ResponsiveDialogDrawer.test.ts`
Expected: PASS, including the file's pre-existing cases.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/overlays/ResponsiveDialogDrawer.svelte src/lib/components/overlays/ResponsiveDialogDrawerTestWrapper.svelte src/lib/components/overlays/ResponsiveDialogDrawer.test.ts
git commit -m "feat(web): pad the drawer body so overlay content clears the card edge"
```

---

### Task 2: Move overlay heights from `vh` to `dvh`

`ui/drawer/drawer-content.svelte:33` caps bottom and top drawers at `max-h-[80vh]`. On iOS Safari
`80vh` is 80% of the *tallest* viewport, not the visible one — the same trap already fixed in the
app shell, one size smaller. Six other overlay surfaces have the same issue.

The existing guard only matches `h-screen` and `100vh`, so every one of these slipped through.
Widening it is what stops the trap returning at a third magnitude.

**Files:**
- Modify: `src/lib/components/shell/shell-boundary.test.ts`
- Modify: `src/lib/components/ui/drawer/drawer-content.svelte:20-33`
- Modify: `src/lib/components/concepts/ConceptDetailModal.svelte:160,170`
- Modify: `src/lib/components/training/GalleryImageViewer.svelte:212,243`
- Modify: `src/lib/components/overlays/OptionSheet.svelte:40`
- Modify: `src/routes/(app)/datasets/[id]/+page.svelte:136`

**Interfaces:**
- Consumes: nothing.
- Produces: `findViewportUnitViolations` also rejects `<n>vh`. Task 4 relies on `dvh` being the
  accepted unit when it sets the picker's height.

- [ ] **Step 1: Widen the guard**

In `src/lib/components/shell/shell-boundary.test.ts`, replace the body of
`findViewportUnitViolations`:

```ts
export function findViewportUnitViolations(source: string, filename: string): string[] {
  if (VIEWPORT_UNIT_EXEMPT.includes(filename)) return [];

  const violations: string[] = [];
  source.split('\n').forEach((line, i) => {
    // `\d+vh` deliberately does not match `100dvh` -- the character before
    // `vh` there is `d`, not a digit.
    if (/\bh-screen\b/.test(line) || /\d+vh\b/.test(line)) {
      violations.push(
        `${filename}:${i + 1}: use dvh -- vh measures the tallest viewport, not the visible one, so it overflows under iOS Safari's chrome`
      );
    }
  });
  return violations;
}
```

- [ ] **Step 2: Run it to verify it fails, and record the list**

Run: `npx vitest run src/lib/components/shell/shell-boundary.test.ts`
Expected: FAIL, listing seven violations across `drawer-content.svelte` (one line, two
occurrences), `ConceptDetailModal.svelte`, `GalleryImageViewer.svelte`, `OptionSheet.svelte` and
`datasets/[id]/+page.svelte`. Copy that list into your report — it is the work for Step 3.

- [ ] **Step 3: Convert every one to `dvh`**

| File | Change |
|---|---|
| `ui/drawer/drawer-content.svelte:33` | `data-[vaul-drawer-direction=bottom]:max-h-[80vh]` → `…max-h-[80dvh]` **and** `data-[vaul-drawer-direction=top]:max-h-[80vh]` → `…max-h-[80dvh]` (same line, two occurrences) |
| `concepts/ConceptDetailModal.svelte:160` | `max-h-[90vh]` → `max-h-[90dvh]` |
| `concepts/ConceptDetailModal.svelte:170` | `max-h-[60vh]` → `max-h-[60dvh]` |
| `training/GalleryImageViewer.svelte:212` | `max-h-[65vh]` → `max-h-[65dvh]` |
| `training/GalleryImageViewer.svelte:243` | `max-h-[65vh]` → `max-h-[65dvh]` |
| `overlays/OptionSheet.svelte:40` | `max-h-[60vh]` → `max-h-[60dvh]` |
| `routes/(app)/datasets/[id]/+page.svelte:136` | `max-h-[90vh]` → `max-h-[90dvh]` |

Leave `max-w-[90vw]` on that last line alone — `vw` has no equivalent defect.
Leave `routes/login/+page.svelte:108` alone — it is already exempt.

`drawer-content.svelte` is vendored and already carries a `LOCAL MODIFICATION` comment for its
inset-card geometry. Add a sentence to that existing comment recording the unit change and why,
rather than starting a second comment block.

- [ ] **Step 4: Run the guard and the affected unit tests**

Run: `npx vitest run src/lib/components/shell/shell-boundary.test.ts src/lib/components/overlays/ src/lib/components/concepts/ src/lib/components/training/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/shell/shell-boundary.test.ts src/lib/components/ui/drawer/drawer-content.svelte src/lib/components/concepts/ConceptDetailModal.svelte src/lib/components/training/GalleryImageViewer.svelte src/lib/components/overlays/OptionSheet.svelte "src/routes/(app)/datasets/[id]/+page.svelte"
git commit -m "fix(web): measure overlay heights in dvh so they fit the visible viewport"
```

---

### Task 3: Opt the full-bleed consumers out, drop redundant padding

Two consumers want their content edge-to-edge. `OptionSheet`'s rows are full-width tap targets
that already carry their own `px-4`; padding the body would inset them and narrow the target that
Task 3 of the previous plan worked to guarantee. `GalleryImageViewer` shows an image that reads as
boxed when inset.

One consumer now double-pads: `DatasetPickerModal`'s scroll area carries `p-2`, which sits inside
the new `px-4`.

**Files:**
- Modify: `src/lib/components/overlays/OptionSheet.svelte`
- Modify: `src/lib/components/training/GalleryImageViewer.svelte:177`
- Modify: `src/lib/components/datasets/DatasetPickerModal.svelte`

**Interfaces:**
- Consumes: the `flush` prop from Task 1.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/components/overlays/OptionSheet.test.ts`, inside its `describe`:

```ts
  it('renders its rows edge-to-edge so the full row width stays tappable', async () => {
    render(OptionSheet, {
      open: true,
      title: 'Training Method',
      options: OPTIONS,
      value: 'LORA',
      onSelect: vi.fn(),
      onOpenChange: vi.fn(),
    });

    const option = await screen.findByRole('option', { name: 'Fine Tune' });
    // The option list must not sit inside the drawer's padded body wrapper:
    // insetting it would shrink the 44px-wide tap target on every row.
    const listbox = option.closest('[role="listbox"]')!;
    expect(listbox.parentElement!.className).not.toContain('px-4');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/components/overlays/OptionSheet.test.ts`
Expected: FAIL — the listbox now sits inside the padded wrapper added in Task 1.

- [ ] **Step 3: Pass `flush` from both full-bleed consumers**

In `src/lib/components/overlays/OptionSheet.svelte`, add `flush` to the
`<ResponsiveDialogDrawer …>` opening tag:

```svelte
<ResponsiveDialogDrawer {open} {onOpenChange} {title} flush>
```

In `src/lib/components/training/GalleryImageViewer.svelte:177`, add `flush` to its
`<ResponsiveDialogDrawer` opening tag in the same way. Keep every other prop it already passes.

- [ ] **Step 4: Remove the now-redundant inner padding**

In `src/lib/components/datasets/DatasetPickerModal.svelte`, find the element whose class is
`min-h-[280px] max-h-[480px] p-2` and delete the `p-2`. The body wrapper supplies the horizontal
padding now, and keeping both reads as a double inset.

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run src/lib/components/overlays/ src/lib/components/datasets/ src/lib/components/training/GalleryImageViewer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/overlays/OptionSheet.svelte src/lib/components/overlays/OptionSheet.test.ts src/lib/components/training/GalleryImageViewer.svelte src/lib/components/datasets/DatasetPickerModal.svelte
git commit -m "fix(web): keep list and image overlays full-bleed, drop a doubled inset"
```

---

### Task 4: Move the file dialog to the bottom drawer, delete the sheet wrapper

`DirectoryPicker` is the only consumer of `ResponsiveDialogSheet`, so moving it deletes that
wrapper. It also deletes a bug: the sheet asks for `full-screen inset-0 w-full h-dvh`, but
`ui/sheet/sheet-content.svelte`'s `data-[side=right]:w-3/4` carries an attribute qualifier and
outranks a plain `w-full`, so the "full-screen" picker actually renders 293px wide and
side-anchored on a 390px phone.

Write the geometry assertions first. They fail today because the picker slides in horizontally
from the right, and they are what proves the change landed — a class-presence check would not.

**Files:**
- Modify: `e2e/mobile-layout.spec.ts`
- Modify: `src/lib/components/directory/DirectoryPicker.svelte:11,208-213,215`
- Modify: `src/lib/components/directory/DirectoryPicker.test.ts:70-84`
- Modify: `e2e/responsive-workflows.spec.ts:91-94`
- Modify: `e2e/mobile.spec.ts:28`
- Delete: `src/lib/components/overlays/ResponsiveDialogSheet.svelte`, `ResponsiveDialogSheet.test.ts`, `ResponsiveDialogSheetTestWrapper.svelte`

**Interfaces:**
- Consumes: the `flush` prop and padded body from Task 1; `dvh` from Task 2.
- Produces: the picker renders `[data-slot="drawer-content"]`; no `full-screen` class exists
  anywhere in the app afterwards.

- [ ] **Step 1: Write the failing e2e assertions**

Add to `e2e/mobile-layout.spec.ts`, inside `test.describe("Phone layout", ...)`:

```ts
  test("the file dialog slides up from the bottom", async ({ page }) => {
    await page.goto("/general");

    // Arm the observer BEFORE the click, so the panel is caught the instant it
    // mounts and the animation can still be sampled from its first frame.
    await page.evaluate(() => {
      (window as any).__panel = new Promise<HTMLElement>((resolve) => {
        const obs = new MutationObserver(() => {
          const el = document.querySelector("[data-slot='drawer-content']") as HTMLElement | null;
          if (el) {
            obs.disconnect();
            resolve(el);
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
      });
    });

    await page.getByRole("button", { name: "Browse directory" }).first().click();

    const travel = await page.evaluate(async () => {
      const el = (await (window as any).__panel) as HTMLElement;

      const anims = el.getAnimations();
      if (anims.length === 0) return { animated: false, startY: 0, endY: 0, viewportH: 0 };
      const a = anims[0];
      a.pause();
      const duration = Number(a.effect?.getComputedTiming().activeDuration ?? 0);
      a.currentTime = 0;
      const startY = el.getBoundingClientRect().y;
      a.currentTime = duration;
      const endY = el.getBoundingClientRect().y;
      a.play();
      return { animated: true, startY, endY, viewportH: window.innerHeight };
    });

    expect(travel.animated, "the file dialog has no running animation").toBe(true);
    // Starts at or below the bottom edge, and travels upward to rest.
    expect(travel.startY).toBeGreaterThanOrEqual(travel.viewportH - 1);
    expect(travel.endY).toBeLessThan(travel.startY);
  });

  test("the file dialog is a wide inset card, not a side panel", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Browse directory" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Select Directory" });
    await expect(dialog).toBeVisible();
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
    });

    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;

    // 12px inset each side -- not the 293px (w-3/4) side panel it used to be.
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 25);
    expect(box.width).toBeLessThanOrEqual(viewport.width - 23);
    expect(box.height).toBeLessThanOrEqual(viewport.height * 0.9 + 1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  });
```

Both tests reach the trigger with the same `getByRole("button", { name: "Browse directory" })`
locator that `e2e/accessibility.spec.ts` already uses. The first splits the work across three
steps — arm the observer, click, then read — because the observer has to exist before the click,
but the click itself must not depend on guessing how the button's accessible name is produced.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "file dialog"`
Expected: FAIL both — the picker currently slides horizontally and measures 293px wide. Record the
reported numbers in your report; they are the before-evidence.

- [ ] **Step 3: Switch the picker to the drawer**

In `src/lib/components/directory/DirectoryPicker.svelte`, change the import on line 11:

```svelte
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
```

Change the opening tag (line 208) and its closing tag (line 354):

```svelte
<ResponsiveDialogDrawer
  bind:open
  onOpenChange={handleOpenChange}
  title={modalTitle}
  class="sm:max-w-[650px] max-h-[90dvh]"
>
```

```svelte
</ResponsiveDialogDrawer>
```

The picker needs more height than the shared `80dvh` default, hence the `max-h-[90dvh]` override.

Then drop the now-redundant `p-1` on line 215 — the body wrapper supplies the padding:

```svelte
    <div class="picker-container flex flex-col gap-3">
```

- [ ] **Step 4: Delete the sheet wrapper**

```bash
git rm src/lib/components/overlays/ResponsiveDialogSheet.svelte src/lib/components/overlays/ResponsiveDialogSheet.test.ts src/lib/components/overlays/ResponsiveDialogSheetTestWrapper.svelte
```

Then confirm nothing still references it:

```bash
grep -rn "ResponsiveDialogSheet\|full-screen" src/ e2e/
```

Every remaining hit must be dealt with in Steps 5-6. There should be none left in `src/`.

- [ ] **Step 5: Update the picker's unit test**

In `src/lib/components/directory/DirectoryPicker.test.ts`, replace the assertion block at lines
76-83 (the one querying `[data-slot="sheet-content"]` and checking for `full-screen` / `inset-0` /
`h-dvh` / `w-full`) with:

```ts
    const targetEl = document.body.querySelector('[data-slot="drawer-content"]');
    expect(targetEl, 'the picker should render as a bottom drawer').not.toBeNull();
    // The old sheet claimed `full-screen` while rendering 293px wide, because
    // sheet-content's `data-[side=right]:w-3/4` outranked its `w-full`.
    expect(document.body.querySelector('.full-screen')).toBeNull();
```

Leave the rest of that test — the `mockMatchMedia(true)` setup and the `findByRole("dialog")`
assertion — as it is.

- [ ] **Step 6: Update the two stale e2e references**

In `e2e/responsive-workflows.spec.ts`, replace the assertion at line 94:

```ts
      await expect(sheet).toHaveClass(/full-screen/);
```

with a check that it is the bottom drawer:

```ts
      await expect(sheet).toHaveAttribute("data-slot", "drawer-content");
```

If the element the `sheet` locator resolves to is not the one carrying `data-slot`, assert on
`page.locator("[data-slot='drawer-content']")` being visible instead — read the surrounding lines
and pick whichever matches the actual DOM.

In `e2e/mobile.spec.ts:28`, rename the test — it still tests focus trapping, which is unchanged,
but "full-screen" is now wrong:

```ts
  test("directory picker focus trap, wrap, Escape, and focus restoration", async ({ page }) => {
```

- [ ] **Step 7: Run the failing tests from Step 1, now expecting green**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "file dialog"`
Expected: PASS both. Put the after-numbers beside the before-numbers in your report.

- [ ] **Step 8: Run the unit tests and the other affected e2e**

Run: `npx vitest run src/lib/components/directory/ src/lib/components/overlays/`
Run: `npx playwright test e2e/mobile.spec.ts e2e/responsive-workflows.spec.ts --project=chromium-phone`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A src/lib/components/directory/ src/lib/components/overlays/ e2e/
git commit -m "feat(web): slide the file dialog up from the bottom and retire the sheet wrapper"
```

---

### Task 5: Baselines and full verification

**Files:**
- Modify: `e2e/visual.spec.ts:129`
- Modify: `e2e/visual.spec.ts-snapshots/*.png` (only after inspection)

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Rename the visual test to match what it now captures**

In `e2e/visual.spec.ts:129`, the test is titled `directory picker Sheet phone` and its snapshot is
`directory-picker-sheet-phone.png`. Rename both to `directory picker Drawer phone` /
`directory-picker-drawer-phone.png`, and `git rm` the old
`e2e/visual.spec.ts-snapshots/directory-picker-sheet-phone-chromium-phone-linux.png`. A renamed
snapshot is generated fresh, which is what we want — the old image shows a 293px side panel.

Add an animation-settle wait before the screenshot if the test does not already have one, so the
capture is of the resting card rather than a frame mid-slide:

```ts
      await page.evaluate(async () => {
        await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
      });
```

- [ ] **Step 2: Run the phone visual suite and inspect every diff**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone`
Expected: the renamed test fails as a missing snapshot; others may differ where the new body
padding shows.

For each failure open the `-diff.png` under `test-results/` and describe in your report what
changed. Only proceed if every diff is explained by this plan: a bottom-anchored inset file dialog,
or overlay content inset by 16px. **If any diff shows something else, stop and report BLOCKED.**

- [ ] **Step 3: Regenerate the inspected baselines**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone --update-snapshots`

- [ ] **Step 4: Unit suite and type check**

Run: `npx vitest run`
Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error`
Expected: PASS, 0 errors.

- [ ] **Step 5: Full phone suite**

Run: `npx playwright test --project=chromium-phone`
Expected: PASS.

- [ ] **Step 6: Full desktop suite**

Run: `npx playwright test --project=chromium-desktop`
Expected: PASS with **zero** snapshot changes. Every change in this plan is in the Drawer branch or
the mobile picker path; a desktop visual diff means the body padding leaked into the Dialog branch.
If that happens, report it rather than regenerating desktop baselines.

- [ ] **Step 7: Commit**

```bash
git add e2e/visual.spec.ts e2e/visual.spec.ts-snapshots/
git commit -m "test(web): rebaseline the file dialog as a bottom drawer"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| File dialog slides up from the bottom | 4 |
| File dialog wider than the 293px side panel | 4 (asserted as viewport − 24px) |
| ~90% height for browsing | 4 (`max-h-[90dvh]`) |
| Move `DirectoryPicker` to `ResponsiveDialogDrawer` | 4 |
| Delete `ResponsiveDialogSheet` + its two test files | 4 |
| Body padding in the Drawer branch only | 1 |
| `pt-4` when no header, `pb-4` when no footer | 1 |
| `flush` opt-out prop | 1 |
| `OptionSheet` and `GalleryImageViewer` opt out | 3 |
| `DatasetPickerModal` drops its redundant `p-2` | 3 |
| Drawer `max-h` → `dvh` | 2 |
| Widen the viewport-unit guard to any `<n>vh` | 2 |
| Geometry-based animation assertion | 4 |
| Update `responsive-workflows` / `mobile` / `visual` e2e | 4, 5 |
| Zero desktop snapshot drift | 5 |

No gaps.

**Type consistency:** `flush?: boolean` is defined in Task 1 and consumed by name in Tasks 3 and 4.
`findViewportUnitViolations` keeps its `(source, filename) => string[]` signature in Task 2. The
`data-slot="drawer-content"` attribute asserted in Task 4's unit test, its e2e assertions and the
`responsive-workflows` update are the same string throughout.

**Placeholders:** none. Task 5 Step 2 is a judgement step by necessity — it names the two diffs
that are acceptable and instructs a BLOCKED report for anything else. Task 4 Step 6 carries a
conditional because the `sheet` locator's exact target cannot be confirmed without reading the
surrounding lines; the alternative assertion is given explicitly rather than left open.

**One risk worth naming:** Task 1's tests locate the body wrapper via
`screen.getByTestId('content').parentElement`. That holds because the test wrapper renders a single
`div[data-testid="content"]` as the whole body. If the implementer restructures the test wrapper
beyond what Step 1 specifies, those assertions silently start measuring the wrong element.
