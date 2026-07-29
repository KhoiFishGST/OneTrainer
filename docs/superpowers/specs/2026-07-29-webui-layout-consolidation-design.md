# Web UI Layout Consolidation

**Date:** 2026-07-29
**Status:** Approved

## Problem

Panel width in the web UI is a copy-pasted constant, not a shared decision. `740px`
appears in eight files; `1600px`, `1200px`, and `900px` each appear in one more. The
result is visible drift:

- Settings panels (General, Datasets, Model, LoRA) are 740px, noticeably narrower
  than the Live Training Dashboard and Gallery at 1600px.
- The Sampling route mixes widths: a 740px settings panel, a full-bleed definition-file
  card, and a full-bleed prompts table.
- The Embeddings warning banner and Additional Embeddings section run edge-to-edge
  while the params panel beside them does not.

Two content problems compound this:

- Sample Settings renders a "Sample Definition Filename" field that the route already
  supersedes with its own dropdown.
- Sample Settings is a single column of nine rows, so it is taller than it needs to be.
- The prompt table renders each prompt twice — once read-only, once editable.

## Goals

Establish one owner for page width and field layout, fix the four routes that drifted,
and make future drift a failing test rather than a code-review catch.

## Non-goals

Colour, typography, spacing scale, and component-level visual design are unchanged.
This is width and field flow only.

## Decisions

| Question | Decision |
|---|---|
| Standard panel width | Fluid, `width: 100%` capped at `1600px` — identical to Live and Gallery |
| Field density at that width | Two columns above a 900px *container* width, one column below |
| Warnings, list sections, tables | Share the single page container; no separate narrower cap |
| Enforcement | A `RoutePage` component plus a boundary test, not a convention |

Fluid-to-1600 with single-column fields was rejected: `Field.svelte` pins the control
side at 420px, so widening a single-column panel grows the label-to-control gap rather
than the controls. Width and two-column flow have to land together.

---

## 1. Layout primitives

Two tokens in `src/app.css` under `@theme inline`:

```css
--width-page: 1600px;
--width-field-control: 420px;
```

A new `src/lib/components/layout/RoutePage.svelte` owns page padding, gap, and width:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, class: className = '' }: { children?: Snippet; class?: string } = $props();
</script>

<div class={`route-page ${className}`}>
  {#if children}{@render children()}{/if}
</div>

<style>
  .route-page {
    width: 100%;
    max-width: var(--width-page);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-sizing: border-box;
    container-type: inline-size;
  }
</style>
```

`container-type: inline-size` establishes the page-level query container that §5 relies
on. `FormPanel` declares its own container for the panel-level queries in §2.

Every hardcoded width is then **deleted**, not adjusted:

| File | Removed |
|---|---|
| `lib/components/form/FormPanel.svelte:19` | `max-w-[740px]` → `w-full` |
| `lib/components/form/SchemaForm.svelte:304` | `width: 740px` → `width: 100%` |
| `routes/(app)/general/+page.svelte:69` | `.general-tab-container` `width: 740px` |
| `routes/(app)/model/+page.svelte:70` | `width: 740px` |
| `routes/(app)/lora/+page.svelte:138` | `width: 740px`; `Alert` `max-w-[740px]` at :63 |
| `routes/(app)/training/+page.svelte:120` | `width: 740px` |
| `routes/(app)/sampling/+page.svelte:331` | `w-[740px]` |
| `routes/(app)/datasets/+page.svelte:101` | `w-[740px]` → `w-full` |
| `lib/components/concepts/ConceptsEditor.svelte:442` | `.toolbar-header` `width: 740px` → `width: 100%` |
| `routes/(app)/concepts/+page.svelte:90` | `.concepts-page` `max-width: 1200px` |
| `routes/(app)/secrets/+page.svelte:294` | `.secrets-page` `max-width: 900px` |
| `routes/(app)/live/+page.svelte:188` | `.live-dashboard` `max-width: 1600px` |
| `routes/(app)/gallery/+page.svelte:85` | `max-w-[1600px] w-full` |
| `routes/(app)/backup/+page.svelte:116` | `.route-page` padding block |
| `routes/(app)/embeddings/+page.svelte:228` | `.route-page` padding block |

Each of those roots becomes `<RoutePage>`. Live and Gallery are visually unchanged by
this — they already used the target values — but they stop being a second source of
truth for them.

**Exception:** `routes/(app)/console/+page.svelte` keeps its own `.console-page`. It is
a `height: 100%`, `overflow: hidden` terminal pane, not a scrolling document, and a
`max-width` would be wrong for it. It is allowlisted in the boundary test.

`routes/(app)/data/` and `routes/(app)/lora-embedding/` contain only `+page.ts`
redirects and are out of scope.

## 2. Two-column fields via container queries

`FormPanel`'s root gains `container-type: inline-size`. `.group-fields` in
`SchemaForm.svelte` becomes a grid:

```css
.group-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem 1.5rem;
  width: 100%;
}

@container (min-width: 900px) {
  .group-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

`Field.svelte` gets two changes:

- `.field-control-side` moves from `flex: 0 0 420px; width: 420px; min-width: 420px`
  to `flex: 0 1 var(--width-field-control); min-width: 0`, so controls shrink inside a
  column instead of overflowing it.
- `.form-field.is-full-width` gains `grid-column: 1 / -1`, so the fields already marked
  full-width (`base_model_name`, `model_type`, `output_model_destination`) span both
  columns.

The existing `.group-fields.components-table` variant keeps its flex column layout and
opts out of the grid.

**Why container queries rather than a viewport breakpoint.** The `training` route
already renders three panels side-by-side in a grid (`SchemaForm.svelte:275-295`). Each
is roughly 500px wide at a 1600px page. A container query keeps those panels
single-column automatically, with no route-specific exception and no breakpoint that has
to stay in sync with the panel grid's own `1280px` and `1024px` media queries. The same
mechanism delivers the mobile wrap, since a narrow viewport yields a narrow container.

The existing `Field.svelte` `max-width: 767px` media query, which stacks label above
control, is retained unchanged.

This section changes the appearance of every settings route — General, Model, LoRA,
Backup, Embeddings, and Sampling — not only Sampling. That is intentional and was
approved: a single field-flow rule is the point.

## 3. Sampling route

### 3.1 Remove the redundant definition-filename field

`sampling/+page.svelte:115-123` attempts to filter the field out:

```js
(f) => f.id !== 'samples' && f.id !== 'sample_definition_file_name'
```

The field's `id` is `sample-def-filename`; `sample_definition_file_name` is its *key*
(`modules/webui/schema/builders/sampling.py:15-22`). The second clause has never
matched, which is why the field still renders.

Fix at the source rather than repairing the filter: delete both the `sample-def-filename`
and `samples` `Field` entries from `build_sampling_tab()` in
`modules/webui/schema/builders/sampling.py`, then delete the client-side `tab` derivation
entirely and pass `rawTab` through. The `sampling` tab is consumed only by the web UI
schema builders, so no other surface is affected.

Sample Settings drops from nine fields to seven, and §2 lays those out as four rows.

### 3.2 Move the definition-file dropdown under Sample Prompts

The standalone card at `sampling/+page.svelte:306-329` is removed. Its `Select` and
"Add Config" button move into the Sample Prompts section header, which becomes a
`flex` row with the heading on the left and the controls on the right, wrapping on
narrow containers:

```
Sample Prompts (4)      Definition file [ samples.json ▾ ]   [+ Add Config]
──────────────────────────────────────────────────────────────────────────
```

The dropdown belongs with the prompts it selects. `handleSelectConfigFile`,
`handleOpenAddConfigModal`, and the `ResponsiveDialogDrawer` that creates a new file are
unchanged; only their placement in the markup moves.

### 3.3 Container

The route root becomes `<RoutePage>`, replacing `p-6 flex flex-col gap-6`. The settings
panel and the prompts table then share the page width.

## 4. Prompt table read-only column

`SamplePromptTable.svelte:132` renders the prompt twice inside one cell — a read-only
`<span>` stacked above a bound `TextInput`:

```svelte
<span class="text-sm text-foreground">{sample.prompt}</span>
<TextInput aria-label="Prompt Text" bind:value={sample.prompt} ... />
```

The `<span>` is deleted. Because this is a stacked element within a single cell rather
than a separate column, no `Table.Head` entry, column width, or colspan changes.
`bind:value` is untouched.

`SamplePromptCards.svelte` (the mobile variant) is checked for the same duplication and
given the same treatment if present.

## 5. Embeddings and Secrets

**Embeddings** (`routes/(app)/embeddings/+page.svelte`): the local `.route-page` rule is
deleted and the root becomes `<RoutePage>`. The warning `Alert` and the Additional
Embeddings `.list-section` then align to the same left and right edges as the params
panel. `.embeddings-fieldset { width: 100% }` is retained.

**Secrets** (`routes/(app)/secrets/+page.svelte`): `.secrets-page` becomes `<RoutePage>`.
So that its two settings cards do not each become a single 1600px-wide column,
`.card-grid` changes from a flex column to the same responsive two-column grid:

```css
.card-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
@container (min-width: 900px) {
  .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

This requires `container-type: inline-size` on `RoutePage`, which is added alongside the
`FormPanel` container so page-level and panel-level container queries both resolve.

The insecure-HTTP `Alert` keeps its current markup; it inherits the container width and
needs no change. It was the reference for "what correct looks like" and remains so.

## 6. Drift guard

`src/lib/components/layout/layout-boundary.test.ts`, following the structure of the
existing `style-boundary.test.ts` and `ui-variant-boundary.test.ts` — exported pure
predicate functions, fixture tests for each, then a sweep over
`import.meta.glob('/src/**/*.svelte', { query: '?raw', eager: true })`.

Three rules:

1. **`findHardcodedPageWidth`** — matches a width declaration (`width:`, `max-width:`,
   `min-width:`, or a Tailwind `w-[…]` / `max-w-[…]` / `min-w-[…]` utility) whose value
   is one of `740px`, `900px`, `1200px`, or `1600px`, anywhere under `src/routes` or
   `src/lib/components`. Matching the declaration rather than the bare number avoids
   firing on unrelated dimensions such as a chart height. Allowlist:
   `src/lib/components/ui/**` (vendored shadcn
   primitives carry their own `max-w-*` utilities legitimately) and overlay components,
   whose widths are dialog sizing rather than page sizing.
2. **`findRoutesMissingRoutePage`** — every `src/routes/(app)/**/+page.svelte` must
   import `RoutePage`. Allowlist: `console/+page.svelte`.
3. **`findFixedControlWidth`** — flags `flex: 0 0` combined with a `px` basis in
   `Field.svelte` and any form component, forcing use of `--width-field-control`.

A new route that reinvents its own width fails the suite.

## 7. Test impact

| File | Change |
|---|---|
| `routes/(app)/sampling/SamplingPage.test.ts` | Definition-file selector moves into the prompts header; the two schema fields no longer render |
| `lib/components/sampling/SamplePromptTable.test.ts` | Assertions on the read-only prompt text |
| `lib/components/sampling/SamplePromptCards.test.ts` | Only if §4 finds the same duplication |
| `routes/(app)/embeddings`, `secrets`, `general`, `datasets` page tests | Structural assertions on root elements and local class names |
| `modules/webui` schema tests | Sampling tab field count |

The Playwright byte-budget tests (`e2e/`, 800 KB live-route budget) are unaffected: this
adds one small component and net-removes CSS.

## Rollout

Sections 1 and 2 land together — width without two-column flow leaves oversized label
gaps, and two-column flow without width has nowhere to flow. Sections 3-5 are
independent of each other and can land in any order after that. Section 6 lands last,
once the violations it detects are already gone.
