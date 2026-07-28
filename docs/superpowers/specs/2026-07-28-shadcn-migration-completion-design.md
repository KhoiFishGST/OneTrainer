# shadcn-svelte Migration Completion Design

## Problem

The shadcn-svelte migration and its review-fixes pass both report green: `bun run check` has 0 errors, `bun run test` passes 282 tests across 56 files, and `bun run build` succeeds. The migration nonetheless did not complete.

`2026-07-28-shadcn-svelte-ui-migration.md` Task 7 Step 4 required replacing parent-to-child styling overrides with component `class`/variant APIs, adding an inline comment "only when `:global()` is required to style third-party uPlot, ANSI, or Bits UI generated DOM." What shipped instead: **286 `:global()` selectors retained**, 194 of them annotated `/* Bits UI boundary: ... */`. Inspection shows almost none style third-party DOM. They target class names the application itself puts on its own shadcn wrappers:

```css
/* embeddings/+page.svelte:319 */
.list-section :global(.primary-btn) { ... }   /* styling <Button class="primary-btn"> */
```

The single legitimate case is `ConsoleView.svelte:402-408`, which colors ANSI-rendered spans.

This is not a cosmetic debt. It is the direct cause of two user-visible defect classes.

### Consequence 1 — phone touch targets

`app.css:144-151` sets the 44px phone target on bare element selectors:

```css
@media (max-width: 767px) {
  button, input, select, textarea, [role='button'], [role='slider'] { min-height: 44px; }
}
```

Specificity 0-0-1. Every `:global(.some-btn) { min-height: 0 }` is 0-2-0 and wins. **27 such declarations** survive, on interactive controls including `SamplePromptCards` (the phone-only presentation — icon actions, dice, add), `RailContent:255` (the Console item *inside* the mobile navigation sheet), `Header:549,583`, `ErrorBanner:78`, and `ConsoleDrawer:242`. Review-fixes Task 5 Step 6 said "Remove `min-height: 0`"; it was removed from `StatusBar` alone.

No test catches this. The 44px assertions cover `StatusBar` and the slider thumb. `DatasetCollection.test.ts:126` appears to cover a third case but asserts through an `||` chain whose first branch is `touch-target-44` — a class defined nowhere in the codebase, so the assertion passes on the marker regardless of actual size.

### Consequence 2 — light-theme contrast

Review-fixes Task 6 Step 5 asked for "separate destructive surface/foreground values." They were never added. Status colors are hardcoded hex over hardcoded tints:

| Location | Composition | Approx. light-theme ratio |
|---|---|---|
| `Header.svelte:671-712` | `#3b82f6` / `#10b981` / `#f59e0b` / `#ef4444` on 15% tints | 2.0–3.5:1 |
| `Header.svelte:640` | `.saved-icon-badge` `#10b981` | ~2.2:1 |
| `ErrorBanner.svelte:56-59` | `var(--destructive)` on `rgba(239,68,68,0.2)` | ~3.5:1 |

`accessibility.spec.ts` correctly dropped `disableRules(['color-contrast'])`, but scans only pages in IDLE / no-error state, so none of these compositions is ever in the DOM during an axe run.

### Adjacent findings

The same review surfaced correctness bugs (stale-index sample identity, a delete path that succeeds having deleted nothing, a normalizer that injects keys into saved config), a dependency-boundary test that inspects only three path shapes and lets every bare specifier through, and e2e specs that pass without asserting — including one wrapped entirely in `if (await …isVisible())` with no assertions at all.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Cutover scope | All 286 selectors; keep only the `ConsoleView` ANSI block | Partial cleanup leaves the same failure mode available to the next change |
| Resulting appearance | Stock shadcn defaults; visual drift accepted | Preserving the bespoke look is what produced the override layer; porting it forward reproduces the problem in a new syntax |
| Status colors | New semantic tokens with foreground *and* surface pairs | A token foreground over an ad-hoc tint is the exact composition that fails; both halves must be defined together |

## Architecture

### Accessibility guarantees move into the components

The structural error is expressing a global invariant (44px on phone) as a low-specificity rule that per-component CSS can outbid. Any future override silently defeats it, and nothing fails.

Instead the invariant becomes intrinsic to the canonical components:

```
ui/button/button.svelte   buttonVariants.base += "max-md:min-h-11 max-md:min-w-11"
ui/input, ui/native-select, ui/checkbox, ui/switch, ui/textarea   same treatment
ui/slider/slider.svelte   already compliant (size-3 thumb + after:-inset-4 = 44px)
app.css:144-151           retained as a backstop for stray native controls
```

This ordering constraint is load-bearing: **every stock shadcn button size is under 44px** (`default` h-8, `sm` h-7, `lg` h-9, `icon` size-8). Adopting stock defaults without this change would regress touch targets across the entire application rather than fixing them. The variant work must land before the cutover.

Once the guarantee is intrinsic, removing the 27 `min-height: 0` lines is a consequence of deleting the override layer, not a separate hunt that can be half-finished.

### Token surface

`app.css` gains, in both `:root` and `.dark`, registered in the `@theme inline` block:

```
--success / --success-foreground / --success-surface
--warning / --warning-foreground / --warning-surface
--info    / --info-foreground    / --info-surface
--destructive-surface
```

Each foreground/surface pair is contrast-verified to 4.5:1 in both themes before any consumer uses it. `buttonVariants.destructive` — currently `bg-destructive/10 text-destructive`, the same tint-under-token composition that fails in `ErrorBanner` — is repointed at the defined pair so its contrast is specified rather than emergent.

### Component boundaries after the cutover

Each component owns its own appearance through props. A parent that wants a child styled differently passes `variant` / `size` / `class`; it does not reach across the boundary with `:global()`. The test for whether a boundary is right: can you change a component's internal markup without breaking a parent's stylesheet? Today the answer is no in ~40 files.

`ui/sidebar/sidebar.svelte` carries a local modification (an added `mobile` prop at `:12,:25`) that `Rail`/`RailContent` depend on. It is undocumented, so a future `shadcn-svelte add sidebar` reverts it silently. It gets a comment marking it as intentionally forked.

### One breakpoint, one mobile source

Four independent mobile detections exist: `hooks/is-mobile.svelte.ts`, the sidebar context's own `new IsMobile()`, `LayoutContent.svelte:131`, and `DatasetCollection.svelte:35`. The last defaults `isDesktop = true`, so phones render the desktop table for a frame before mount corrects it. All collapse onto the shared `IsMobile`, which evaluates synchronously.

Three files use `@media (max-width: 768px)` — phone behavior *at* 768px — against `767px` and Tailwind `md:` everywhere else: `Field.svelte:183`, `MetricsChart.svelte:304`, `SampleGallery.svelte:460`. Normalized to 767px.

The non-reactive `isMobile.current || window.innerWidth < 768` hack in `StatusBar.svelte:17` and both responsive overlays is removed; `innerWidth` read inside a `$derived` does not re-evaluate on resize and only appears to work because the adjacent reactive read does.

## Error handling and correctness

Three bugs are independent of the styling work and land first, so they are not buried inside a large refactor:

- **Sample identity.** `handleUpdateSample` and `handleSaveSampleModal` rewrite by array position; a refetch that reorders while an editor is open overwrites the wrong prompt. Both resolve the target by `webui_id ?? object reference` immediately before building the payload — the pattern `confirmDeleteSample` already uses.
- **Silent delete.** `confirmDeleteSample` computes `targetIndex`, then `filter((_, i) => i !== targetIndex)`. When the target has vanished, `findIndex` returns `-1`, the filter keeps every item, the mutation succeeds, and a success toast fires having deleted nothing. A `-1` guard surfaces an error instead.
- **Key injection.** `normalizeConceptDraft` writes `normalize(current[lastKey])` unconditionally, so an absent path resolves `undefined` → fallback and the saved concept gains keys it never had, violating the "preserve saved configuration formats" constraint. Absent keys are skipped.

## Testing

The migration's tests passed throughout while all of the above was true. The gap is that they assert implementation markers rather than user-visible properties. Three additions close it:

- **Touch-target regression test.** Renders each phone-facing surface and asserts every interactive element's computed box is ≥44×44. This is the test that would have caught the 27 overrides; it also guards the variant work from regressing.
- **Contrast coverage for unreached states.** Drives `Header` through TRAINING / PAUSED / COMPLETED / FAILED and renders `ErrorBanner`, asserting token-based colors in both themes — the states axe structurally cannot reach today. The axe pass extends to a page with an active error banner.
- **Dependency boundary as an allowlist.** `ui-dependency-boundary.test.ts:34-49` inspects only `$lib/`, relative, and `/`-absolute paths, so `$app/stores`, `$app/navigation`, and `@tanstack/svelte-query` all pass. Converted to an explicit allowlist with rejected fixtures.

Existing e2e specs are corrected rather than extended: `responsive-workflows.spec.ts:5,41` still forces viewports across project boundaries (prohibited by migration Task 8 Step 1, already fixed in `visual.spec.ts`); `mobile.spec.ts:113-132` has zero assertions; `accessibility.spec.ts:110` keeps the ordinary-dialog fallback the plan prohibited, and `:25,:36` silently skips the entire light-theme axe pass when the theme toggle is not found.

Adopting stock shadcn changes all 17 visual baselines by design. Regeneration is a manual-inspection step — each image confirmed to show its named state — not an automated `--update-snapshots` pass.

## Constraints

- Route URLs, backend payload shapes, saved configuration formats, callback ordering, and persistence keys are preserved.
- Phone behavior is below 768px; desktop begins at 768px.
- Native controls remain restricted to `web/src/lib/components/ui/`.
- Canonical UI may import only Svelte, Bits UI, the icon package, shared styling utilities, and the npm packages its own primitives require.
- No new legacy aliases and no parent-to-child styling overrides.
- Tests are not weakened to accommodate defects; each fix is preceded by a failing reproduction.

## Known limitation

Only Chromium is installed locally (`~/.cache/ms-playwright`). The `firefox-smoke` and `webkit-phone` Playwright projects cannot run on this workstation and will first execute in CI via `.github/workflows/web.yml`.

## Risks

Stock-shadcn adoption is a visible redesign: density and spacing shift across every screen, and all visual baselines change at once, which removes visual-regression safety for the duration of the cutover. The correctness burden shifts onto the unit tests, which is why the bug fixes and the new touch-target and contrast tests land before the cutover rather than after it.

The cutover itself spans ~40 files. It is grouped by area — shell, forms, sampling, concepts/embeddings, datasets/training/charts/console, remaining routes — with each group verified and committed independently, so a regression is bisectable.
