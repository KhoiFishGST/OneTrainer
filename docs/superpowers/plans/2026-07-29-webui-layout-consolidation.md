# Web UI Layout Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one component own page width across every web UI route, flow settings fields into two columns on wide containers, and fix the Sampling and Embeddings routes that drifted.

**Architecture:** A new `RoutePage.svelte` owns page padding, gap, and `max-width`, replacing the `740px` constant currently copy-pasted across eight files plus three other one-off widths. Field density comes from a CSS *container* query on `FormPanel`, not a viewport media query, so panels rendered inside the Training route's three-column grid stay single-column with no special-casing. A `layout-boundary.test.ts` then fails the suite if any route reinvents its own width.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), Tailwind CSS v4, Vitest + `@testing-library/svelte`, Playwright, Python 3.12 + pytest (web UI schema builders only).

**Spec:** `docs/superpowers/specs/2026-07-29-webui-layout-consolidation-design.md`

## Global Constraints

- **Python changes are confined to `modules/webui/` and `tests/webui/`.** No core OneTrainer training source is touched. The only production Python edit in this plan is `modules/webui/schema/builders/sampling.py`.
- **No `:global()` in Svelte `<style>` blocks.** `src/lib/components/style-boundary.test.ts` enforces this, with a single exemption for `ConsoleView.svelte`. A parent may not reach into a child's classes — styles for `.form-field` must live in `Field.svelte`, styles for `.group-fields` in `SchemaForm.svelte`.
- **No `min-height: 0`.** Also enforced by `style-boundary.test.ts` (it defeats the 44px touch target).
- **No bare `data-*:` Tailwind variants** in `src/lib/components/ui/**`. Enforced by `ui-variant-boundary.test.ts`. Use `data-[state=open]:` form.
- **The single page width is `1600px`**, exposed as `var(--width-page)`. The single form control width is `420px`, exposed as `var(--width-field-control)`. Never re-type these numbers.
- **The two-column field breakpoint is a container width of `900px`.** Never express it as a viewport media query.
- Working directory for all `bun`/`npx` commands is `web/`. Working directory for `pytest` is the repo root.
- Test command: `cd web && bun run test` (Vitest). Python: `pytest tests/webui -q`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `web/src/lib/components/layout/RoutePage.svelte` | Sole owner of page padding, gap, and max-width |
| `web/src/lib/components/layout/RoutePage.test.ts` | Verifies the container renders children and carries the class |
| `web/src/lib/components/layout/layout-boundary.test.ts` | Fails the suite on any hardcoded page width or missing `RoutePage` |

**Modified**

| File | Change |
|---|---|
| `web/src/app.css` | Add `--width-page` / `--width-field-control` to `:root` |
| `web/src/lib/components/form/FormPanel.svelte` | Drop `max-w-[740px]`, become a query container |
| `web/src/lib/components/form/SchemaForm.svelte` | Drop `width: 740px`; `.group-fields` becomes a container-query grid |
| `web/src/lib/components/form/Field.svelte` | Flexible control side; full-width fields span both grid columns |
| `web/src/routes/(app)/{general,model,lora,training,backup}/+page.svelte` | Adopt `RoutePage`, delete local widths |
| `web/src/routes/(app)/{live,gallery,concepts,datasets}/+page.svelte` | Adopt `RoutePage`, delete local widths |
| `web/src/routes/(app)/secrets/+page.svelte` | Adopt `RoutePage`; card grid goes responsive two-column |
| `web/src/routes/(app)/embeddings/+page.svelte` | Adopt `RoutePage` so warning and list align to the panel |
| `web/src/routes/(app)/sampling/+page.svelte` | Adopt `RoutePage`; move the definition-file selector under Sample Prompts |
| `web/src/lib/components/concepts/ConceptsEditor.svelte` | `.toolbar-header` `740px` → `100%` |
| `web/src/lib/components/sampling/SamplePromptTable.svelte` | Delete the read-only prompt `<span>` |
| `web/src/lib/components/sampling/SamplePromptCards.svelte` | Delete the read-only prompt `<p>` |
| `modules/webui/schema/builders/sampling.py` | Remove the `sample-def-filename` and `samples` fields |
| `tests/webui/test_schema_coverage.py` | Add both keys to `DEPRECATED_OR_INTERNAL` |

---

## Two deviations from the spec (deliberate)

**1. Layout tokens go in `:root`, not `@theme inline`.** The spec put them in `@theme inline`. They are consumed only via `var()` inside Svelte scoped CSS and never used to generate Tailwind utilities, and `@theme inline` alters how Tailwind emits values. `:root` is the correct home — next to the existing `--radius`.

**2. `RoutePage` does NOT get `container-type: inline-size`.** The spec added it so the Secrets card grid could use a container query. But `container-type: inline-size` implies `contain: layout style inline-size`, which makes the element a containing block for `position: fixed` descendants — a real risk on pages that host overlays. Task 5 instead uses `grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr))`, which needs no query at all. `FormPanel` still becomes a container (Task 2); it is an inner card with no fixed-position descendants.

---

### Task 1: Layout tokens and the RoutePage container

**Files:**
- Create: `web/src/lib/components/layout/RoutePage.svelte`
- Create: `web/src/lib/components/layout/RoutePage.test.ts`
- Modify: `web/src/app.css` (the `:root` block starting line 48)

**Interfaces:**
- Consumes: nothing.
- Produces: `RoutePage.svelte`, default export, props `{ children?: Snippet; class?: string }`. Renders a single `<div class="route-page {class}">`. Consumed by Tasks 3-7 and asserted by Task 9. Also produces the CSS custom properties `--width-page: 1600px` and `--width-field-control: 420px` on `:root`, consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/components/layout/RoutePage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RoutePage from './RoutePage.svelte';

describe('RoutePage', () => {
  it('renders as a single .route-page element', () => {
    const { container } = render(RoutePage);
    const root = container.querySelector('.route-page');
    expect(root).toBeInTheDocument();
    expect(root?.tagName).toBe('DIV');
  });

  it('appends a caller-supplied class alongside .route-page', () => {
    const { container } = render(RoutePage, { class: 'gap-tight' });
    const root = container.querySelector('.route-page');
    expect(root).toHaveClass('route-page');
    expect(root?.className).toContain('gap-tight');
  });

  it('renders nothing but the container when given no children', () => {
    const { container } = render(RoutePage);
    expect(container.querySelector('.route-page')?.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && bun run test src/lib/components/layout/RoutePage.test.ts
```

Expected: FAIL — `Failed to resolve import "./RoutePage.svelte"`.

- [ ] **Step 3: Create the component**

Create `web/src/lib/components/layout/RoutePage.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    class: className = '',
  }: {
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<div class={`route-page ${className}`}>
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  :where(.route-page) {
    width: 100%;
    max-width: var(--width-page);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-sizing: border-box;
  }
</style>
```

`:where()` keeps specificity at zero so a caller-supplied Tailwind class such as `gap-4` wins without `!important`, matching the pattern already used by `PageHeader.svelte` and `FormPageSkeleton.svelte`.

- [ ] **Step 4: Add the layout tokens**

In `web/src/app.css`, inside the `:root` block, immediately after the `--radius: 0.5rem;` line (currently line 89), add:

```css
  /* Layout: the single source of truth for page and control width.
     Consumed via var() in component styles; not a Tailwind utility namespace. */
  --width-page: 1600px;
  --width-field-control: 420px;
```

Do not add these to the dark-theme `:root` override further down the file — they are not theme-dependent.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd web && bun run test src/lib/components/layout/RoutePage.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

```bash
cd web && bun run test
```

Expected: PASS. Nothing imports `RoutePage` yet, so this is a pure addition.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/layout/RoutePage.svelte \
        web/src/lib/components/layout/RoutePage.test.ts \
        web/src/app.css
git commit -m "feat(web): add RoutePage container and layout width tokens"
```

---

### Task 2: Two-column field flow via container queries

**Files:**
- Modify: `web/src/lib/components/form/FormPanel.svelte:19`
- Modify: `web/src/lib/components/form/SchemaForm.svelte` (`.schema-form` and `.group-fields` in the `<style>` block, from line 302)
- Modify: `web/src/lib/components/form/Field.svelte` (`.field-control-side` line 159-166, `.form-field.is-full-width` line 136-139)
- Test: `web/src/lib/components/form/FormLayout.test.ts` (create)

**Interfaces:**
- Consumes: `--width-field-control` from Task 1.
- Produces: `FormPanel` renders a root carrying both `form-panel` and `@container` classes and no `max-w-*`. `SchemaForm`'s `.group-fields` is a CSS grid, single-column by default and two-column inside a container ≥ 900px. `Field`'s `.form-field.is-full-width` spans all grid columns. No prop signatures change; Tasks 3-7 need no adaptation.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/components/form/FormLayout.test.ts`. These are source-level assertions rather than computed-style assertions, because jsdom does not implement container queries and would report nothing useful:

```ts
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('/src/lib/components/form/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const formPanel = sources['/src/lib/components/form/FormPanel.svelte'];
const schemaForm = sources['/src/lib/components/form/SchemaForm.svelte'];
const field = sources['/src/lib/components/form/Field.svelte'];

describe('form layout', () => {
  it('FormPanel no longer pins its own width', () => {
    expect(formPanel).not.toMatch(/max-w-\[\d+px\]/);
  });

  it('FormPanel establishes a query container for its fields', () => {
    expect(formPanel).toContain('@container');
  });

  it('SchemaForm fills its container instead of hardcoding 740px', () => {
    expect(schemaForm).not.toContain('740px');
    expect(schemaForm).toMatch(/\.schema-form\s*\{[^}]*width:\s*100%/);
  });

  it('SchemaForm lays fields out as a grid that doubles on a wide container', () => {
    expect(schemaForm).toMatch(/\.group-fields\s*\{[^}]*display:\s*grid/);
    expect(schemaForm).toContain('@container (min-width: 900px)');
    expect(schemaForm).toContain('repeat(2, minmax(0, 1fr))');
  });

  it('SchemaForm uses a container query, never a viewport query, for field columns', () => {
    const fieldColumnRules = schemaForm.slice(schemaForm.indexOf('.group-fields'));
    expect(fieldColumnRules).not.toMatch(/@media[^{]*\)\s*\{\s*\.group-fields/);
  });

  it('Field control side is flexible and driven by the shared token', () => {
    expect(field).toContain('var(--width-field-control)');
    expect(field).not.toMatch(/flex:\s*0\s+0\s+\d+px/);
    expect(field).toMatch(/\.field-control-side\s*\{[^}]*min-width:\s*0/);
  });

  it('full-width fields span every grid column', () => {
    expect(field).toMatch(/\.form-field\.is-full-width\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && bun run test src/lib/components/form/FormLayout.test.ts
```

Expected: FAIL — 7 failures, starting with `FormPanel no longer pins its own width` (it still contains `max-w-[740px]`).

- [ ] **Step 3: Make FormPanel a full-width query container**

In `web/src/lib/components/form/FormPanel.svelte`, replace line 19:

```svelte
<Card.Root class={cn("form-panel @container w-full p-5 flex flex-col gap-4 border border-border bg-card text-card-foreground rounded-lg shadow-sm", isComponentsGroup && "is-components-group")}>
```

`@container` is a Tailwind v4 built-in utility that sets `container-type: inline-size`. The only change from the current line is `max-w-[740px]` → `w-full` plus the added `@container`.

- [ ] **Step 4: Convert `.group-fields` to a container-query grid**

In `web/src/lib/components/form/SchemaForm.svelte`, in the `<style>` block, replace the `.schema-form` rule:

```css
  .schema-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }
```

(only `width: 740px; max-width: 100%;` becomes `width: 100%;` — the flex properties are unchanged)

and replace the `.group-fields` rule:

```css
  .group-fields {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.625rem 1.5rem;
    width: 100%;
    align-items: start;
  }

  @container (min-width: 900px) {
    .group-fields:not(.components-table) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
```

Leave `.schema-form.is-training-tab`, `.training-column`, its two `@media` rules, and `.group-fields.components-table` exactly as they are. `components-table` re-declares `display: flex`, and the `:not()` above keeps the grid from fighting it.

- [ ] **Step 5: Make the field control side flexible**

In `web/src/lib/components/form/Field.svelte`, replace the `.field-control-side` rule (lines 159-166):

```css
  .field-control-side {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 0 1 var(--width-field-control);
    width: var(--width-field-control);
    min-width: 0;
  }
```

and extend `.form-field.is-full-width` (lines 136-139):

```css
  .form-field.is-full-width {
    flex: 1 1 100%;
    width: 100%;
    grid-column: 1 / -1;
  }
```

Leave the `max-width: 767px` media block, which stacks label above control on phones, unchanged — it still correctly overrides `.field-control-side` to full width.

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd web && bun run test src/lib/components/form/FormLayout.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 7: Run the full suite**

```bash
cd web && bun run test
```

Expected: PASS. `SchemaForm.test.ts` and `FormInputs.test.ts` assert on roles and labels rather than layout, so they should be unaffected. If any test asserts `.group-fields` is a flex column, update that assertion to grid — the grid is now the intended behaviour.

- [ ] **Step 8: Verify visually**

```bash
cd web && bun run dev
```

Open `http://localhost:5173/general` in a window wider than ~1100px. Fields should still be single-column, because the panel is still 740px-constrained by the route wrapper — that route is not migrated until Task 3. Open `/training` and confirm the three-column panel grid is unchanged. This step is confirming *nothing broke yet*; the two-column effect appears in Task 3.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/components/form/FormPanel.svelte \
        web/src/lib/components/form/SchemaForm.svelte \
        web/src/lib/components/form/Field.svelte \
        web/src/lib/components/form/FormLayout.test.ts
git commit -m "feat(web): flow form fields into two columns on wide containers"
```

---

### Task 3: Migrate the schema-form routes to RoutePage

**Files:**
- Modify: `web/src/routes/(app)/general/+page.svelte`
- Modify: `web/src/routes/(app)/model/+page.svelte`
- Modify: `web/src/routes/(app)/training/+page.svelte`
- Modify: `web/src/routes/(app)/lora/+page.svelte`
- Modify: `web/src/routes/(app)/backup/+page.svelte`

**Interfaces:**
- Consumes: `RoutePage` from Task 1; the two-column grid from Task 2.
- Produces: nothing new. These routes become `RoutePage` consumers.

- [ ] **Step 1: Write the failing test**

Create `web/src/routes/(app)/RouteContainer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const routeSources = import.meta.glob('/src/routes/(app)/**/+page.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const MIGRATED_IN_THIS_TASK = [
  '/src/routes/(app)/general/+page.svelte',
  '/src/routes/(app)/model/+page.svelte',
  '/src/routes/(app)/training/+page.svelte',
  '/src/routes/(app)/lora/+page.svelte',
  '/src/routes/(app)/backup/+page.svelte',
];

describe('schema-form route containers', () => {
  it.each(MIGRATED_IN_THIS_TASK)('%s imports RoutePage', (file) => {
    expect(routeSources[file]).toContain('RoutePage');
  });

  it.each(MIGRATED_IN_THIS_TASK)('%s declares no width of its own', (file) => {
    expect(routeSources[file]).not.toContain('740px');
    expect(routeSources[file]).not.toContain('max-w-[740px]');
  });

  it.each(MIGRATED_IN_THIS_TASK)('%s no longer sets page padding locally', (file) => {
    expect(routeSources[file]).not.toMatch(/\.route-page\s*\{[^}]*padding:\s*1\.5rem/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && bun run test "src/routes/(app)/RouteContainer.test.ts"
```

Expected: FAIL — 15 failures (5 routes × 3 assertions).

- [ ] **Step 3: Migrate `general`**

In `web/src/routes/(app)/general/+page.svelte`, add the import after the `PageHeader` import:

```ts
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
```

Replace `<div class="route-page">` with `<RoutePage>` and its closing `</div>` with `</RoutePage>`. Leave the inner `<div class="general-tab-container">` markup exactly as it is, and replace the whole `<style>` block with:

```svelte
<style>
  .general-tab-container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
```

Also drop `class="mb-4"` from `<PageHeader>` — `RoutePage`'s `gap: 1.5rem` now provides the spacing, and leaving the margin double-spaces the header.

- [ ] **Step 4: Migrate `model`**

Same edit shape in `web/src/routes/(app)/model/+page.svelte`: add the `RoutePage` import, swap the `route-page` div for `<RoutePage>`, drop `class="mb-4"` from `<PageHeader>`, and reduce the `<style>` block to:

```svelte
<style>
  .model-tab-container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
```

- [ ] **Step 5: Migrate `training`**

Same shape in `web/src/routes/(app)/training/+page.svelte`. Note both modals (`OptimizerParamsModal`, `SchedulerParamsModal`) currently sit *inside* the `route-page` div — move them *outside* the `</RoutePage>` closing tag so overlay positioning is not affected by the flex column. Final `<style>` block:

```svelte
<style>
  .training-tab-container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
```

- [ ] **Step 6: Migrate `lora`**

In `web/src/routes/(app)/lora/+page.svelte`: add the import, swap the wrapper, drop `class="mb-4"` from `<PageHeader>`, and drop `class="mb-5 max-w-[740px]"` from the `<Alert>` so it becomes plain `<Alert>` — it now inherits the page width and the `RoutePage` gap. Final `<style>` block keeps everything except `.route-page` and the `.lora-container` width:

```svelte
<style>
  .warning-icon {
    font-size: 1.125rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .warning-text strong {
    color: var(--foreground);
  }

  .lora-fieldset {
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
    transition: opacity 0.2s ease, filter 0.2s ease;
  }

  .lora-fieldset:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }

  .lora-fieldset:disabled * {
    pointer-events: none;
  }

  .lora-container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
```

- [ ] **Step 7: Migrate `backup`**

In `web/src/routes/(app)/backup/+page.svelte`: add the import, swap the wrapper, drop `class="mb-6"` from `<PageHeader>`, and delete the `<style>` block entirely — `.route-page { padding: 1.5rem; }` was its only rule.

- [ ] **Step 8: Run the tests**

```bash
cd web && bun run test "src/routes/(app)/RouteContainer.test.ts"
cd web && bun run test
```

Expected: both PASS. If `page.test.ts` files for these routes query `.route-page`, update them to query `.route-page` on the `RoutePage` output — the class name is unchanged, so they should keep passing.

- [ ] **Step 9: Verify visually**

```bash
cd web && bun run dev
```

At a window width above ~1100px, `/general`, `/model`, `/backup`, and `/lora` should now show two columns of fields in a panel spanning the full content area up to 1600px. `/training` should still show its three-column panel grid with single-column fields inside each panel — this is the container query doing its job. Check `/training` at 1200px and 900px to confirm the panel grid collapses to 2 then 1 column as before.

- [ ] **Step 10: Commit**

```bash
git add "web/src/routes/(app)/general/+page.svelte" \
        "web/src/routes/(app)/model/+page.svelte" \
        "web/src/routes/(app)/training/+page.svelte" \
        "web/src/routes/(app)/lora/+page.svelte" \
        "web/src/routes/(app)/backup/+page.svelte" \
        "web/src/routes/(app)/RouteContainer.test.ts"
git commit -m "refactor(web): adopt RoutePage across the schema-form routes"
```

---

### Task 4: Migrate the dashboard and collection routes

**Files:**
- Modify: `web/src/routes/(app)/live/+page.svelte`
- Modify: `web/src/routes/(app)/gallery/+page.svelte`
- Modify: `web/src/routes/(app)/concepts/+page.svelte`
- Modify: `web/src/routes/(app)/datasets/+page.svelte`
- Modify: `web/src/lib/components/concepts/ConceptsEditor.svelte:442`

**Interfaces:**
- Consumes: `RoutePage` from Task 1.
- Produces: nothing new.

Live and Gallery are visually unchanged by this task — they already used `1600px` and `1.5rem` padding. The point is to stop them being a second source of truth for those numbers.

- [ ] **Step 1: Extend the failing test**

In `web/src/routes/(app)/RouteContainer.test.ts`, add below the existing describe block:

```ts
const DASHBOARD_ROUTES = [
  '/src/routes/(app)/live/+page.svelte',
  '/src/routes/(app)/gallery/+page.svelte',
  '/src/routes/(app)/concepts/+page.svelte',
  '/src/routes/(app)/datasets/+page.svelte',
];

describe('dashboard and collection route containers', () => {
  it.each(DASHBOARD_ROUTES)('%s imports RoutePage', (file) => {
    expect(routeSources[file]).toContain('RoutePage');
  });

  it.each(DASHBOARD_ROUTES)('%s declares no width of its own', (file) => {
    const source = routeSources[file];
    expect(source).not.toContain('max-w-[1600px]');
    expect(source).not.toContain('max-width: 1600px');
    expect(source).not.toContain('max-width: 1200px');
    expect(source).not.toContain('w-[740px]');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && bun run test "src/routes/(app)/RouteContainer.test.ts"
```

Expected: FAIL — 8 new failures.

- [ ] **Step 3: Migrate `live`**

In `web/src/routes/(app)/live/+page.svelte`, add the import alongside `PageHeader`:

```ts
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
```

`RoutePage` forwards `class` but not `data-testid`, and both `e2e/` and the page tests rely on `[data-testid="live-dashboard"]`. Rather than widening `RoutePage`'s API for a single caller, keep the existing div as an inner wrapper. Replace `<div class="live-dashboard" data-testid="live-dashboard">` and its matching closing `</div>` with:

```svelte
<RoutePage>
  <div class="live-dashboard" data-testid="live-dashboard">
    ...existing content...
  </div>
</RoutePage>
```

and reduce `.live-dashboard` in the `<style>` block to the inner layout only:

```css
  .live-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }
```

(`padding: 1.5rem` and `max-width: 1600px` are removed; every other rule in that `<style>` block stays.)

- [ ] **Step 4: Migrate `gallery`**

In `web/src/routes/(app)/gallery/+page.svelte`, add the `RoutePage` import and replace:

```svelte
<div class="p-6 flex flex-col gap-6 max-w-[1600px] w-full" data-testid="gallery-page">
```

with:

```svelte
<RoutePage>
  <div class="contents" data-testid="gallery-page">
```

closing with `</div></RoutePage>`. `class="contents"` (`display: contents`) keeps the test hook without introducing a second flex context. Drop `class="mb-2"` from `<PageHeader>`.

- [ ] **Step 5: Migrate `concepts`**

In `web/src/routes/(app)/concepts/+page.svelte`: add the import, replace `<div class="concepts-page">` with `<RoutePage class="gap-5">` and the closing `</div>` with `</RoutePage>`, then reduce the `<style>` block to:

```svelte
<style>
  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
```

`gap-5` is Tailwind's `1.25rem`, preserving the route's current gap; `RoutePage`'s `:where()` zero specificity lets it win.

- [ ] **Step 6: Migrate `datasets`**

In `web/src/routes/(app)/datasets/+page.svelte`: add the import, replace `<div class="p-6 flex flex-col gap-6">` with `<RoutePage>` and its closing `</div>` with `</RoutePage>`. On the toolbar card, change `w-[740px] max-w-full box-border` to `w-full`, so the line reads:

```svelte
  <div class="flex flex-col gap-4 bg-card p-4 md:p-5 rounded-lg border border-border w-full">
```

Leave the `<ResponsiveDialogDrawer>` where it is — it already sits outside the page div.

- [ ] **Step 7: Widen the concepts toolbar**

In `web/src/lib/components/concepts/ConceptsEditor.svelte`, in `.toolbar-header` (line ~442), replace:

```css
    width: 740px;
    max-width: 100%;
```

with:

```css
    width: 100%;
```

- [ ] **Step 8: Run the tests**

```bash
cd web && bun run test
```

Expected: PASS, including `LayoutContent.test.ts` and any `live`/`gallery` page tests that query the test IDs.

- [ ] **Step 9: Run the e2e byte-budget and accessibility checks**

```bash
cd web && bun run e2e
```

Expected: PASS. The 800 KB live-route budget should be unaffected — this task net-removes CSS.

- [ ] **Step 10: Commit**

```bash
git add "web/src/routes/(app)/live/+page.svelte" \
        "web/src/routes/(app)/gallery/+page.svelte" \
        "web/src/routes/(app)/concepts/+page.svelte" \
        "web/src/routes/(app)/datasets/+page.svelte" \
        web/src/lib/components/concepts/ConceptsEditor.svelte \
        "web/src/routes/(app)/RouteContainer.test.ts"
git commit -m "refactor(web): adopt RoutePage across dashboard and collection routes"
```

---

### Task 5: Secrets route width and responsive card grid

**Files:**
- Modify: `web/src/routes/(app)/secrets/+page.svelte`
- Test: `web/src/routes/(app)/secrets/page.test.ts` if it asserts on `.secrets-page`

**Interfaces:**
- Consumes: `RoutePage` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `web/src/routes/(app)/secrets/SecretsLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const source = (
  import.meta.glob('/src/routes/(app)/secrets/+page.svelte', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)['/src/routes/(app)/secrets/+page.svelte'];

describe('secrets layout', () => {
  it('uses the shared page container', () => {
    expect(source).toContain('RoutePage');
  });

  it('no longer caps itself at 900px', () => {
    expect(source).not.toContain('max-width: 900px');
  });

  it('lays its settings cards out as a responsive grid', () => {
    expect(source).toMatch(/\.card-grid\s*\{[^}]*display:\s*grid/);
    expect(source).toContain('repeat(auto-fit, minmax(min(420px, 100%), 1fr))');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && bun run test "src/routes/(app)/secrets/SecretsLayout.test.ts"
```

Expected: FAIL — all 3 assertions.

- [ ] **Step 3: Migrate the container**

In `web/src/routes/(app)/secrets/+page.svelte`, add the import after the `PageHeader` import:

```ts
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
```

Replace `<div class="secrets-page">` with `<RoutePage>` and its closing `</div>` with `</RoutePage>`. Drop `class="mb-6"` from `<PageHeader>` and `class="mb-6 flex items-start gap-4"` from the insecure-HTTP `<Alert>` becomes `class="flex items-start gap-4"` — `RoutePage`'s gap handles the spacing.

Move the `<AlertDialog.Root>` block (currently inside the `{:else}` branch) so it sits outside `</RoutePage>`, keeping the overlay out of the page flex column.

- [ ] **Step 4: Make the card grid responsive**

In the same file's `<style>` block, delete the `.secrets-page` rule entirely and replace `.card-grid`:

```css
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
    gap: 1.5rem;
    align-items: start;
  }
```

`auto-fit` with a `min()` floor gives two columns on a wide page and one on a narrow one, with no media or container query — and, unlike a container query, requires no `contain` on an ancestor.

Also update `.skeleton-container` so the two loading skeletons match the loaded layout:

```css
  .skeleton-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
    gap: 1.5rem;
  }
```

- [ ] **Step 5: Run the tests**

```bash
cd web && bun run test "src/routes/(app)/secrets"
cd web && bun run test
```

Expected: PASS.

- [ ] **Step 6: Verify visually**

```bash
cd web && bun run dev
```

Open `/secrets` wide: the Hugging Face and Web Portal cards sit side by side, spanning the same width as the panels on `/general`. Narrow the window below ~900px: they stack. The insecure-HTTP warning only renders over plain HTTP on a non-localhost host, so it will not appear in local dev — verify its width by temporarily flipping `isHttpInsecure` to `$state(true)` and reverting before committing.

- [ ] **Step 7: Commit**

```bash
git add "web/src/routes/(app)/secrets/+page.svelte" \
        "web/src/routes/(app)/secrets/SecretsLayout.test.ts"
git commit -m "refactor(web): align secrets page to the shared container width"
```

---

### Task 6: Embeddings route width

**Files:**
- Modify: `web/src/routes/(app)/embeddings/+page.svelte`

**Interfaces:**
- Consumes: `RoutePage` from Task 1.
- Produces: nothing new.

This is the route where the warning banner and the Additional Embeddings section currently run edge-to-edge while the params panel beside them does not.

- [ ] **Step 1: Write the failing test**

Create `web/src/routes/(app)/embeddings/EmbeddingsLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const source = (
  import.meta.glob('/src/routes/(app)/embeddings/+page.svelte', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)['/src/routes/(app)/embeddings/+page.svelte'];

describe('embeddings layout', () => {
  it('uses the shared page container', () => {
    expect(source).toContain('RoutePage');
  });

  it('no longer defines its own page padding', () => {
    expect(source).not.toMatch(/\.route-page\s*\{/);
  });

  it('keeps the warning alert free of a bespoke width', () => {
    expect(source).not.toMatch(/embeddings-warning-alert[^"]*max-w-/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && bun run test "src/routes/(app)/embeddings/EmbeddingsLayout.test.ts"
```

Expected: FAIL on the first two assertions.

- [ ] **Step 3: Migrate the container**

In `web/src/routes/(app)/embeddings/+page.svelte`, add the import after the `PageHeader` import:

```ts
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
```

Replace `<div class="route-page">` with `<RoutePage>` and its closing `</div>` with `</RoutePage>`. Drop `class="embeddings-header"` from `<PageHeader>` — no `.embeddings-header` rule exists in the file's `<style>` block, so it is a dead class.

In the `<style>` block, delete the `.route-page` rule entirely. Every other rule — `.warning-icon`, `.warning-text`, `.embeddings-fieldset`, `.embeddings-layout`, `.list-section`, `.list-action-bar`, `.list-title-group`, `.list-title`, `.count-badge`, `.bar-actions`, `.embeddings-grid` — stays exactly as is.

- [ ] **Step 4: Run the tests**

```bash
cd web && bun run test "src/routes/(app)/embeddings"
cd web && bun run test
```

Expected: PASS.

- [ ] **Step 5: Verify visually**

```bash
cd web && bun run dev
```

Open `/embeddings`. Set Base Model Type to something without textual-inversion support (for example `FLUX_DEV_1`) on `/model` so the warning renders. The warning, the Global Embedding Parameters panel, the Additional Embeddings header, and the embedding cards should all share the same left and right edges.

- [ ] **Step 6: Commit**

```bash
git add "web/src/routes/(app)/embeddings/+page.svelte" \
        "web/src/routes/(app)/embeddings/EmbeddingsLayout.test.ts"
git commit -m "fix(web): align embeddings warning and list to the panel width"
```

---

### Task 7: Sampling route — remove the redundant field and relocate the selector

**Files:**
- Modify: `modules/webui/schema/builders/sampling.py:14-29`
- Modify: `tests/webui/test_schema_coverage.py:4-7`
- Modify: `web/src/routes/(app)/sampling/+page.svelte`
- Modify: `web/src/routes/(app)/sampling/SamplingPage.test.ts`

**Interfaces:**
- Consumes: `RoutePage` from Task 1; the two-column grid from Task 2.
- Produces: the `sampling` schema tab now contains exactly one group, `sampling_settings`, with seven fields: `sample-after`, `sample-skip-first`, `sample-image-format`, `sample-video-format`, `sample-audio-format`, `samples-to-tensorboard`, `non-ema-sampling`.

**Background — why the current filter never worked.** `sampling/+page.svelte` derives a filtered `tab` with `f.id !== 'samples' && f.id !== 'sample_definition_file_name'`. The field's `id` is `sample-def-filename`; `sample_definition_file_name` is its *key* (`modules/webui/schema/builders/sampling.py:16-17`). The second clause has never matched, which is why "Sample Definition Filename" still renders. Fixing it at the source removes both the dead schema entry and the client-side workaround.

- [ ] **Step 1: Write the failing Python test**

Add to `tests/webui/test_schema.py`:

```python
def test_sampling_tab_excludes_web_ui_managed_fields():
    """The sampling route renders its own definition-file picker and prompt
    table, so the generic schema form must not also emit those fields."""
    from modules.util.enum.ModelType import ModelType
    from modules.util.enum.TrainingMethod import TrainingMethod
    from modules.webui.schema.builders.sampling import build_sampling_tab

    tab = build_sampling_tab(ModelType.STABLE_DIFFUSION_15, TrainingMethod.FINE_TUNE)
    field_ids = {field.id for group in tab.groups for field in group.fields}

    assert "sample-def-filename" not in field_ids
    assert "samples" not in field_ids
    assert "sample-after" in field_ids
    assert len(field_ids) == 7
```

If `Field` exposes its identifier under a different attribute name than `.id`, read `modules/webui/schema/types.py` and adjust the comprehension — do not change the assertions.

- [ ] **Step 2: Run it to verify it fails**

```bash
pytest tests/webui/test_schema.py::test_sampling_tab_excludes_web_ui_managed_fields -q
```

Expected: FAIL — `assert 'sample-def-filename' not in {...}`.

- [ ] **Step 3: Remove the two fields from the builder**

In `modules/webui/schema/builders/sampling.py`, delete the `sample-def-filename` `Field(...)` block (lines 15-22) and the `samples` `Field(...)` block (lines 23-29). The `Group` then starts directly with the `sample-after` field. Leave every other field, and the `Tab`/`Group` structure, untouched.

- [ ] **Step 4: Run it and watch the coverage test break**

```bash
pytest tests/webui -q
```

Expected: `test_schema.py::test_sampling_tab_excludes_web_ui_managed_fields` PASSES, but `test_schema_coverage.py::test_all_train_config_fields_covered` now FAILS with `TrainConfig fields missing from SchemaRegistry: {'samples', 'sample_definition_file_name'}`.

This is correct and expected — that test asserts every `TrainConfig` field appears somewhere in the schema.

- [ ] **Step 5: Declare both fields web-UI-managed**

In `tests/webui/test_schema_coverage.py`, add both keys to `DEPRECATED_OR_INTERNAL`:

```python
DEPRECATED_OR_INTERNAL = {
    "version", "config_version", "saved_version", "optimizer_defaults", "concept_file_name", "concepts", "datasets_dir", "cloud",
    "embedding", "additional_embeddings", "embedding_learning_rate", "preserve_embedding_norm", "embedding_weight_dtype",
    # Managed by the dedicated Sampling route (definition-file picker + prompt
    # table), not the generic schema form — same rationale as concepts above.
    "sample_definition_file_name", "samples",
}
```

This follows the existing precedent exactly: `concept_file_name` and `concepts` are already excluded because the Concepts route owns them.

- [ ] **Step 6: Run the Python suite**

```bash
pytest tests/webui -q
```

Expected: PASS.

- [ ] **Step 7: Update the Svelte test for the relocated selector**

In `web/src/routes/(app)/sampling/SamplingPage.test.ts`, replace the `renders title, Sample Now button, compact options panel, and Sample Prompts header` test's options-panel assertion. Delete these three lines:

```ts
    // Compact options panel wrapper
    const optionsPanel = container.querySelector('.options-panel');
    expect(optionsPanel).toBeInTheDocument();
```

and add a new test after it:

```ts
  it('renders the definition-file selector inside the Sample Prompts header, not above the settings panel', () => {
    vi.mocked(createSamplesQuery).mockReturnValue(
      readable({ data: [], isLoading: false, isError: false }) as any
    );
    vi.mocked(createUpdateSamplesMutation).mockReturnValue(
      readable({ mutateAsync: vi.fn(), isPending: false }) as any
    );

    const { container } = render(SamplingPage);

    const header = container.querySelector('[data-testid="sample-prompts-header"]');
    expect(header).toBeInTheDocument();
    expect(header?.querySelector('#sample-config-select')).toBeInTheDocument();
    expect(
      header?.querySelector('button')?.textContent
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /Add Config/i })).toBeInTheDocument();
  });
```

If `container` is not currently destructured from `render` in that test, change `render(SamplingPage);` to `const { container } = render(SamplingPage);`.

- [ ] **Step 8: Run it to verify it fails**

```bash
cd web && bun run test "src/routes/(app)/sampling/SamplingPage.test.ts"
```

Expected: FAIL — no element with `data-testid="sample-prompts-header"`.

- [ ] **Step 9: Rewrite the sampling route markup**

In `web/src/routes/(app)/sampling/+page.svelte`:

Add the import after the `PageHeader` import:

```ts
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
```

Delete the entire `const tab = $derived({...})` block (lines 115-123) — the filter it applied is now handled by the schema builder. Rename `rawTab` to `tab` in its `$derived` declaration so the rest of the file is unchanged:

```ts
  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'sampling') ?? {
      id: 'sampling',
      label: 'Sampling',
      groups: [],
    }
  );
```

Replace `<div class="p-6 flex flex-col gap-6">` with `<RoutePage>` and its closing `</div>` with `</RoutePage>`.

Delete the standalone definition-file card entirely (the `<div class="mb-6 p-4 bg-card border border-border rounded-lg">` block, lines 306-329).

Change the settings panel wrapper from:

```svelte
    <div class="options-panel w-[740px] max-w-full mb-8 box-border">
```

to:

```svelte
    <div class="options-panel w-full">
```

Replace the Sample Prompts section header block with one that carries the relocated selector:

```svelte
    <div>
      <div
        class="mb-4 pb-2 border-b border-border flex items-center justify-between gap-4 flex-wrap"
        data-testid="sample-prompts-header"
      >
        <h2 class="text-lg font-semibold m-0 text-foreground">Sample Prompts ({samples.length})</h2>

        <div class="flex items-center gap-3 flex-wrap">
          <label for="sample-config-select" class="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Definition file
          </label>
          <div class="min-w-[220px]">
            <Select
              id="sample-config-select"
              value={currentConfigFile}
              options={sampleFileOptions}
              onChange={handleSelectConfigFile}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            class="whitespace-nowrap"
            onclick={handleOpenAddConfigModal}
          >
            <Plus size={16} />
            <span>Add Config</span>
          </Button>
        </div>
      </div>
```

The rest of that block — the `{#if mobile}` / `{:else}` branch rendering `SamplePromptCards` or `SamplePromptTable` — is unchanged, as is its closing `</div>`.

Leave `handleSelectConfigFile`, `handleOpenAddConfigModal`, `handleCreateConfigFile`, and the `<ResponsiveDialogDrawer>` untouched — only the selector's position in the markup moves.

- [ ] **Step 10: Run the tests**

```bash
cd web && bun run test "src/routes/(app)/sampling/SamplingPage.test.ts"
cd web && bun run test
```

Expected: PASS.

- [ ] **Step 11: Verify visually**

```bash
cd web && bun run dev
```

Open `/sampling` wide. Confirm: no "Sample Definition Filename" row in Sample Settings; Sample Settings shows seven fields in two columns (four rows); the definition-file dropdown and Add Config button sit on the right of the "Sample Prompts (n)" heading; and the settings panel and prompt table share the same left and right edges. Narrow below ~900px and confirm the header wraps and the fields collapse to one column.

- [ ] **Step 12: Commit**

```bash
git add modules/webui/schema/builders/sampling.py \
        tests/webui/test_schema_coverage.py \
        tests/webui/test_schema.py \
        "web/src/routes/(app)/sampling/+page.svelte" \
        "web/src/routes/(app)/sampling/SamplingPage.test.ts"
git commit -m "fix(web): drop redundant sample definition field and relocate its picker"
```

---

### Task 8: Remove the duplicated read-only prompt text

**Files:**
- Modify: `web/src/lib/components/sampling/SamplePromptTable.svelte:132`
- Modify: `web/src/lib/components/sampling/SamplePromptCards.svelte:122`
- Modify: `web/src/lib/components/sampling/SamplePromptTable.test.ts`
- Modify: `web/src/lib/components/sampling/SamplePromptCards.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Both components keep their existing prop signatures.

Both components render each prompt twice — a read-only element stacked directly above the bound `TextInput` in the same cell. In `SamplePromptCards` the truncated `<span>` in the *card header* (line 79) is a legitimate card title and must be kept; only the `<p>` in the card *body* (line 122) is the duplicate.

- [ ] **Step 1: Write the failing tests**

In `web/src/lib/components/sampling/SamplePromptTable.test.ts`, add:

```ts
  it('renders each prompt only once, as an editable input', () => {
    render(SamplePromptTable, { samples: sampleData });

    const prompt = 'A cinematic photo of a mountain';
    expect(screen.getByDisplayValue(prompt)).toBeInTheDocument();
    expect(screen.queryByText(prompt)).not.toBeInTheDocument();
  });
```

In `web/src/lib/components/sampling/SamplePromptCards.test.ts`, add:

```ts
  it('renders the prompt body only as an editable input, keeping the card title', () => {
    const { container } = render(SamplePromptCards, { samples: sampleData });

    const prompt = 'A cinematic photo of a mountain';
    expect(screen.getByDisplayValue(prompt)).toBeInTheDocument();

    // The truncated card-header title is intentional; the body copy is not.
    const bodyCopies = Array.from(container.querySelectorAll('p')).filter(
      (el) => el.textContent === prompt
    );
    expect(bodyCopies).toHaveLength(0);
  });
```

- [ ] **Step 2: Run them to verify they fail**

```bash
cd web && bun run test src/lib/components/sampling/SamplePromptTable.test.ts src/lib/components/sampling/SamplePromptCards.test.ts
```

Expected: FAIL — both new tests. `queryByText` finds the `<span>`; the `<p>` filter finds one element.

- [ ] **Step 3: Delete the duplicate in the table**

In `web/src/lib/components/sampling/SamplePromptTable.svelte`, delete line 132:

```svelte
            <span class="text-sm text-foreground">{sample.prompt}</span>
```

The cell becomes:

```svelte
          <Table.Cell class="w-auto p-2">
            <TextInput
              aria-label="Prompt Text"
              class="h-[30px] min-w-0 w-full text-sm px-2"
              bind:value={sample.prompt}
              onChange={(val) => handlePromptChange(index, val)}
            />
          </Table.Cell>
```

No `Table.Head`, column width, or colspan changes — the removed element was stacked inside an existing cell, not a separate column.

- [ ] **Step 4: Delete the duplicate in the cards**

In `web/src/lib/components/sampling/SamplePromptCards.svelte`, delete line 122:

```svelte
            <p class="text-sm text-foreground">{sample.prompt}</p>
```

Keep line 79 (`<span class="text-sm font-medium truncate text-foreground">{sample.prompt}</span>`) — that is the card header title.

- [ ] **Step 5: Run the tests**

```bash
cd web && bun run test src/lib/components/sampling
```

Expected: PASS. The existing `getByDisplayValue` assertions continue to pass because the bound input is untouched.

- [ ] **Step 6: Run the full suite**

```bash
cd web && bun run test
```

Expected: PASS. Watch for `SamplingPage.test.ts` assertions using `getByText` on a prompt string — if any exist, switch them to `getByDisplayValue`.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/sampling/SamplePromptTable.svelte \
        web/src/lib/components/sampling/SamplePromptCards.svelte \
        web/src/lib/components/sampling/SamplePromptTable.test.ts \
        web/src/lib/components/sampling/SamplePromptCards.test.ts
git commit -m "fix(web): render each sample prompt once instead of twice"
```

---

### Task 9: The drift guard

**Files:**
- Create: `web/src/lib/components/layout/layout-boundary.test.ts`
- Delete: `web/src/routes/(app)/RouteContainer.test.ts` (superseded — its per-route allowlists become the general rule)

**Interfaces:**
- Consumes: every migration from Tasks 3-7 must already be complete, or this test fails on landing.
- Produces: three exported predicates — `findHardcodedPageWidth(source, filename): string[]`, `findRoutesMissingRoutePage(source, filename): string[]`, `findFixedControlWidth(source, filename): string[]`.

This lands last, once the violations it detects are already gone. It follows the structure of the existing `style-boundary.test.ts` and `ui-variant-boundary.test.ts`: exported pure predicates, a fixture test per predicate, then a sweep over all sources.

- [ ] **Step 1: Write the test file**

Create `web/src/lib/components/layout/layout-boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const allSources = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The widths that used to be copy-pasted. RoutePage owns them now. */
const OWNED_WIDTHS = ['740px', '900px', '1200px', '1600px'];

/**
 * Vendored shadcn primitives carry their own max-w-* utilities legitimately,
 * and overlay widths are dialog sizing rather than page sizing.
 */
const WIDTH_EXEMPT = [
  '/src/lib/components/ui/',
  '/src/lib/components/overlays/',
];

/**
 * A full-height terminal pane, not a scrolling document. A max-width would be
 * wrong for it, so it is the one route that owns its own container.
 */
const ROUTE_PAGE_EXEMPT = ['/src/routes/(app)/console/+page.svelte'];

export function findHardcodedPageWidth(source: string, filename: string): string[] {
  if (WIDTH_EXEMPT.some((prefix) => filename.startsWith(prefix))) return [];

  const violations: string[] = [];
  const widths = OWNED_WIDTHS.join('|');
  // CSS declarations: `max-width: 740px`, `width:1600px`, `min-width : 900px`
  const cssDecl = new RegExp(`(?:max-|min-)?width\\s*:\\s*(?:${widths})`, 'g');
  // Tailwind arbitrary utilities: `w-[740px]`, `max-w-[1600px]`, `min-w-[900px]`
  const twUtil = new RegExp(`(?:max-|min-)?w-\\[(?:${widths})\\]`, 'g');

  source.split('\n').forEach((line, i) => {
    // A breakpoint is not a page width. `@media (max-width: 900px)` and
    // `@container (min-width: 900px)` are legitimate uses of these numbers.
    if (line.includes('@media') || line.includes('@container')) return;

    for (const pattern of [cssDecl, twUtil]) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (match) {
        violations.push(
          `${filename}:${i + 1}: "${match[0]}" — page width belongs to RoutePage / --width-page`
        );
      }
    }
  });
  return violations;
}

export function findRoutesMissingRoutePage(source: string, filename: string): string[] {
  if (!filename.startsWith('/src/routes/(app)/')) return [];
  if (!filename.endsWith('/+page.svelte')) return [];
  if (ROUTE_PAGE_EXEMPT.includes(filename)) return [];
  if (source.includes('RoutePage')) return [];
  return [`${filename}: route must wrap its content in RoutePage`];
}

export function findFixedControlWidth(source: string, filename: string): string[] {
  if (!filename.startsWith('/src/lib/components/form/')) return [];

  const violations: string[] = [];
  source.split('\n').forEach((line, i) => {
    if (/flex:\s*0\s+0\s+\d+px/.test(line)) {
      violations.push(
        `${filename}:${i + 1}: fixed control basis — use var(--width-field-control)`
      );
    }
  });
  return violations;
}

describe('layout boundary', () => {
  it('flags a hardcoded CSS width in fixture source', () => {
    expect(findHardcodedPageWidth('  width: 740px;', '/src/x.svelte')).toHaveLength(1);
  });

  it('flags a hardcoded Tailwind width utility in fixture source', () => {
    expect(
      findHardcodedPageWidth('<div class="max-w-[1600px] w-full">', '/src/x.svelte')
    ).toHaveLength(1);
  });

  it('allows breakpoints that happen to use an owned number', () => {
    expect(
      findHardcodedPageWidth('  @media (max-width: 900px) {', '/src/x.svelte')
    ).toEqual([]);
    expect(
      findHardcodedPageWidth('  @container (min-width: 900px) {', '/src/x.svelte')
    ).toEqual([]);
  });

  it('ignores unrelated dimensions that merely share a number', () => {
    expect(findHardcodedPageWidth('  height: 740px;', '/src/x.svelte')).toEqual([]);
    expect(findHardcodedPageWidth('<Skeleton class="h-[900px]" />', '/src/x.svelte')).toEqual([]);
  });

  it('exempts vendored ui primitives and overlays', () => {
    expect(
      findHardcodedPageWidth('  max-width: 900px;', '/src/lib/components/ui/card/card.svelte')
    ).toEqual([]);
    expect(
      findHardcodedPageWidth('class="max-w-[740px]"', '/src/lib/components/overlays/x.svelte')
    ).toEqual([]);
  });

  it('flags an app route that does not use RoutePage', () => {
    expect(
      findRoutesMissingRoutePage('<div class="p-6">x</div>', '/src/routes/(app)/foo/+page.svelte')
    ).toHaveLength(1);
  });

  it('exempts the console route and non-route files', () => {
    expect(
      findRoutesMissingRoutePage('<div>x</div>', '/src/routes/(app)/console/+page.svelte')
    ).toEqual([]);
    expect(
      findRoutesMissingRoutePage('<div>x</div>', '/src/lib/components/shell/Header.svelte')
    ).toEqual([]);
  });

  it('flags a fixed control basis in a form component', () => {
    expect(
      findFixedControlWidth('    flex: 0 0 420px;', '/src/lib/components/form/Field.svelte')
    ).toHaveLength(1);
  });

  it('allows the token-driven flexible basis', () => {
    expect(
      findFixedControlWidth(
        '    flex: 0 1 var(--width-field-control);',
        '/src/lib/components/form/Field.svelte'
      )
    ).toEqual([]);
  });

  it('has no hardcoded page widths anywhere in the application', () => {
    const violations = Object.entries(allSources).flatMap(([file, source]) =>
      findHardcodedPageWidth(source, file)
    );
    expect(violations).toEqual([]);
  });

  it('has every app route wrapped in RoutePage', () => {
    const violations = Object.entries(allSources).flatMap(([file, source]) =>
      findRoutesMissingRoutePage(source, file)
    );
    expect(violations).toEqual([]);
  });

  it('has no fixed control widths in form components', () => {
    const violations = Object.entries(allSources).flatMap(([file, source]) =>
      findFixedControlWidth(source, file)
    );
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd web && bun run test src/lib/components/layout/layout-boundary.test.ts
```

Expected: PASS if Tasks 3-7 are complete. If the three sweep tests fail, the failure message names the exact file and line — fix each one rather than widening an exemption list. Two known candidates to check, since they were not covered by earlier tasks:

- `src/lib/components/loading/FormPageSkeleton.svelte` — has `padding: 1.5rem` but no width, so it should pass.
- `src/routes/login/+page.svelte` — outside `(app)`, so the RoutePage rule does not apply; check it for an `OWNED_WIDTHS` value and remove it if present.

- [ ] **Step 3: Delete the superseded per-task test**

```bash
rm "web/src/routes/(app)/RouteContainer.test.ts"
```

Its per-route allowlists are now the general rule enforced by `findRoutesMissingRoutePage` and `findHardcodedPageWidth`, so keeping it duplicates coverage that would drift out of sync as routes are added.

- [ ] **Step 4: Prove the guard actually catches drift**

Temporarily add a violating line to `web/src/routes/(app)/general/+page.svelte`'s `<style>` block:

```css
  .general-tab-container { max-width: 740px; }
```

Run:

```bash
cd web && bun run test src/lib/components/layout/layout-boundary.test.ts
```

Expected: FAIL, naming `general/+page.svelte` and the line number. Revert the line and re-run to confirm PASS. Do not commit the temporary violation.

- [ ] **Step 5: Run everything**

```bash
cd web && bun run test
cd web && bun run check
cd web && bun run e2e
pytest tests/webui -q
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/components/layout/layout-boundary.test.ts
git rm "web/src/routes/(app)/RouteContainer.test.ts"
git commit -m "test(web): fail the suite on hardcoded page widths and unwrapped routes"
```

---

## Verification checklist

Run after Task 9, at a browser width above 1600px and again at 1000px and 500px:

- [ ] `/general`, `/model`, `/backup`, `/lora`, `/sampling`, `/embeddings` — panels span the content area up to 1600px, fields in two columns
- [ ] `/training` — three-column panel grid preserved; fields inside each panel single-column
- [ ] `/live`, `/gallery` — visually identical to before this change
- [ ] `/sampling` — no "Sample Definition Filename" field; picker sits in the Sample Prompts header; each prompt appears once
- [ ] `/embeddings` — warning, params panel, and Additional Embeddings list share left and right edges
- [ ] `/secrets` — two cards side by side wide, stacked narrow
- [ ] `/console` — unchanged full-height terminal pane
- [ ] At 500px every route is single-column with no horizontal scrollbar
