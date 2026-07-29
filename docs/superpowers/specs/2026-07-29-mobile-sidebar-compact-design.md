# Compact Mobile Navigation Sidebar Design

**Date:** 2026-07-29  
**Goal:** Reduce negative space in the mobile navigation sidebar (hamburger menu) by narrowing its width by ~40% and reducing item vertical height/gaps so all 14 navigation items fit on a single phone screen without scrolling.

---

## 1. Requirements & Constraints

- **Mobile Only:** Desktop (`md`+ / 768px+) sidebar width (`16rem` expanded / `3rem` compact) and item density must remain completely unchanged.
- **Single-Screen Fit:** The mobile navigation sheet must display all 14 items (13 main nav links + Console toggle button) on phone viewports (height ~667px - 844px) without requiring vertical scrolling.
- **Width Reduction:** Reduce sidebar sheet width from `13.5rem` (216px) down to `9rem` (144px).
- **Target Files:**
  - `src/lib/components/ui/sidebar/constants.ts`
  - `src/lib/components/shell/RailContent.svelte`

---

## 2. Detailed Technical Design

### A. Mobile Sidebar Width (`constants.ts`)

In `src/lib/components/ui/sidebar/constants.ts`:

```ts
/*
  LOCAL MODIFICATION: upstream ships 18rem. The off-canvas nav is icon+label
  only. Narrowed to 9rem on mobile so items fit text tightly without excessive
  horizontal negative space.
  Re-running `shadcn-svelte add sidebar` will revert it.
*/
export const SIDEBAR_WIDTH_MOBILE = "9rem";
```

### B. Mobile Navigation Items Spacing & Sizing (`RailContent.svelte`)

In `src/lib/components/shell/RailContent.svelte`:

1. **Outer `<Sidebar>` Padding:**
   - Change `mobile && 'p-4'` to `mobile && 'p-2.5 py-3'`.

2. **`<SidebarContent>` Padding & Gap:**
   - Change `mobile && 'p-4 gap-2'` to `mobile && 'p-1 gap-1'`.

3. **`<SidebarMenu>` Gap:**
   - Change `mobile ? 'gap-2' : 'gap-1'` to `mobile ? 'gap-0.5' : 'gap-1'`.

4. **Nav Item Buttons (`<a>` and `<Button>`):**
   - Change min-height from `max-md:min-h-[44px]` to `max-md:min-h-[32px]`.
   - Adjust padding and text size on mobile: `max-md:px-2 max-md:py-1 max-md:text-xs max-md:gap-2` (desktop retains `px-2.5 py-2 text-sm gap-3`).
   - Icon size on mobile: shrink icon class to `max-md:w-4 max-md:h-4` and set Lucide icon `size={18}` on mobile while keeping `20` on desktop.

---

## 3. Dimensions Comparison

| Metric | Previous Mobile | New Compact Mobile | Desktop (`md`+) |
|---|---|---|---|
| Sidebar Width | `13.5rem` (216px) | `9rem` (144px) | `16rem` (256px) / `3rem` (48px) |
| Item Min-Height | 44px | 32px | 36px |
| Menu Item Gap | 8px | 2px | 4px |
| Item Padding | 8px 10px | 4px 8px | 8px 10px |
| Total Content Height | ~752px | **~460px** | N/A (Desktop rail) |

---

## 4. Verification Plan

1. **Unit Tests:** `npx vitest run`
2. **Type Check:** `npx svelte-check --tsconfig ./tsconfig.json --threshold error`
3. **E2E Layout Specs:** `npx playwright test e2e/mobile-layout.spec.ts --project=chromium-phone`
4. **E2E Visual Snapshots:** `npx playwright test e2e/visual.spec.ts --project=chromium-phone`
