# Compact Mobile Navigation Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce negative space in the mobile navigation sidebar by narrowing its width to `9rem` and reducing item vertical height (`min-h-[32px]`), padding, and gaps so all 14 items fit on one phone screen without scrolling.

**Architecture:** Update `SIDEBAR_WIDTH_MOBILE` in `constants.ts` to `"9rem"`. Adjust mobile-specific Tailwind classes and Lucide icon sizes in `RailContent.svelte`. Desktop styles remain unchanged.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind CSS 4, Vitest, Playwright.

## Global Constraints

- **Working directory is `web/`.** All paths and commands are relative to it.
- **Stop any dev server on port 7801 before running e2e** (`python scripts/train_ui_web.py --dev` binds it).
- **Breakpoint is `md` = 768px.** Mobile changes use `max-md:` utility prefixes or `mobile` boolean props.
- **Desktop layout must not be modified.**
- **Unit tests:** `npx vitest run <path>`. **E2E:** `npx playwright test <file> --project=<name>`.

---

### Task 1: Update mobile sidebar width in constants.ts

**Files:**
- Modify: `src/lib/components/ui/sidebar/constants.ts:9`
- Create: `src/lib/components/ui/sidebar/constants.test.ts`

**Interfaces:**
- Consumes: `SIDEBAR_WIDTH_MOBILE` from `./constants.ts`
- Produces: `SIDEBAR_WIDTH_MOBILE = "9rem"`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/ui/sidebar/constants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SIDEBAR_WIDTH_MOBILE } from './constants';

describe('Sidebar Constants', () => {
  it('sets mobile sidebar width to 9rem for a compact mobile sheet', () => {
    expect(SIDEBAR_WIDTH_MOBILE).toBe('9rem');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/ui/sidebar/constants.test.ts`
Expected: FAIL — expected `'9rem'`, got `'13.5rem'`

- [ ] **Step 3: Update `constants.ts`**

In `src/lib/components/ui/sidebar/constants.ts`:

```ts
/*
  LOCAL MODIFICATION: upstream ships 18rem. Narrowed to 9rem on mobile so off-canvas
  nav items fit text tightly without excessive horizontal negative space.
  Re-running `shadcn-svelte add sidebar` will revert it.
*/
export const SIDEBAR_WIDTH_MOBILE = "9rem";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/ui/sidebar/constants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/sidebar/constants.ts src/lib/components/ui/sidebar/constants.test.ts
git commit -m "fix(web): reduce mobile sidebar width to 9rem"
```

---

### Task 2: Compact mobile navigation item height, padding, and gaps

**Files:**
- Modify: `src/lib/components/shell/RailContent.svelte:71,89,92,102-156`
- Modify: `src/lib/components/shell/RailContent.test.ts`

**Interfaces:**
- Consumes: `Sidebar`, `SidebarMenu`, `SidebarMenuButton` components
- Produces: Compact mobile navigation drawer layout

- [ ] **Step 1: Write the failing test**

In `src/lib/components/shell/RailContent.test.ts`, add a test checking mobile item sizing:

```ts
  it('uses compact 32px height and tight padding for mobile nav items', () => {
    render(RailContentTestWrapper, { mobile: true });

    const liveLink = screen.getByText('Live').closest('a');
    expect(liveLink?.className).toContain('max-md:min-h-[32px]');
    expect(liveLink?.className).toContain('max-md:px-2');
    expect(liveLink?.className).toContain('max-md:text-xs');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/shell/RailContent.test.ts`
Expected: FAIL — `max-md:min-h-[32px]` not contained in class string.

- [ ] **Step 3: Update `RailContent.svelte`**

In `src/lib/components/shell/RailContent.svelte`:

1. Line 71: Update `<Sidebar>` class padding from `mobile && 'p-4'` to `mobile && 'p-2.5 py-3'`.
2. Line 89: Update `<SidebarContent>` class from `mobile && 'p-4 gap-2'` to `mobile && 'p-1 gap-1'`.
3. Line 92: Update `<SidebarMenu>` class from `mobile ? 'gap-2' : 'gap-1'` to `mobile ? 'gap-0.5' : 'gap-1'`.
4. Lines 102 & 117: Update `<a>` item class `max-md:min-h-[44px]` to `max-md:min-h-[32px] max-md:px-2 max-md:py-1 max-md:text-xs max-md:gap-2`.
5. Line 140: Update Console `<Button>` class `max-md:min-h-[44px]` (or `py-2`) to include `max-md:min-h-[32px] max-md:px-2 max-md:py-1 max-md:text-xs max-md:gap-2`.
6. Lines 109, 125, 150: Update icon size props or classes so icons scale down to `w-4 h-4` on mobile (`max-md:w-4 max-md:h-4`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/shell/RailContent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/shell/RailContent.svelte src/lib/components/shell/RailContent.test.ts
git commit -m "fix(web): compact mobile sidebar item heights, padding, and gaps"
```

---

### Task 3: Update mobile visual baselines & verify E2E

**Files:**
- Modify: `e2e/visual.spec.ts-snapshots/*-chromium-phone-linux.png`

**Interfaces:**
- Consumes: Tasks 1 and 2

- [ ] **Step 1: Run phone layout E2E suite**

Run: `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone`
Expected: PASS

- [ ] **Step 2: Update visual snapshots**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone --update-snapshots`
Expected: Regenerates snapshot for `ordinary-editor-drawer-phone` or mobile sidebar snapshots with narrower 9rem sheet width.

- [ ] **Step 3: Verify visual suite passes**

Run: `npx playwright test e2e/visual.spec.ts --project=chromium-phone`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add e2e/visual.spec.ts-snapshots/
git commit -m "test(web): update phone visual baselines for compact mobile sidebar"
```

---

### Task 4: Full Verification

**Files:** none modified.

- [ ] **Step 1: Unit tests**

Run: `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 2: Type check**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error`
Expected: 0 errors.

- [ ] **Step 3: E2E Chromium Phone**

Run: `npx playwright test --project=chromium-phone`
Expected: PASS.

- [ ] **Step 4: E2E Chromium Desktop**

Run: `npx playwright test --project=chromium-desktop`
Expected: PASS with 0 snapshot changes.
