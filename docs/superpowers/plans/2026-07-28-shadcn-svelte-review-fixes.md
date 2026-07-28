# shadcn-svelte Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Correct every behavioral, responsive, accessibility, styling, and test-coverage defect found in the review of the shadcn-svelte migration.

**Architecture:** Fix contracts at their owning boundaries: routes own payload paths and mutation outcomes, application composites own drafts and responsive workflow state, canonical UI owns native interaction mechanics, and tests validate user-visible behavior rather than implementation details. Each task starts with a regression test, makes one coherent class of fixes, runs focused verification, and commits independently.

**Tech Stack:** Svelte 5, SvelteKit 2, TypeScript, shadcn-svelte/Bits UI, Tailwind CSS, TanStack Svelte Query, Vitest, Testing Library, Playwright, axe-core, Bun.

## Global Constraints

- Use `67cd05f5` as the reviewed implementation baseline.
- Preserve route URLs, backend payload shapes, saved configuration formats, callback ordering, and existing persistence keys.
- Phone behavior is below `768px`; desktop behavior starts at `768px`.
- Playwright phone acceptance uses a `390x844` viewport with mobile/touch emulation.
- Phone controls and interactive slider hit areas are at least `44x44px`.
- Failed submissions keep their dialog, drawer, sheet, or alert dialog open and preserve retry state.
- Pending destructive actions disable confirmation and cannot submit twice.
- Ordinary editors use Dialog/Drawer; destructive confirmations use Alert Dialog; phone navigation uses Sidebar's modal off-canvas behavior.
- Native controls remain restricted to `web/src/lib/components/ui/`.
- Canonical UI source may import only Svelte/Bits UI, icon, and shared styling utilities; it may not import application modules.
- Use semantic shadcn tokens. Do not add new legacy aliases or parent-to-child styling overrides.
- Do not weaken tests to accommodate defects. Add a failing reproduction before each fix.
- Do not modify the unrelated untracked `.github/hooks/` or `docs/superpowers/plans/2026-07-26-web-ui-sample-gallery.md` files.

---

### Task 1: Restore Configuration And Select Value Contracts

**Files:**
- Modify: `web/src/routes/training/+page.svelte:58-63`
- Modify: `web/src/routes/training/page.test.ts`
- Modify: `web/src/lib/components/form/ValueSelect.svelte:47-103`
- Modify: `web/src/lib/components/form/ValueSelect.test.ts`

**Interfaces:**
- `handleSaveScheduler(values)` writes each key exactly as supplied by `SchedulerParamsModal`.
- `ValueSelect<T>` maps every option to a unique DOM index string and emits the original typed `T`.
- Unknown current values render an explicit disabled sentinel rather than visually selecting a valid option.

- [x] **Step 1: Add the scheduler payload regression test**

Extend `web/src/routes/training/page.test.ts` to open the scheduler editor, apply `{ custom_learning_rate_scheduler: 'pkg.Custom' }`, and assert:

```ts
expect(setRaw).toHaveBeenCalledWith('custom_learning_rate_scheduler', 'pkg.Custom');
expect(setRaw).not.toHaveBeenCalledWith('optimizer.custom_learning_rate_scheduler', expect.anything());
```

- [x] **Step 2: Add select collision and unknown-value tests**

Add tests using these options:

```ts
const options = [
  { value: 1, label: 'Numeric one' },
  { value: '1', label: 'String one' },
];
```

Assert the rendered option values are unique, selecting the second option emits string `'1'`, and `value="removed-value"` renders a selected disabled option labeled `Unknown: removed-value` rather than selecting the first valid option.

- [x] **Step 3: Run tests and verify both regressions fail**

Run:

```bash
bun run test -- src/routes/training/page.test.ts src/lib/components/form/ValueSelect.test.ts
```

Expected: scheduler assertion reports the `optimizer.` prefix; collision or unknown-value assertions fail.

- [x] **Step 4: Restore scheduler paths and index-only select mapping**

Change scheduler saving to:

```ts
for (const [key, val] of Object.entries(updatedValues)) {
  ctx.workspace.setRaw(key, val);
}
```

In `ValueSelect`, use `String(index)` as every valid `<option>` value. Resolve changes only through `options[Number(selectedValue)]`; never search by serialized application value. Keep loose string equality only when deriving the initial selected index. When no option matches, prepend and select a disabled sentinel whose DOM value is `__unknown__`.

- [x] **Step 5: Run focused and schema tests**

Run:

```bash
bun run test -- src/lib/components/form/ValueSelect.test.ts src/lib/components/form/SchemaForm.test.ts src/routes/training/page.test.ts
bun run check
```

Expected: all tests pass and check reports no new errors.

- [x] **Step 6: Commit contract fixes**

```bash
git add web/src/routes/training/+page.svelte web/src/routes/training/page.test.ts web/src/lib/components/form/ValueSelect.svelte web/src/lib/components/form/ValueSelect.test.ts
git commit -m "fix(web): restore configuration value contracts"
```

### Task 2: Preserve Numeric Drafts And Normalize At Save Boundaries

**Files:**
- Modify: `web/src/lib/components/form/NumericDraftInput.svelte`
- Modify: `web/src/lib/components/form/NumericDraftInput.test.ts`
- Modify: `web/src/lib/components/sampling/SamplePromptTable.svelte`
- Modify: `web/src/lib/components/sampling/SamplePromptCards.svelte`
- Modify: `web/src/lib/components/sampling/SamplePromptTable.test.ts`
- Modify: `web/src/lib/components/sampling/SamplePromptCards.test.ts`
- Create: `web/src/lib/components/concepts/concept-draft.ts`
- Create: `web/src/lib/components/concepts/concept-draft.test.ts`
- Modify: `web/src/lib/components/concepts/ConceptDetailModal.svelte`
- Modify: `web/src/lib/components/concepts/ConceptGeneralFields.svelte`
- Modify: `web/src/lib/components/concepts/ConceptImageFields.svelte`
- Modify: `web/src/lib/components/concepts/ConceptTextFields.svelte`
- Modify: `web/src/lib/components/concepts/ConceptDetailModal.test.ts`

**Interfaces:**
- `NumericDraftInput` defaults to `type="text"`, `inputmode="decimal"`, and emits raw strings through `onInput` and `onChange`.
- Sampling width, height, and seed normalize with `parseInt` on commit in both table and card views.
- `normalizeConceptDraft(draft: Concept): Concept` returns a deep clone with known numeric paths converted once during Save.

- [x] **Step 1: Reproduce default incomplete-draft behavior**

Remove `type: 'text'` from the incomplete-draft test. Assert the default control retains and emits `''`, `'-'`, `'1.'`, and `'1e'`. Add an assertion that blur/change emits the raw draft rather than `number | null`.

- [x] **Step 2: Add integer sampling regressions**

In both table and card tests, enter `640.5` for width and `123.9` for seed, commit the field, and assert callbacks receive width `640` and seed `123`. Also assert invalid committed width falls back to `512` and seed to `-1`.

- [x] **Step 3: Add concept normalization tests**

Create `concept-draft.test.ts` with a draft containing raw values at these paths:

```text
image_variations
text_variations
balancing
loss_weight
image.random_rotate_max_angle
image.random_brightness_max_strength
image.random_contrast_max_strength
image.random_saturation_max_strength
image.random_hue_max_strength
text.keep_tags_count
text.tag_dropout_probability
text.caps_randomize_probability
```

Assert incomplete strings remain visible before save, while `normalizeConceptDraft` converts valid integer/float strings, applies existing defaults to invalid values, and does not mutate the source draft.

- [x] **Step 4: Run numeric tests and verify failures**

Run:

```bash
bun run test -- src/lib/components/form/NumericDraftInput.test.ts src/lib/components/sampling/SamplePromptTable.test.ts src/lib/components/sampling/SamplePromptCards.test.ts src/lib/components/concepts/concept-draft.test.ts
```

Expected: default draft, fractional integer, and normalization tests fail.

- [x] **Step 5: Make the input a raw-draft adapter**

Set the default to text with decimal input mode. Change `onChange` to `(draft: string) => void`; assign the raw string to the bindable value and do not call `Number()` inside the adapter. Continue forwarding native events separately through lowercase `oninput` and `onchange`.

- [x] **Step 6: Normalize sampling integers consistently**

In table and cards, always normalize with:

```ts
function integerOr(value: string | number | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
```

Use this for width, height, and seed regardless of whether the incoming value is currently a string or number.

- [x] **Step 7: Retain raw concept drafts until Save**

Change concept field `onInput` callbacks to assign the raw string without `parseInt`, `parseFloat`, or `||` fallback. Implement `normalizeConceptDraft` with an explicit path/normalizer table and call it once in `ConceptDetailModal.handleSave()`. Keep the visible draft unchanged after a failed save.

- [x] **Step 8: Run all numeric and concept tests**

Run:

```bash
bun run test -- src/lib/components/form src/lib/components/sampling src/lib/components/concepts
bun run check
```

Expected: all focused tests pass; no new type or accessibility errors.

- [x] **Step 9: Commit draft fixes**

```bash
git add web/src/lib/components/form/NumericDraftInput.svelte web/src/lib/components/form/NumericDraftInput.test.ts web/src/lib/components/sampling web/src/lib/components/concepts
git commit -m "fix(web): preserve numeric drafts until save"
```

### Task 3: Make Save And Destructive Flows Awaitable

**Files:**
- Modify: `web/src/lib/components/concepts/ConceptDetailModal.svelte`
- Modify: `web/src/lib/components/concepts/ConceptsEditor.svelte`
- Modify: `web/src/routes/concepts/+page.svelte`
- Modify: concept component and route tests
- Modify: `web/src/lib/components/datasets/DatasetCollection.svelte`
- Modify: `web/src/routes/datasets/+page.svelte`
- Modify: `web/src/routes/datasets/DatasetsPage.test.ts`
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/sampling/SamplingPage.test.ts`
- Modify: `web/src/routes/secrets/+page.svelte`
- Modify: `web/src/routes/secrets/page.test.ts`
- Modify: `web/src/lib/components/shell/Header.svelte`
- Modify: `web/src/lib/components/shell/Header.test.ts`

**Interfaces:**
- Concept editor `onChange(next: Concept[]): Promise<void>` resolves only after persistence succeeds.
- Dataset deletion `onDelete(name: string): Promise<void>` rejects to the Alert Dialog on failure.
- Sampling delete targets `webui_id` where available and closes only after `mutateAsync` succeeds.
- Every destructive flow exposes a local pending boolean and failure message.

- [x] **Step 1: Add concept failure-retention tests**

Mock `createUpdateConceptsMutation().mutateAsync` to reject. Save an edited concept and assert the dialog remains open, edited values remain visible, and an error Alert appears. Resolve on retry and assert the dialog closes. Use fake timers only to preserve the existing one-second debounce before awaiting mutation.

- [x] **Step 2: Strengthen destructive-flow tests**

For dataset deletion, sample deletion, password clearing, and preset overwrite, use a deferred promise. Assert the confirmation remains open while pending, its action is disabled, a second click does not add a call, rejection keeps the dialog open with an error, and resolution closes it.

For sampling, reorder the query result while confirmation is open and assert deletion still removes the item with the captured `webui_id`, not the item now occupying the old index.

- [x] **Step 3: Run mutation tests and verify failures**

Run:

```bash
bun run test -- src/lib/components/concepts src/routes/concepts src/routes/datasets src/routes/sampling src/routes/secrets src/lib/components/shell/Header.test.ts
```

Expected: pending, rejection-retention, and stable-identity assertions fail.

- [x] **Step 4: Thread async concept persistence through all layers**

Use `mutateAsync` in the route. Keep the one-second coalescing behavior with a pending promise per requested save: superseded calls resolve only after the latest queued payload persists. Make `ConceptsEditor.handleSaveConcept` async and close/reset only after awaited success. Make `ConceptDetailModal.handleSave` await `onSave(normalizedDraft)` and expose pending/error state in its footer.

- [x] **Step 5: Keep dataset and sample confirmations mounted**

Remove pre-await state clearing. Let route handlers reject after recording user-facing errors. In `finally`, clear pending but preserve target/open state on failure. Clear target and close only after success. Capture sample identity as `webui_id ?? object reference`; resolve the current index immediately before constructing the successful mutation payload.

- [x] **Step 6: Convert password clear and overwrite to guarded Alert Dialogs**

Make `saveSecrets` return its promise and throw after setting status. Await it in `handleClearPassword`; close and clear input only on success. Replace Header's overwrite `ResponsiveDialogDrawer` with Alert Dialog. Add `isOverwritePending` and `overwriteError`; disable Cancel/Overwrite while pending and retain the dialog on failure.

- [x] **Step 7: Run all affected tests**

Run:

```bash
bun run test -- src/lib/components/concepts src/routes/concepts src/lib/components/datasets src/routes/datasets src/lib/components/sampling src/routes/sampling src/routes/secrets src/lib/components/shell/Header.test.ts
bun run check
```

Expected: every pending/failure/retry test passes.

- [x] **Step 8: Commit mutation fixes**

```bash
git add web/src/lib/components/concepts web/src/routes/concepts web/src/lib/components/datasets web/src/routes/datasets web/src/lib/components/sampling web/src/routes/sampling web/src/routes/secrets web/src/lib/components/shell/Header.svelte web/src/lib/components/shell/Header.test.ts
git commit -m "fix(web): retain failed mutation workflows"
```

### Task 4: Restore Sampling Feedback And Single Responsive Editing State

**Files:**
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/sampling/SamplingPage.test.ts`
- Modify: `web/src/lib/components/sampling/SamplePromptTable.svelte`
- Modify: `web/src/lib/components/sampling/SamplePromptCards.svelte`
- Modify: corresponding component tests

**Interfaces:**
- `triggerToast(message, type)` calls `sonnerToast.success` or `sonnerToast.error` directly.
- Exactly one of SamplePromptTable or SamplePromptCards is mounted according to `isMobile.current`.
- Row draft state remains in the route as `Record<sampleIdentity, SampleDraft>` so switching breakpoints does not lose incomplete edits.

- [x] **Step 1: Add visible-feedback tests**

Mock `svelte-sonner`. Assert sample-now, create, clone, edit, delete, and failure paths call the correct success/error function and message. Remove assertions against dead local `toast` state.

- [x] **Step 2: Add responsive mount and draft-retention tests**

Mock the mobile media query, render with one sample, and assert only one width input exists. Enter an incomplete width draft, dispatch a media-query change, and assert the newly mounted presentation shows the same draft and no duplicate IDs exist.

- [x] **Step 3: Run sampling tests and verify failures**

Run: `bun run test -- src/lib/components/sampling src/routes/sampling/SamplingPage.test.ts`

Expected: Sonner calls, single mount, and breakpoint draft retention fail.

- [x] **Step 4: Replace dead toast state and lift row drafts**

Delete the local `toast` state and obsolete `.sampling-toast` CSS. Implement:

```ts
function triggerToast(message: string, type: 'success' | 'error' = 'success') {
  type === 'success' ? sonnerToast.success(message) : sonnerToast.error(message);
}
```

Render the active collection with `{#if isMobile.current}` rather than CSS hiding. Move per-row raw numeric drafts into the route keyed by `webui_id` or a stable generated key and pass them to both presentations.

- [x] **Step 5: Run sampling tests and commit**

Run:

```bash
bun run test -- src/lib/components/sampling src/routes/sampling
bun run check
```

Expected: all sampling tests pass.

```bash
git add web/src/routes/sampling web/src/lib/components/sampling
git commit -m "fix(web): restore responsive sampling feedback"
```

### Task 5: Fix Mobile Navigation, Status Actions, And Modal Containment

**Files:**
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Modify: `web/src/lib/components/shell/Rail.test.ts`
- Modify: `web/src/lib/components/LayoutContent.svelte`
- Modify: `web/src/lib/components/LayoutContent.test.ts`
- Modify: `web/src/lib/components/shell/StatusBar.svelte`
- Modify: `web/src/lib/components/shell/StatusBar.test.ts`
- Modify: `web/src/lib/components/shell/ConsoleDrawer.svelte`
- Modify: `web/src/lib/components/shell/ConsoleDrawer.test.ts`
- Modify: `web/src/lib/components/overlays/ResponsiveDialogDrawer.svelte`
- Modify: `web/src/lib/components/overlays/ResponsiveDialogSheet.svelte`
- Modify: overlay tests
- Modify: `web/src/app.css`

**Interfaces:**
- Rail uses one Sidebar tree and controlled Sidebar mobile state; Escape, focus trap, scroll lock, and focus restoration come from the canonical primitive.
- StatusBar uses a phone action menu when all training actions cannot fit.
- Restored console height is clamped to `[100, window.innerHeight * 0.8]` and reclamped on resize.
- Modal overlays retain default background scroll prevention and explicit safe-area padding.

- [x] **Step 1: Add modal-navigation tests**

Open phone navigation, assert `aria-modal="true"`, Tab from the last control wraps inside navigation, Escape closes it, focus returns to Open navigation, body scrolling is locked, and changing to desktop then back does not reopen stale mobile state.

- [x] **Step 2: Add phone status and console-bound tests**

At 390px with TRAINING state, assert every action is reachable through visible 44px controls or an Actions menu. Assert no button is clipped outside the viewport. Seed `console_drawer_height=700` at a 720px viewport and expect a maximum of 576px; resize shorter and assert reclamping.

- [x] **Step 3: Add overlay containment tests**

Assert Dialog, Drawer, and Sheet set body scroll lock while open. Assert phone Drawer/Sheet computed padding includes `env(safe-area-inset-bottom)` through a named class rather than undefined `p-safe`.

- [x] **Step 4: Run responsive component tests and verify failures**

Run:

```bash
bun run test -- src/lib/components/shell src/lib/components/LayoutContent.test.ts src/lib/components/overlays
```

Expected: modal navigation, 44px/reachability, clamp, and scroll-lock assertions fail.

- [x] **Step 5: Compose Rail from canonical Sidebar mobile behavior**

Remove the manual overlay and `role="dialog"` implementation. Put the mobile trigger in Header through a snippet or shell callback so it does not consume a separate content column. Render nav items once inside Sidebar. On media change to desktop, call `setOpenMobile(false)`.

- [x] **Step 6: Make phone training actions fit**

Keep the primary state action visible and move secondary actions into a canonical Dropdown Menu below 768px. Remove `min-height: 0`; use 44px menu trigger/items. Replace fixed 52px phone height with `min-height: 52px` plus bottom safe-area padding.

- [x] **Step 7: Restore modal scroll lock, safe areas, and console bounds**

Remove `preventScroll={false}` from responsive overlay content. Add explicit `.safe-area-overlay` padding using all relevant `env(safe-area-inset-*)` variables. Clamp loaded and resized console height against current viewport height.

- [x] **Step 8: Run responsive tests and commit**

Run:

```bash
bun run test -- src/lib/components/shell src/lib/components/LayoutContent.test.ts src/lib/components/overlays
bun run check
bun run build
```

Expected: tests, check, and build pass.

```bash
git add web/src/lib/components/shell web/src/lib/components/LayoutContent.svelte web/src/lib/components/LayoutContent.test.ts web/src/lib/components/overlays web/src/app.css
git commit -m "fix(web): restore accessible mobile shell behavior"
```

### Task 6: Correct Semantic Styling And Accessibility Relationships

**Files:**
- Modify: `web/src/app.css`
- Modify: `web/src/lib/components/shell/Header.svelte`
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Modify: `web/src/lib/components/shell/ErrorBanner.svelte`
- Modify: `web/src/lib/components/shell/ErrorBanner.test.ts`
- Modify: `web/src/lib/components/form/Field.svelte`
- Modify: `web/src/lib/components/form/FormInputs.test.ts`
- Modify: `web/src/lib/components/ui/slider/slider.svelte`
- Modify: `web/src/lib/components/charts/MetricsChart.test.ts`
- Modify: `web/src/lib/components/ui-dependency-boundary.test.ts`

**Interfaces:**
- `Field` always includes help text in the control's `aria-describedby`; tooltip visibility is visual only.
- ErrorBanner resets dismissal only when `message` changes.
- Canonical UI dependency enforcement is allowlist-based.

- [x] **Step 1: Add semantic state and error-message tests**

Assert IDLE status and active navigation have computed foreground/background colors that differ. Render ErrorBanner with `First`, dismiss it, rerender with `Second`, and assert `Second` is visible.

- [x] **Step 2: Add field-help and slider-target tests**

Render a Field with tooltip text and focus the input without opening the tooltip. Assert the input's `aria-describedby` points to help text already present in the accessibility tree. At phone styling, assert the slider thumb's interactive pseudo-wrapper or element is at least 44x44px.

- [x] **Step 3: Strengthen dependency-boundary fixtures**

Add rejected fixtures for `$lib/config/context`, `$lib/events/training-store`, `$lib/api/client`, and a relative application import. Define allowed prefixes explicitly: `svelte`, `bits-ui`, `lucide-svelte`, `$lib/utils`, and relative imports that remain inside `components/ui/`.

- [x] **Step 4: Run tests and verify failures**

Run:

```bash
bun run test -- src/lib/components/shell/ErrorBanner.test.ts src/lib/components/form/FormInputs.test.ts src/lib/components/charts/MetricsChart.test.ts src/lib/components/ui-dependency-boundary.test.ts
```

Expected: message reset, persistent description, slider target, and new boundary fixtures fail.

- [x] **Step 5: Replace colliding and low-contrast tokens**

Use `--muted-foreground` for IDLE text. Use `background: var(--accent); color: var(--accent-foreground)` for active navigation. Define a darker light destructive color that reaches 4.5:1 against white for normal text; use separate destructive surface/foreground values where needed. Remove undefined `--accent-soft` usage.

- [x] **Step 6: Fix reactive and accessibility relationships**

Read `message` inside ErrorBanner's effect and reset only on changed non-empty messages. Always render Field help in a visually hidden description node; render a separate visual tooltip referencing the same content. Expand Slider thumb hit area to 44px without enlarging the visible 12px thumb.

- [x] **Step 7: Convert dependency boundary to allowed imports**

Resolve relative imports against the source filename. Permit relative targets only when they remain below `/src/lib/components/ui/`; reject all `$lib/*` imports except `$lib/utils` and UI-internal imports.

- [x] **Step 8: Run tests and commit**

Run:

```bash
bun run test -- src/lib/components/shell src/lib/components/form src/lib/components/charts src/lib/components/ui-dependency-boundary.test.ts
bun run check
```

Expected: all focused tests pass and check has no new warnings.

```bash
git add web/src/app.css web/src/lib/components/shell/Header.svelte web/src/lib/components/shell/Rail.svelte web/src/lib/components/shell/ErrorBanner.svelte web/src/lib/components/shell/ErrorBanner.test.ts web/src/lib/components/form/Field.svelte web/src/lib/components/form/FormInputs.test.ts web/src/lib/components/ui/slider/slider.svelte web/src/lib/components/charts/MetricsChart.test.ts web/src/lib/components/ui-dependency-boundary.test.ts
git commit -m "fix(web): correct semantic accessibility styling"
```

### Task 7: Complete Legacy Styling Cutover And Dataset Responsive Presentation

**Files:**
- Modify: `web/src/app.css`
- Modify: `web/src/routes/embeddings/+page.svelte`
- Modify: `web/src/routes/datasets/+page.svelte`
- Modify: `web/src/routes/datasets/[id]/+page.svelte`
- Modify: `web/src/routes/login/+page.svelte`
- Modify: `web/src/routes/secrets/+page.svelte`
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/lora/+page.svelte`
- Modify: `web/src/routes/live/+page.svelte`
- Modify: `web/src/routes/backup/+page.svelte`
- Modify: `web/src/lib/components/collections/AddItemCard.svelte`
- Modify: `web/src/lib/components/layout/PageHeader.svelte`
- Modify: `web/src/lib/components/embeddings/EmbeddingCard.svelte`
- Modify: `web/src/lib/components/sampling/SamplePromptCards.svelte`
- Modify: `web/src/lib/components/sampling/SamplePromptTable.svelte`
- Modify: `web/src/lib/components/sampling/SampleDetailModal.svelte`
- Modify: `web/src/lib/components/charts/MetricsChart.svelte`
- Modify: `web/src/lib/components/datasets/DatasetFileCard.svelte`
- Modify: `web/src/lib/components/datasets/DatasetCollection.svelte`
- Modify: `web/src/lib/components/datasets/DatasetPickerModal.svelte`
- Modify: `web/src/lib/components/LayoutContent.svelte`
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Modify: `web/src/lib/components/shell/Header.svelte`
- Modify: `web/src/lib/components/shell/StatusBar.svelte`
- Modify: `web/src/lib/components/shell/ErrorBanner.svelte`
- Modify: `web/src/lib/components/shell/ConsoleDrawer.svelte`
- Modify: `web/src/lib/components/console/ConsoleView.svelte`
- Modify: `web/src/lib/components/form/SchedulerParamsModal.svelte`
- Modify: `web/src/lib/components/form/TimeInput.svelte`
- Modify: `web/src/lib/components/form/DirectoryInput.svelte`
- Modify: `web/src/lib/components/form/OptimizerParamsModal.svelte`
- Modify: `web/src/lib/components/form/Field.svelte`
- Modify: `web/src/lib/components/form/PathInput.svelte`
- Modify: `web/src/lib/components/training/GalleryImageViewer.svelte`
- Modify: `web/src/lib/components/training/SampleGallery.svelte`
- Modify: `web/src/lib/components/training/GpuMonitor.svelte`
- Modify: `web/src/lib/components/concepts/AugmentationPreview.svelte`
- Modify: `web/src/lib/components/concepts/ConceptStatsPanel.svelte`
- Modify: `web/src/lib/components/concepts/ConceptTextFields.svelte`
- Modify: `web/src/lib/components/concepts/ConceptImageFields.svelte`
- Modify: `web/src/lib/components/concepts/ConceptGeneralFields.svelte`
- Modify: `web/src/lib/components/concepts/ConceptsEditor.svelte`
- Create: `web/src/lib/components/datasets/DatasetCollection.test.ts`
- Modify: `web/src/routes/datasets/DatasetsPage.test.ts`

**Interfaces:**
- DatasetCollection renders canonical Table at 768px and above and visible-action Cards below 768px from one dataset/action source.
> **Superseded 2026-07-28:** desktop now renders the card gallery, not a Table.
> Reversed by `docs/superpowers/plans/2026-07-28-post-cutover-ui-defects.md` Task 7
> at the product owner's request. The Table was a regression from the pre-cutover UI.
- No production component uses legacy token aliases.
- Remaining `:global()` selectors are limited to documented third-party DOM boundaries.

- [x] **Step 1: Add dataset table/card behavior tests**

At desktop, assert a table with dataset name/count columns and actions. At phone, assert cards and no table. In both modes, invoke open/delete and assert identical dataset identity. Assert Delete is visible without hover on phone and has a 44px target.

- [x] **Step 2: Record legacy remnants**

Run:

```bash
rg "var\(--(bg|panel|panel-raised|control|line|text|muted-text|accent-color|danger|success|focus|color-bg|color-text|color-border|color-primary)" src --glob '*.svelte' --glob '*.css'
rg ":global\(" src/lib/components src/routes --glob '*.svelte'
```

Expected before fix: legacy tokens and application-to-shadcn overrides are reported.

- [x] **Step 3: Rebuild dataset desktop/phone views**

Use canonical Table for desktop comparison and Cards for phone. Share `promptDelete(dataset.name)` and navigation functions. Keep action buttons visible on touch layouts; do not rely on hover opacity.

- [x] **Step 4: Replace legacy aliases with semantic tokens**

Map surfaces to `--background`, `--card`, `--popover`; text to `--foreground` or `--muted-foreground`; lines to `--border`; actions to `--primary`, `--destructive`, and their foreground pairs. Replace parent overrides with explicit component `class`/variant APIs. Add an inline comment only when `:global()` is required to style third-party uPlot, ANSI, or Bits UI generated DOM.

- [x] **Step 5: Remove alias declarations and verify searches**

Delete legacy aliases from `app.css`. Repeat both searches. Expected: no legacy-token matches; every remaining `:global()` has a nearby third-party-boundary comment.

- [x] **Step 6: Run the full unit suite and commit**

Run:

```bash
bun run test
bun run check
bun run build
```

Expected: 54 or more test files pass, no new check warnings, build passes.

```bash
git add web/src
git commit -m "refactor(web): finish semantic styling cutover"
```

### Task 8: Make Browser, Accessibility, And Visual Tests Trustworthy

**Files:**
- Modify: `web/playwright.config.ts`
- Modify: `web/e2e/theme.spec.ts`
- Modify: `web/e2e/mobile.spec.ts`
- Modify: `web/e2e/firefox-smoke.spec.ts`
- Modify: `web/e2e/responsive-workflows.spec.ts`
- Modify: `web/e2e/accessibility.spec.ts`
- Modify: `web/e2e/visual.spec.ts`
- Replace: `web/e2e/visual.spec.ts-snapshots/*.png`
- Create: `.github/workflows/web.yml`
- Delete: `web/.vscode/extensions.json`
- Delete: `web/.vscode/settings.json`

**Interfaces:**
- Phone projects use iPhone 13 emulation with explicit viewport `{ width: 390, height: 844 }`.
- Visual tests execute in both `chromium-desktop` and `chromium-phone`, partitioned by project.
- Axe scans include color contrast in both themes.

- [x] **Step 1: Correct Playwright project selection tests/config**

Set both phone projects to explicit `390x844`. Include `theme` and `visual` in `chromium-phone.testMatch`. In visual tests, use `testInfo.project.name` to skip desktop-only cases in phone and phone-only cases in desktop, rather than changing viewport inside a desktop project.

- [x] **Step 2: Replace smoke assertions with real workflow assertions**

On the phone project, edit and save a concept, create/edit a dataset, edit a sampling prompt, invoke training controls/status, switch theme across navigation/reload, and assert outcomes. Require `alertdialog` for destructive confirmation with no ordinary-dialog fallback.

Replace focus assertions by tabbing through known first/last controls and asserting focus stays within the open modal and wraps to the expected element. Dispatch a real media-query/viewport transition while an editor contains an incomplete draft and assert one dialog plus retained state.

- [x] **Step 3: Audit real Drawer and contrast behavior**

Remove `.disableRules(['color-contrast'])`. Run axe in dark and light on representative pages. For the Drawer audit, open Save Configuration at phone width and scan its actual `role="dialog"`; do not substitute ConsoleDrawer.

- [x] **Step 4: Seed each named visual state before capture**

Before screenshots, assert the expected state:

```text
dataset desktop: table visible with at least one named dataset
loading: route interception remains pending and skeleton role is visible
error: /api/health fails before navigation and Error banner is visible
ordinary overlay: Dialog in desktop project, Drawer in phone project
```

Remove the error-test fallback that snapshots the normal shell. Make `switchToLightTheme` require and click the visible theme control.

- [x] **Step 5: Regenerate only reachable snapshots**

Run:

```bash
bunx playwright test e2e/visual.spec.ts --project=chromium-desktop --update-snapshots
bunx playwright test e2e/visual.spec.ts --project=chromium-phone --update-snapshots
```

Inspect every image. Confirm dataset-table and empty-state hashes differ and that loading/error images visibly contain their named state.

- [x] **Step 6: Add reproducible browser provisioning**

Create `.github/workflows/web.yml`:

```yaml
name: Web

on:
  push:
    paths: ["web/**", "modules/webui/**", "tests/webui/**", "requirements-webui*.txt"]
  pull_request:
    paths: ["web/**", "modules/webui/**", "tests/webui/**", "requirements-webui*.txt"]

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - uses: oven-sh/setup-bun@v2
      - run: python -m pip install -r ../requirements-webui-dev.txt
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium firefox webkit
      - run: bun run check
      - run: bun run test
      - run: bun run build
      - run: bunx playwright test
```

Do not rely on browsers preinstalled on a developer workstation.

- [x] **Step 7: Remove accidental editor files**

Delete `web/.vscode/extensions.json` and `web/.vscode/settings.json`; they are unrelated editor preferences and are not part of the product migration.

- [x] **Step 8: Run browser acceptance**

Run:

```bash
bun run build
bunx playwright test --project=chromium-desktop
bunx playwright test --project=chromium-phone
bunx playwright test --project=firefox-smoke
bunx playwright test --project=webkit-phone
```

Expected: all provisioned projects pass. If host dependencies still block WebKit, report the exact missing libraries; do not skip assertions in the other phone project.

- [x] **Step 9: Commit trustworthy acceptance coverage**

```bash
git add web/playwright.config.ts web/e2e web/package.json web/bun.lock .github/workflows/web.yml
git add -u web/.vscode
git commit -m "test(web): verify corrected shadcn workflows"
```

### Task 9: Final Review-Finding Audit

**Files:**
- Verification-only task: route defects back to the exact files listed by Tasks 1-8.

**Interfaces:**
- Verifies all fourteen review findings and introduces no new feature work.

- [x] **Step 1: Confirm every finding has a passing regression**

Create execution notes mapping each reviewed issue to its test name: scheduler path, numeric drafts, concept retention, dataset deletion, sampling feedback/deletion, password clear/overwrite, mobile navigation, phone status actions, ValueSelect collision/unknown value, overlay containment, visual-state truthfulness, axe contrast/Drawer audit, semantic shell state, and legacy cleanup.

- [x] **Step 2: Run clean verification**

From `web/`:

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
bunx playwright test
```

Expected: install uses the committed lockfile; check has no new errors or warnings attributable to this work; unit, build, and all provisioned browser tests pass.

- [x] **Step 3: Inspect repository state and diff**

Run:

```bash
git status --short
git diff --check 67cd05f5..HEAD
git diff --stat 67cd05f5..HEAD
```

Expected: no whitespace errors, no uncommitted fix files, and no unrelated `.github/hooks/` or sample-gallery-plan changes included.

- [x] **Step 4: Route any audit correction back to its owning task**

If the audit finds a defect, reopen the task that owns that contract, add a failing regression there, make the smallest fix, rerun that task's focused verification, and use that task's commit message. If the audit finds no defect, create no commit.
