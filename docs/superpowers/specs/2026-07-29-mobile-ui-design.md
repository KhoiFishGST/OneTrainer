# Mobile-Friendly Web UI — Design

**Date:** 2026-07-29
**Status:** Approved, ready for implementation planning
**Scope:** `web/src` — shell chrome (header, rail, status bar), page sub-navigation, viewport plumbing

## Problem

The web UI's structure is sound but its chrome was built for desktop. On a phone:

1. **The bottom bar is unreachable.** `LayoutContent.svelte` sizes the shell with `h-screen`
   (`100vh`). On iOS Safari `100vh` is the *tallest* viewport — it excludes the browser chrome
   that is actually on screen — so the shell overflows and `StatusBar`, the last flex child,
   sits under the toolbar. The shell is `overflow-hidden`, so it cannot be scrolled back into
   view. This makes the training controls inaccessible, which is the most severe defect here.
2. **The header wraps badly.** Three labelled `<Select>` controls plus Load and Save cannot fit
   one row on a 360–390px screen, so the header wraps to two or three rows and eats vertical space.
3. **The rail occupies width before hydration.** `Rail` is driven by `isMobile.current`, a JS
   `MediaQuery` that reads `false` until hydration, so it passes `collapsible: 'none'` — an
   unguarded in-flow `div` — and a phone renders a full-width rail on first paint. The hamburger
   and overlay drawer themselves already work (`Header.svelte` `md:hidden` Menu button →
   `sidebar.setOpenMobile`).
4. **Sub-nav tabs overflow.** `Tabs.List` on `general`, `model`, `training` and in
   `ConceptDetailModal` spans wider than the viewport and induces horizontal scrolling.
5. **The desktop expand button drifts.** `RailContent.svelte` gives its `SidebarHeader` no
   `justify-start`, so the `PanelLeft` button slides toward centre as the rail expands.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Mobile header shape | One combined row | Two stacked bars cost ~44px of a ~667px screen; dropping labels frees enough width to fit one row. |
| Config control interaction | Icon button → bottom sheet | Large touch targets, handles the long flattened preset tree, reuses `ResponsiveDialogDrawer`. |
| Where current value is shown | Inside the sheet, checked | Value chips on the bar reintroduce the width problem being solved. |
| Sub-nav | Dropdown below `md`, tabs at `md`+ | Desktop keeps at-a-glance section visibility; mobile loses the scroll. |
| Breakpoint mechanism | CSS (`md:hidden` / `hidden md:flex`), both variants rendered | Correct on first paint, no hydration flash, no SSR mismatch. Duplicate DOM is negligible for chrome. |
| Bottom bar on mobile | Icon-only secondaries, primary keeps its label | Start/Resume is consequential enough to stay labelled; the rest compress to 44×44. |
| Sub-tab URL state | Deferred | Behaviour change beyond the visual scope; filed as follow-up. |

## Architecture

### Header split

`Header.svelte` is 595 lines mixing three jobs — config selectors, save/preset dialog machinery,
and status badges. Adding a mobile variant inline would worsen that, so it splits along its
existing seams:

| File | Responsibility |
|---|---|
| `shell/Header.svelte` | Shell only: brand, hamburger, renders both bars, owns the save/overwrite dialog state and `executeSaveConfig`. |
| `shell/HeaderConfigControls.svelte` | Data layer: meta/presets queries, `flattenedPresets`, `handleModelTypeChange`, `handleTrainingMethodChange`, `handleSelectPreset`. No markup opinion. |
| `shell/HeaderDesktopBar.svelte` | Today's labelled `<Select>` row, visually unchanged. |
| `shell/HeaderMobileBar.svelte` | Icon buttons plus the option sheet. |
| `shell/HeaderStatus.svelte` | Save-state badge, retry/conflict actions, training status pill. Shared by both bars. |

Dialog state stays in `Header.svelte` so exactly one save flow exists regardless of which bar is
visible; both bars invoke the same `openSavePresetModal` and `handleLoadConfig` props. No
`isMobile` import remains in the header.

**Interface contract:** `HeaderConfigControls` exposes `{ modelTypes, currentModelType,
trainingMethods, currentTrainingMethod, presets, onModelTypeChange, onTrainingMethodChange,
onSelectPreset }`. Either bar can be understood, changed, or tested without reading the other.

### `OptionSheet.svelte`

One reusable overlay, `overlays/OptionSheet.svelte`, props `{ open, title, options, value,
onSelect, onOpenChange }`. Renders through the existing `ResponsiveDialogDrawer`: full-width
option rows, minimum 44px tall, a check mark on the current value, title naming the field
("Training Method"). All three mobile config buttons use it.

### Mobile header layout

Single 48px row: `☰ · logo · [model][method][preset][load][save] · status`. All buttons 44×44
with `aria-label`s. Load opens the directory picker as it does today; Save opens the existing
save drawer. The training status pill abbreviates below 380px — it is the only element with
give.

### `SubNav.svelte`

`layout/SubNav.svelte`, props `{ items, value, onChange, label }`. Renders `Tabs.Root/List/Trigger`
inside `hidden md:block`, and a `<select>`-backed dropdown inside `md:hidden`. The `general`,
`model` and `training` pages and `ConceptDetailModal` each delete their inline `Tabs.*` block and
pass their existing `subnavTabs` array through. Sub-tab state remains local `$state`.

### Rail

- Add `justify-start` to the `SidebarHeader` in `RailContent.svelte` so the expand button is
  anchored left at both widths.
- Fix the pre-hydration in-flow render. `Rail` currently passes `collapsible: 'none'` whenever
  `mobile` is false, which selects `sidebar.svelte`'s first branch — a plain in-flow `div` with
  no `hidden md:block` guard. Before hydration `isMobile.current` is false, so a phone renders
  that full-width rail. (The desktop `collapsible` branch would have been harmless; it is already
  `hidden md:block`.)
- Substituting `sidebar.isMobile` does **not** fix this — it is the same JS `MediaQuery` class
  (`ui/sidebar/context.svelte.ts`) and reads false pre-hydration too. Apply the decided mechanism
  instead: render both rail variants and CSS-gate them, the off-canvas `Sheet` under `md:hidden`
  and the in-flow rail under `hidden md:block`. `Rail.svelte` then takes no `mobile` prop and
  `LayoutContent` stops importing `isMobile` for it.

### Status bar

- The `isMobile.current` branch becomes CSS-gated like the header.
- Below `md`: Pause, Stop and Actions become 44×44 icon-only buttons with `aria-label`s;
  Start/Resume keeps icon + label.
- Remove the duplicated bottom padding — `StatusBar.svelte` currently applies both
  `pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]` and the `.safe-area-padding` class from
  `app.css`. Keep the `calc()` form, drop the class.
- The four-button control group is repeated verbatim across three training states; lift it into a
  single `TrainingControls` snippet.

### Viewport plumbing

`LayoutContent.svelte` — `h-screen` → `h-[100dvh]`, plus any other `h-screen`/`100vh` in shell
components. This is the actual fix for the occluded bottom bar.

## Data flow

Unchanged. Config mutations still go `component → ConfigWorkspace.setRaw → update mutation`; the
mobile bar routes through the same `HeaderConfigControls` handlers the desktop bar uses. No new
state stores, no new API calls.

## Error handling

Unchanged paths. The save-error `Alert`, the 409 overwrite dialog, and the preset-load conflict
handling (`workspace.state = 'conflict'`) stay in `Header.svelte` and render identically for both
bars. `HeaderStatus` renders conflict and failed states on mobile as it does on desktop; its
retry/reload/overwrite buttons become icon-only below `md` with `aria-label`s.

## Testing

**End-to-end (`e2e/mobile.spec.ts`, `e2e/touch-targets.spec.ts`, `webkit-phone` + `chromium-phone`
projects at 390×844 and 360×640):**

- `StatusBar`'s bounding box lies fully within the viewport on every route.
- `document.documentElement.scrollWidth <= clientWidth` on every route — no horizontal scroll.
- The header occupies a single row.
- Tapping a config icon opens the sheet and selecting an option changes the workspace value.
- The sub-nav dropdown switches the rendered panel.
- Every interactive control in the header and status bar measures ≥44×44.

**Static guards (new cases in the `layout-boundary.test.ts` source-analysis idiom):**

- Fail on `h-screen` or `100vh` in shell components.
- Fail on new `isMobile.current` usage in shell components.

These static guards are load-bearing, not belt-and-braces: headless WebKit has no browser chrome,
so it *cannot* reproduce the iOS `100vh` occlusion. A runtime test would pass against a
regression. The source guard is what protects the fix.

**Unit:** `Header.test.ts` retargets its assertions to the desktop bar and gains mobile-bar cases
(icon buttons present, sheet opens, selection propagates). New tests for `SubNav` (both variants
render, `onChange` fires) and `OptionSheet` (current value marked, selection callback).

## Overflow audit

Sweep at 360px for horizontal overflow and fix what is found: the datasets and concepts grids,
`MetricsChart`, `ConsoleView`, and `DirectoryPicker`. The `scrollWidth` assertion above is the
regression guard for this work.

## Implementation order

1. Viewport plumbing (`100dvh`) — user-blocking bug; everything else layers on it.
2. Status bar compaction and safe-area cleanup.
3. Header split and mobile bar.
4. `SubNav` extraction and page adoption.
5. Rail fixes (`justify-start`, drop `isMobile` prop).
6. Overflow audit and the `scrollWidth` guard.

## Out of scope

- Sub-tab state in the URL (back-button / deep-link support).
- Any change to desktop layout beyond anchoring the rail expand button.
- New mobile-only features; this is a responsiveness pass over existing functionality.
