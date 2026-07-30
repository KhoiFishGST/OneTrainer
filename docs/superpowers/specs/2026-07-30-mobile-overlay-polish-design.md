# Mobile Overlay Polish — Design

**Date:** 2026-07-30
**Status:** Approved, ready for implementation planning
**Scope:** `web/src` — overlay wrappers, the directory picker, and the drawer's shared geometry

## Problem

Two complaints, one shared cause.

1. **The file dialog behaves unlike every other mobile overlay.** Option sheets, the save-preset
   drawer, the concept editor and the dataset picker all slide up from the bottom as inset floating
   cards. The directory picker slides in from the side instead, because it is the only consumer of
   a second wrapper, `ResponsiveDialogSheet`.
2. **Content runs flush to the card's edge.** The drawer already floats 12px clear of the screen,
   but its body slot has no padding at all. Its header and footer carry `p-4`; anything rendered
   between them touches the card border — most visibly the preset-name input in the save drawer.

A third defect is resolved incidentally. `ResponsiveDialogSheet` asks for
`full-screen inset-0 w-full h-dvh`, but `ui/sheet/sheet-content.svelte`'s
`data-[side=right]:w-3/4` carries an attribute qualifier and outranks a plain `w-full`. The
"full-screen" picker therefore renders 293px wide and side-anchored on a 390px phone. A prior
review raised this; rather than patch the specificity, the component that carries it is deleted.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| File dialog presentation | Bottom-up inset card, ~90% height | Matches every other mobile overlay; keeps the side margins the user asked for while leaving room to browse directories. |
| How to get there | Move `DirectoryPicker` to `ResponsiveDialogDrawer`, delete `ResponsiveDialogSheet` | It is the wrapper's only consumer. Two wrappers collapse to one, and the width bug leaves with it. |
| Margin | Padding inside the card's body | The outer 12px inset already exists; what is missing is space between content and the card border. |
| Where the padding lives | The Drawer branch only | `Dialog.Content` already carries `p-4`, so a shared wrapper would double-pad desktop. |
| Full-bleed content | A `flush` opt-out prop | Two consumers genuinely want edge-to-edge; the rest want padding. |
| Height unit | `dvh`, not `vh` | The drawer caps at `max-h-[80vh]`; on iOS that is 80% of the *tallest* viewport, the same trap already fixed in the shell. |

## Architecture

### `ResponsiveDialogDrawer` — the single mobile overlay

Gains one prop:

```ts
flush?: boolean   // default false; when true the body renders with no padding
```

In the **Drawer branch only**, the `children` slot is wrapped:

```svelte
<div class={bodyClass}>
  {@render children()}
</div>
```

The rule: when not `flush`, the body always gets horizontal padding, and it gets vertical padding
on any edge not already covered by a sibling. The header and footer each carry `p-4`, so the body
needs `pt-4` only when there is no `title`/`description`, and `pb-4` only when there is no
`footer`. Both are optional slots, so both cases occur in practice — `OptionSheet` passes no
footer, and several consumers pass no title.

The Dialog branch is untouched — `ui/dialog/dialog-content.svelte` already applies `p-4`, so
desktop keeps exactly the spacing it has today. Because the two branches are separate in the
component, this is structurally guaranteed rather than relying on a breakpoint variant.

The bottom drawer's shared `max-h-[80vh]` in `ui/drawer/drawer-content.svelte` becomes
`max-h-[80dvh]`. That file is vendored and already carries a `LOCAL MODIFICATION` marker for its
inset-card geometry; the marker gains a line for the unit change.

### `DirectoryPicker`

Swaps `ResponsiveDialogSheet` for `ResponsiveDialogDrawer` and passes a height override so the
picker can use `max-h-[90dvh]` rather than the shared 80. Everything else — the inset, the
rounding, the border, the slide — it inherits.

Its file list scrolls inside the card, as it does now; the card does not grow past 90dvh.

### Deletions

`ResponsiveDialogSheet.svelte`, `ResponsiveDialogSheet.test.ts` and
`ResponsiveDialogSheetTestWrapper.svelte` are removed. Nothing else imports them.

### Consumers needing `flush`

| Consumer | Why |
|---|---|
| `OptionSheet` | Rows are full-width tap targets with their own `px-4`; padding would inset them and shrink the target. |
| `GalleryImageViewer` | An inset image reads as boxed rather than presented. |

The other seven consumers gain the padding. `ConceptDetailModal`, `SampleDetailModal` and the
optimizer/scheduler params modals have no body padding of their own and simply benefit.
`DatasetPickerModal`'s scroll area carries `p-2`, which becomes redundant once the body is padded
and should be removed so it does not read as a double inset.

## Data flow

Unchanged. `DirectoryPicker` keeps its `open` / `onSelect` / `onClose` contract and its existing
directory-listing calls. No new state, no new API surface. The change is presentational.

## Error handling

Unchanged. The picker's existing error and empty states render inside the new body wrapper exactly
as they render inside the sheet today.

## Testing

**The animation assertion must sample geometry, not classes.** A previous round of this project
shipped a no-op because a test grepped source text for a Tailwind class that generated no CSS. The
file dialog's slide-up gets the same treatment the nav drawer's slide got: observe the panel as it
mounts, assert a running animation exists, and assert its `y` travels from below the viewport to
its resting position.

**Unit**

- `ResponsiveDialogDrawer`: the Drawer branch renders the padded body wrapper; the Dialog branch
  does not; `flush` suppresses it.
- `DirectoryPicker`: renders drawer content, not sheet content, and carries no `full-screen` class.
- `DirectoryPicker.test.ts` currently asserts `full-screen` / `inset-0` / `h-dvh` / `w-full` on
  `[data-slot="sheet-content"]`; that assertion is replaced.

**E2E**

- The file dialog slides up from the bottom (geometry assertion above).
- Its width is the viewport less the 12px inset on each side, and its height does not exceed 90dvh.
- No horizontal overflow inside the picker at 360px.
- `responsive-workflows.spec.ts:94` asserts `toHaveClass(/full-screen/)` and must be updated.
- `mobile.spec.ts:28`'s focus-trap test should still pass; its title says "full-screen" and needs
  renaming.
- `visual.spec.ts:129`'s "directory picker Sheet phone" baseline changes legitimately and is
  regenerated only after the diff is inspected.
- `accessibility.spec.ts`'s picker audit already waits for animations to settle, so the new slide
  is covered rather than sampled mid-flight.

**Static guard**

`shell-boundary.test.ts`'s `findViewportUnitViolations` matches only `h-screen` and `100vh`, so
`max-h-[80vh]` slips through. Widen it to any `<n>vh` in shell and overlay components, keeping the
existing login-page exemption. The same trap should not be able to return at a different magnitude.

**Desktop**

`chromium-desktop` must finish with zero snapshot drift. Every change here is inside the Drawer
branch or the mobile-only picker path.

## Implementation order

1. `flush` prop and the padded body wrapper in `ResponsiveDialogDrawer`, with `dvh` on the drawer's
   max height and the widened static guard.
2. `OptionSheet` and `GalleryImageViewer` opt out; `DatasetPickerModal` drops its redundant `p-2`.
3. `DirectoryPicker` moves to the drawer; `ResponsiveDialogSheet` and its two test files are
   deleted; affected unit and e2e assertions updated.
4. Baseline regeneration and full verification.

## Out of scope

- Any change to desktop dialog spacing or presentation.
- The remaining vendored overlay components that still carry dead animation classes.
- `webkit-phone` verification, deferred for lack of system libraries.
