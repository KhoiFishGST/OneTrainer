# Mobile UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shell chrome fit on a phone — move the training status to the bottom bar, stop the theme toggle being clipped — and repair the test infrastructure that hid these defects.

**Architecture:** The training status pill becomes one `TrainingStatusPill` component rendered in two places, CSS-gated: in the header at `md`+, in the status bar below it. The header's mobile row is made shrinkable so nothing overflows. The e2e suite is changed to build before it serves, and its overflow guard is generalised to catch clipped-but-not-scrolling content.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind 4, shadcn-svelte (bits-ui), Vitest + @testing-library/svelte, Playwright.

## Background: what went wrong

Review of the previous plan's output found four defects. Three of them are one causal chain:

1. `Header.svelte:286-295` gives **both** `.header-left` and `.header-right` `flex-shrink: 0` under `flex-wrap: nowrap`. Neither side can give, so `.header-right` overflows and the `overflow-hidden` shell clips it. Measured on a fresh build:

   | Viewport | header scrollWidth/client | status pill | theme toggle |
   |---|---|---|---|
   | 430px | 493 / 430 | x=441–493, off-screen | visible |
   | 390px | 493 / 390 | x=441–493, off-screen | clipped (right=393) |
   | 360px | 467 / 360 | x=441–463, off-screen | clipped |
   | 320px | 467 / 320 | off-screen | clipped |

2. `e2e/mobile-layout.spec.ts` asserts `documentElement.scrollWidth <= clientWidth`. Because the shell is `overflow-hidden`, clipped content never becomes document scroll — the guard read `390/390` while 103px of header sat outside the viewport. It cannot detect this class of bug.

3. `playwright.config.ts` serves `build/` and nothing rebuilds it. The suite last ran against a build predating the final three commits, so those commits shipped unverified.

4. Two phone visual baselines were regenerated against that stale build and no longer match the source.

**Design change from the user:** the status pill is too big for a top bar already full of icons. On phones it moves to the bottom-left of the status bar. Desktop is unchanged. This also removes the need for the `max-[380px]` dot collapse — the status bar has room for the full label.

## Global Constraints

- **Working directory is `web/`.** All paths and commands are relative to it.
- **Stop any dev server on port 7801 before running e2e** (`python scripts/train_ui_web.py --dev` binds it). Playwright uses `reuseExistingServer: false` and will refuse to start otherwise.
- **Breakpoint is `md` = 768px.** Mobile means `< 768px`.
- **Never gate shell rendering on `isMobile.current`** — `shell-boundary.test.ts` enforces this. `Rail.svelte` is the one documented exemption.
- **Scoped Svelte CSS beats Tailwind utilities.** Svelte's `<style>` rules are unlayered; Tailwind utilities live in `@layer utilities`, and unlayered rules win regardless of specificity. A scoped `.status-pill { display: inline-flex }` will therefore defeat a `hidden` utility on the same element. This exact trap already cost one commit (`043c650e`, where `.selectors { display: flex }` kept the desktop header visible on phones). **Any property a Tailwind utility needs to control must not appear in a scoped rule.**
- **Unit tests:** `npx vitest run <path>`. **E2E:** `npx playwright test <file> --project=<name>`.
- Commit after every task, conventional prefixes.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/components/shell/TrainingStatusPill.svelte` | The pill: state → label + token classes. Rendered twice, CSS-gated. |
| `src/lib/components/shell/TrainingStatusPill.test.ts` | Its unit tests |
| `src/lib/components/e2e-boundary.test.ts` | Static guard: the e2e server must build before serving |

**Modify:**

| File | Change |
|---|---|
| `playwright.config.ts` | Build before serving; raise the webServer timeout |
| `e2e/mobile-layout.spec.ts` | Add a clipped-control guard across four phone widths |
| `e2e/mobile.spec.ts:138` | Target the status bar's pill on phones |
| `src/lib/components/shell/HeaderStatus.svelte` | Delegate to `TrainingStatusPill`, desktop-only |
| `src/lib/components/shell/StatusBar.svelte` | Render the pill bottom-left on phones |
| `src/lib/components/shell/Header.svelte` | Make the mobile row shrinkable and degrade below 380px |
| `src/lib/components/shell/Header.test.ts` | Replace the dot-collapse test |
| `src/lib/components/shell/StatusBar.test.ts` | Add footer-pill cases |
| `src/lib/components/ui/drawer/drawer-content.svelte` | Add the local-modification marker |
| `src/lib/components/ui/sidebar/constants.ts` | Add the local-modification marker |
| `src/lib/components/shell/ErrorBanner.svelte:34` | Replace the unexplained `py-[7px]` |
| `e2e/visual.spec.ts-snapshots/*.png` | Regenerate two stale phone baselines |

---

### Task 1: Make e2e test the code that actually ships

This task comes first because every later task's e2e result is meaningless until it lands. `playwright.config.ts` starts `e2e_server.py`, which serves the static `build/` directory, and nothing regenerates that directory. A run can therefore pass against output that is hours out of date — which is exactly what happened.

**Files:**
- Modify: `playwright.config.ts:14-19`
- Create: `src/lib/components/e2e-boundary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `findStaleBuildRisk(source: string): string[]` — exported so the guard can be unit-tested and extended.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/e2e-boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const configSource = Object.values(
  import.meta.glob('/playwright.config.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0];

/**
 * The e2e server serves the static `build/` directory. If the suite does not
 * rebuild first it silently tests whatever was built last -- a run can go
 * green against code that no longer exists. That is not hypothetical: three
 * commits once shipped unverified because `build/` was two hours stale while
 * the suite reported success.
 */
export function findStaleBuildRisk(source: string): string[] {
  const webServer = source.match(/webServer\s*:\s*\{[\s\S]*?\}/)?.[0];
  if (!webServer) return ['playwright.config.ts: no webServer block found'];

  const command = webServer.match(/command\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  if (!command) return ['playwright.config.ts: webServer has no command'];

  if (!/\bbuild\b/.test(command)) {
    return [
      `playwright.config.ts: webServer command must build before serving, got "${command}"`,
    ];
  }
  return [];
}

describe('e2e boundaries', () => {
  it('rebuilds the app before serving it to the browser', () => {
    expect(findStaleBuildRisk(configSource)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/e2e-boundary.test.ts`
Expected: FAIL — `webServer command must build before serving, got "python ../tests/webui/e2e_server.py --root .e2e --port 7801"`

- [ ] **Step 3: Make it pass**

In `playwright.config.ts`, change the `webServer` block:

```ts
  webServer: {
    // Build first: e2e_server.py serves the static `build/` directory, so
    // without this the suite silently tests the previous build.
    command: "npm run build && python ../tests/webui/e2e_server.py --root .e2e --port 7801",
    url: "http://127.0.0.1:7801/api/health",
    reuseExistingServer: false,
    timeout: 180000,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/e2e-boundary.test.ts`
Expected: PASS

- [ ] **Step 5: Prove the staleness was real**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone`
Expected: FAIL — `shell phone dark and light` and `ordinary editor Drawer phone`. These two baselines were captured against the stale build; the failure confirms the build step is now taking effect. Task 5 regenerates them, after the layout is actually correct. Do not regenerate them here.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts src/lib/components/e2e-boundary.test.ts
git commit -m "test(web): build before serving so e2e tests the code that ships"
```

---

### Task 2: Make the overflow guard catch clipped content

The existing guard only sees overflow that produces document scroll. The shell is `overflow-hidden`, so a control pushed outside the viewport is clipped silently and the guard stays green. This adds a direct assertion — every shell control must lie within the viewport — across four phone widths.

This test is expected to **fail** at the end of this task. It is the reproduction for Tasks 3 and 4.

**Files:**
- Modify: `e2e/mobile-layout.spec.ts`

**Interfaces:**
- Consumes: `data-testid="header-mobile-bar"` (existing).
- Produces: the failing reproduction that Tasks 3 and 4 must turn green.

- [ ] **Step 1: Write the failing test**

Append to `e2e/mobile-layout.spec.ts`, inside `test.describe("Phone layout", ...)`:

```ts
  /**
   * The app shell is `overflow-hidden`, so content pushed past the right edge
   * is clipped rather than scrolled. `document.scrollWidth` therefore stays
   * equal to `clientWidth` and the horizontal-scroll check above cannot see
   * it. Measure the controls themselves instead.
   */
  for (const width of [320, 360, 390, 430]) {
    test(`no shell control is clipped at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/general");
      await page.waitForLoadState("networkidle");

      const clipped = await page.evaluate((vw) => {
        const selectors = [
          '[aria-label="Open navigation"]',
          '[data-testid="header-mobile-bar"] button',
          '[aria-label^="Switch to"]',
          '[data-testid="training-status-pill-mobile"]',
          "footer button",
        ];
        const out: string[] = [];
        for (const selector of selectors) {
          const nodes = [...document.querySelectorAll(selector)] as HTMLElement[];
          if (nodes.length === 0) {
            out.push(`${selector}: not rendered`);
            continue;
          }
          for (const el of nodes) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right > vw + 1 || r.left < -1) {
              const name = el.getAttribute("aria-label") ?? el.textContent?.trim() ?? selector;
              out.push(`${name}: ${Math.round(r.left)}..${Math.round(r.right)} outside 0..${vw}`);
            }
          }
        }
        return out;
      }, width);

      expect(clipped, `Clipped at ${width}px:\n${clipped.join("\n")}`).toEqual([]);
    });
  }
```

- [ ] **Step 2: Run the test and record the failures**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "no shell control is clipped"`
Expected: FAIL at all four widths. The reported list should name the theme toggle (`Switch to ... theme`) and `[data-testid="training-status-pill-mobile"]: not rendered`. Keep this output — Tasks 3 and 4 clear it.

- [ ] **Step 3: Commit the failing guard**

Committing a known-failing guard is deliberate: it is the reproduction, and the next two tasks are defined by making it pass.

```bash
git add e2e/mobile-layout.spec.ts
git commit -m "test(web): assert shell controls are inside the viewport, not merely unscrolled"
```

---

### Task 3: Move the training status to the bottom bar on phones

One `TrainingStatusPill` component, rendered twice and chosen by CSS: in the header at `md`+, in the status bar below `md`. The status bar becomes `justify-between` so the pill sits bottom-left and the training controls stay right.

Two testids, because both instances exist in the DOM at once and Playwright's strict mode rejects an ambiguous locator: `training-status-pill` stays on the header (desktop) instance so existing unit tests keep working, and the new footer instance is `training-status-pill-mobile`.

**Watch the scoped-CSS trap.** `HeaderStatus.svelte:87` currently declares `.status-pill { display: inline-flex; ... }`. Moving that rule as-is into the new component would override the `hidden` utility and render both pills at every width. `display` must come from Tailwind utilities only.

**Files:**
- Create: `src/lib/components/shell/TrainingStatusPill.svelte`
- Create: `src/lib/components/shell/TrainingStatusPill.test.ts`
- Modify: `src/lib/components/shell/HeaderStatus.svelte`
- Modify: `src/lib/components/shell/StatusBar.svelte`
- Modify: `src/lib/components/shell/Header.test.ts:199-208`
- Modify: `src/lib/components/shell/StatusBar.test.ts`
- Modify: `e2e/mobile.spec.ts:138`

**Interfaces:**
- Consumes: `trainingStore` (existing).
- Produces:
  ```ts
  // TrainingStatusPill.svelte props
  // testId: string   -- data-testid to emit
  // class?: string   -- visibility utilities supplied by the caller
  ```
  Header renders it with `testId="training-status-pill"` and `class="hidden md:inline-flex"`.
  StatusBar renders it with `testId="training-status-pill-mobile"` and `class="inline-flex md:hidden"`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/shell/TrainingStatusPill.test.ts`:

```ts
import { render, screen, cleanup } from '@testing-library/svelte';
import { expect, it, describe, beforeEach } from 'vitest';
import TrainingStatusPill from './TrainingStatusPill.svelte';
import { trainingStore } from '../../events/training-store';

describe('TrainingStatusPill', () => {
  beforeEach(() => {
    cleanup();
    trainingStore.reset();
  });

  it('renders the current training state under the requested test id', () => {
    render(TrainingStatusPill, { testId: 'pill-under-test' });

    const pill = screen.getByTestId('pill-under-test');
    expect(pill).toHaveTextContent('IDLE');
    expect(pill.className).toContain('text-muted-foreground');
  });

  it('uses semantic token classes rather than hex colours', () => {
    trainingStore.setStatus({ state: 'COMPLETED' } as any);
    render(TrainingStatusPill, { testId: 'pill-under-test' });

    const pill = screen.getByTestId('pill-under-test');
    expect(pill.className).toMatch(/success/);
    expect(pill.getAttribute('style') ?? '').not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('takes its display from the caller so CSS gating is not overridden', () => {
    render(TrainingStatusPill, { testId: 'pill-under-test', class: 'hidden md:inline-flex' });

    const pill = screen.getByTestId('pill-under-test');
    expect(pill.className).toContain('hidden');
    // A scoped `display` would beat the utility, since Svelte's styles are
    // unlayered and Tailwind's are in @layer utilities.
    expect(pill.className).toContain('md:inline-flex');
  });
});
```

Replace the dot-collapse test at `src/lib/components/shell/Header.test.ts:199-208` with:

```ts
  it('keeps the training status out of the mobile header row', () => {
    render(HeaderTestWrapper, {});

    const pill = screen.getByTestId('training-status-pill');
    expect(pill).toHaveTextContent('IDLE');
    // The phone shows its status in the bottom bar instead -- the top row is
    // full of config icons.
    expect(pill.className).toContain('hidden');
    expect(pill.className).toContain('md:inline-flex');
    expect(pill.className).not.toContain('max-[380px]:');
  });
```

Append to `src/lib/components/shell/StatusBar.test.ts`, inside its `describe`:

```ts
  it('shows the training status at the start of the phone status bar', () => {
    render(StatusBarTestWrapper, {});

    const pill = screen.getByTestId('training-status-pill-mobile');
    expect(pill).toHaveTextContent('IDLE');
    expect(pill.className).toContain('md:hidden');
  });

  it('pushes the controls away from the status pill without disturbing desktop', () => {
    render(StatusBarTestWrapper, {});

    const pill = screen.getByTestId('training-status-pill-mobile');
    // `mr-auto` on the pill, not `justify-between` on the footer: the pill is
    // display:none at md+, so justify-between would leave one child and drop
    // the desktop controls to the left edge.
    expect(pill.className).toContain('mr-auto');
    expect(pill.closest('footer')!.className).toContain('justify-end');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/components/shell/`
Expected: FAIL — `TrainingStatusPill.svelte` does not resolve; `training-status-pill-mobile` is not found; the header pill has no `hidden` class.

- [ ] **Step 3: Create the component**

Create `src/lib/components/shell/TrainingStatusPill.svelte`:

```svelte
<script lang="ts">
  import { cn } from '$lib/utils';
  import { trainingStore } from '../../events/training-store';

  let { testId, class: className = '' } = $props<{
    testId: string;
    class?: string;
  }>();

  const trainingState = $derived($trainingStore.status?.state ?? 'IDLE');

  const statusClasses: Record<string, string> = {
    IDLE: 'bg-muted text-muted-foreground border-border',
    STARTING: 'bg-info-surface text-info border-info/30 animate-pulse',
    TRAINING: 'bg-info-surface text-info border-info/30 animate-pulse',
    PAUSED: 'bg-warning-surface text-warning border-warning/30',
    STOPPING: 'bg-destructive-surface text-destructive border-destructive/40',
    FAILED: 'bg-destructive-surface text-destructive border-destructive/40',
    COMPLETED: 'bg-success-surface text-success border-success/30',
  };
</script>

<span
  data-testid={testId}
  class={cn('status-pill', statusClasses[trainingState] ?? statusClasses.IDLE, className)}
  title={$trainingStore.status?.error_message ?? ''}
>
  {trainingState}
</span>

<style>
  /*
    No `display` here. Svelte's scoped styles are unlayered and Tailwind's
    utilities live in @layer utilities, so a `display` declared here would beat
    the `hidden` / `md:inline-flex` utilities the callers rely on to place this
    pill on exactly one breakpoint.
  */
  .status-pill {
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    border-width: 1px;
    border-style: solid;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 4: Reduce HeaderStatus to the desktop instance**

In `src/lib/components/shell/HeaderStatus.svelte`: delete `trainingState`, `statusClasses`, the `trainingStore` and `cn` imports, the whole `<span data-testid="training-status-pill">` block, and the `.status-pill` rule from its `<style>`. Keep `.state-badge` and `.saved-icon-badge`.

Add the import:

```svelte
  import TrainingStatusPill from './TrainingStatusPill.svelte';
```

and, in place of the removed span:

```svelte
<TrainingStatusPill testId="training-status-pill" class="hidden md:inline-flex" />
```

- [ ] **Step 5: Put the pill in the status bar**

In `src/lib/components/shell/StatusBar.svelte`, add the import:

```svelte
  import TrainingStatusPill from './TrainingStatusPill.svelte';
```

Keep the footer's `justify-end` and add the pill as its first child, pushed apart with `mr-auto`:

```svelte
<footer
  class="min-h-[52px] h-auto bg-card border-t border-border flex items-center justify-end gap-2 px-4 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] text-sm z-50"
>
  <!--
    Phones only: the top bar is full of config icons, so the training state
    lives down here. Desktop keeps it in the header.

    `mr-auto` here rather than `justify-between` on the footer: at md+ this
    pill is display:none, which leaves the footer with a single child -- and
    justify-between would then place the desktop controls at the LEFT edge.
    Keeping justify-end means the desktop layout is bit-for-bit unchanged.
  -->
  <TrainingStatusPill testId="training-status-pill-mobile" class="inline-flex md:hidden mr-auto" />

  <div class="flex items-center gap-3">
```

The existing `<div class="flex items-center gap-3">` and everything inside it is unchanged.

- [ ] **Step 6: Point the phone e2e at the footer pill**

`e2e/mobile.spec.ts:138` asserts the pill is *visible* at phone width. The header instance is now `hidden` there, so retarget it:

```ts
    const statusPill = page.getByTestId("training-status-pill-mobile");
```

- [ ] **Step 7: Run the unit suite**

Run: `npx vitest run`
Expected: PASS, all files. `ErrorBanner.test.ts:50` still resolves `training-status-pill` because the header instance remains in the jsdom DOM.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/shell/ e2e/mobile.spec.ts
git commit -m "feat(web): move the training status to the bottom bar on phones"
```

---

### Task 4: Let the header row shrink

With the pill gone from the header, the phone row is hamburger (44) + brand (26) + divider (1) + five config icons (220) + theme toggle (44) ≈ 359px including gaps and padding. That fits 390px but not 360px or 320px, and `flex-shrink: 0` on `.header-left` still prevents any give — so `.header-right` would keep being clipped on smaller phones.

Two changes: let the row shrink, and below 380px drop the decorative brand and divider, which are the only elements that carry no function.

**Files:**
- Modify: `src/lib/components/shell/Header.svelte:283-297`

**Interfaces:**
- Consumes: the failing guard from Task 2.
- Produces: nothing.

- [ ] **Step 1: Confirm the guard still fails**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "no shell control is clipped"`
Expected: FAIL at 320px and 360px on the theme toggle. 390px and 430px may already pass after Task 3 — record which do.

- [ ] **Step 2: Rewrite the phone block**

Replace the `@media (max-width: 767px)` block in `src/lib/components/shell/Header.svelte` with:

```css
  @media (max-width: 767px) {
    .header {
      padding: 4px 6px;
      padding-top: calc(4px + env(safe-area-inset-top, 0px));
      gap: 4px;
      flex-wrap: nowrap;
    }

    /*
      The row must be able to give. Pinning both sides to flex-shrink: 0 is
      what pushed the theme toggle outside the viewport -- and because the
      shell is overflow-hidden, it was clipped rather than scrolled, so
      nothing reported it.
    */
    .header-left {
      gap: 4px;
      min-width: 0;
      flex-shrink: 1;
    }

    .header-right {
      gap: 4px;
      flex-shrink: 0;
    }

    .brand {
      gap: 0;
      flex-shrink: 1;
      min-width: 0;
      overflow: hidden;
    }

    .app-title {
      display: none;
    }

    .header-divider {
      height: 18px;
    }
  }

  /*
    Below 380px the five config icons, the hamburger and the theme toggle
    consume the whole row. The wordmark is already gone; the logo and divider
    are the only remaining decoration, so they go next rather than pushing a
    control off-screen.
  */
  @media (max-width: 379px) {
    .header {
      padding: 4px 2px;
      gap: 0;
    }

    .header-left {
      gap: 0;
    }

    .brand,
    .header-divider {
      display: none;
    }
  }
```

- [ ] **Step 3: Run the guard**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone -g "no shell control is clipped"`
Expected: PASS at all four widths.

- [ ] **Step 4: Run the whole phone layout spec**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone`
Expected: PASS, including the pre-existing horizontal-scroll and one-row-header cases.

- [ ] **Step 5: Confirm touch targets survived the tighter gaps**

Run: `npx playwright test e2e/touch-targets.spec.ts --project=chromium-phone`
Expected: PASS. Gaps shrink to 0 below 380px, so the 44×44 hit test now has adjacent buttons touching; if any control reports undersized, the icons need `min-width: 44px` rather than a wider gap.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/shell/Header.svelte
git commit -m "fix(web): let the phone header row shrink instead of clipping the theme toggle"
```

---

### Task 5: Regenerate the stale visual baselines

Two phone baselines were captured against the stale build and encode a layout that never shipped. Now that the build step is real and the layout is correct, they can be regenerated — and this time they will mean something.

**Files:**
- Modify: `e2e/visual.spec.ts-snapshots/shell-phone-dark-chromium-phone-linux.png`
- Modify: `e2e/visual.spec.ts-snapshots/shell-phone-light-chromium-phone-linux.png`
- Modify: `e2e/visual.spec.ts-snapshots/ordinary-editor-drawer-phone-chromium-phone-linux.png`

**Interfaces:**
- Consumes: Tasks 1, 3 and 4.
- Produces: nothing.

- [ ] **Step 1: Confirm which baselines differ and why**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone`
Expected: FAIL on `shell phone dark and light` and `ordinary editor Drawer phone`.

Open the `-diff.png` for each under `test-results/`. Confirm each diff is an intended change: the status pill has left the header and appears in the status bar, and the drawer is the inset floating card from `35472f1f`. **If a diff shows anything else, stop and investigate — do not refresh it.**

- [ ] **Step 2: Regenerate**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone --update-snapshots`

- [ ] **Step 3: Verify they stick**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add e2e/visual.spec.ts-snapshots/
git commit -m "test(web): regenerate phone baselines against a current build"
```

---

### Task 6: Annotate the vendored modifications and drop the magic number

Three edits from the previous round left no trace of why they exist. `ui/drawer/drawer-content.svelte` and `ui/sidebar/constants.ts` are vendored shadcn-svelte files: re-running `shadcn-svelte add` silently reverts them, which is why `ui/sidebar/sidebar.svelte:6-11` carries a `LOCAL MODIFICATION` comment. These two now need the same. `ErrorBanner.svelte:34` acquired an unexplained `py-[7px]`.

**Files:**
- Modify: `src/lib/components/ui/drawer/drawer-content.svelte`
- Modify: `src/lib/components/ui/sidebar/constants.ts`
- Modify: `src/lib/components/shell/ErrorBanner.svelte:34`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Annotate the drawer**

Add above the `<DrawerPrimitive.Content>` element in `src/lib/components/ui/drawer/drawer-content.svelte`:

```svelte
<!--
  LOCAL MODIFICATION: the `bottom` direction is an inset floating card
  (inset-x-3 / bottom-3 / max-w-md / rounded-xl / border) rather than
  upstream's full-bleed sheet (inset-x-0 / bottom-0 / mt-24 / rounded-t-xl /
  border-t). Every bottom drawer in the app inherits this -- the save-preset
  drawer, OptionSheet, the concept editor and the dataset picker. Re-running
  `shadcn-svelte add drawer` will revert it.
-->
```

- [ ] **Step 2: Annotate the sidebar constant**

In `src/lib/components/ui/sidebar/constants.ts`:

```ts
/*
  LOCAL MODIFICATION: upstream ships 18rem. The off-canvas nav is icon+label
  only, and 18rem covered most of a 360px phone, so it is narrowed here.
  Re-running `shadcn-svelte add sidebar` will revert it.
*/
export const SIDEBAR_WIDTH_MOBILE = "13.5rem";
```

- [ ] **Step 3: Resolve the ErrorBanner padding**

`src/lib/components/shell/ErrorBanner.svelte:34` uses `py-[7px]`, which is not a Tailwind scale value and carries no explanation. Restore the scale value:

```svelte
    <Alert variant="destructive" class="bg-destructive-surface text-destructive border-b border-destructive flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
```

- [ ] **Step 4: Check nothing depended on the odd padding**

Run: `npx vitest run src/lib/components/shell/ErrorBanner.test.ts`
Run: `npx playwright test e2e/visual.spec.ts --project=chromium-desktop -g "persistent error state"`
Expected: PASS both. If the visual test fails, the 1px was load-bearing for a baseline — in that case restore `py-[7px]` and add a comment naming the baseline it serves, rather than silently reinstating a magic number.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/ src/lib/components/shell/ErrorBanner.svelte
git commit -m "docs(web): mark the vendored shadcn modifications and drop an unexplained padding"
```

---

### Task 7: Full verification

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: nothing.

- [ ] **Step 1: Unit suite**

Run: `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 2: Type check**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error`
Expected: no errors.

- [ ] **Step 3: Phone suites, both engines**

Run: `npx playwright test --project=chromium-phone`
Run: `npx playwright test --project=webkit-phone`
Expected: PASS.

- [ ] **Step 4: Desktop suite**

Run: `npx playwright test --project=chromium-desktop`
Expected: PASS with **no** snapshot changes. Desktop layout is untouched by this plan; a desktop visual diff means Task 3's `justify-between` or Task 4's media queries leaked past `md`.

- [ ] **Step 5: Commit if anything needed fixing**

```bash
git add -A
git commit -m "fix(web): address fallout from the mobile chrome fixes"
```

---

## Self-Review

**Coverage of the review findings:**

| Finding | Task |
|---|---|
| 1. Status pill and theme toggle clipped off-screen | 3 (pill relocated), 4 (row shrinks) |
| 2. Overflow guard blind to clipped content | 2 |
| 3. E2E runs against a stale build | 1 |
| 4. Two phone baselines stale | 5 |
| 5. Vendored primitives unannotated | 6 |
| 6. `ErrorBanner` magic number | 6 |
| User amendment: status to bottom-left on mobile | 3 |

**Ordering:** Task 1 precedes everything because no e2e result is trustworthy until the build step lands. Task 2 precedes 3 and 4 so the fixes have a failing reproduction. Task 5 follows 3 and 4 because the baselines must capture the corrected layout, not an intermediate one.

**Type consistency:** `TrainingStatusPill` takes `{ testId: string; class?: string }` in Task 3 and is called with exactly those props from both `HeaderStatus` and `StatusBar`. The testids `training-status-pill` and `training-status-pill-mobile` are used consistently in Task 2's guard, Task 3's unit tests, and `e2e/mobile.spec.ts`.

**Known deliberate exception:** Task 2 commits a failing test. That is the reproduction for Tasks 3 and 4 and is stated as such; the suite is green again at the end of Task 4.

**Placeholders:** none. Task 5 Step 1 is a judgement step by necessity — it asks the implementer to confirm each visual diff is intended before refreshing, with an explicit instruction to stop if it is not.
