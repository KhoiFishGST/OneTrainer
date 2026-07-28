# shadcn-svelte UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace OneTrainer's hand-rolled web presentation layer with a canonical shadcn-svelte foundation, OneTrainer light/dark themes, and verified desktop/phone responsive behavior in one app-wide cutover.

**Architecture:** Commit canonical shadcn source under `web/src/lib/components/ui/`, keep domain behavior in focused application composites, and keep query/mutation orchestration in routes. Work packages are independently tested and reviewed, but only the completed migration is releasable; compatibility wrappers and old primitives are removed before acceptance.

**Tech Stack:** Svelte 5, SvelteKit 2 static SPA, TypeScript, Tailwind CSS, shadcn-svelte, Bits UI registry dependencies, TanStack Svelte Query, Vitest, Testing Library, Playwright, axe-core, Bun.

## Global Constraints

- The phone/desktop interaction breakpoint is exactly `768px`: phone is below 768px; desktop is 768px and above.
- Playwright phone acceptance uses iPhone 13 at `390x844`; desktop acceptance uses Desktop Chrome at `1280x720`.
- Phone controls are at least `44px`; desktop controls default to `36px`.
- Use Inter with system sans-serif fallback, 14px application text, 12px metadata, 6px control radii, 8px card radii, and 12px overlay radii.
- Dark tokens start from background `#0c1118`, card `#151c24`, popover `#18212b`, foreground `#e8edf2`, muted foreground `#8d99a6`, border/input `#2b3948`, primary `#3b82f6`, ring `#60a5fa`.
- Light tokens start from background `#f5f7fa`, card/popover `#ffffff`, foreground `#17202a`, muted foreground `#657384`, border/input `#d6dee8`, primary/ring `#2563eb`.
- Preserve route URLs, backend payloads, stored configuration formats, application capabilities, value conversion, callback timing, disabled conditions, and mutation ordering.
- Preserve storage keys `webui.railExpanded`, `console_drawer_open`, and `console_drawer_height`; add `webui.theme` with `dark | light`, defaulting to dark.
- Native `button`, `input`, `select`, `option`, and `textarea` elements may exist only below `web/src/lib/components/ui/`.
- Files below `web/src/lib/components/ui/` may not import API, route, store, shell, form, or domain modules.
- Ordinary plain value/label choices use Native Select. Do not add headless Select or Combobox without a concrete rich, grouped, or searchable consumer.
- Ordinary editors use Dialog at desktop and Drawer on phone. The directory browser uses Dialog at desktop and full-screen Sheet on phone. Destructive confirmations use Alert Dialog.
- Failed submissions keep overlays open and preserve drafts. Pending destructive actions cannot submit twice.
- Do not replace uPlot or move schema interpretation, remote traversal, API operations, query state, or payload construction into canonical UI files.
- Do not release any intermediate mixed-system checkpoint.

## Migration Inventory

Every production component and route has one final disposition:

| Disposition | Existing files |
| --- | --- |
| Replace and delete | `components/ui/Button.svelte`, `ModalDialog.svelte`, `Alert.svelte`, `Toast.svelte`, `TabBar.svelte`, `Skeleton.svelte`, `AddCard.svelte`, `CompoundsTestWrapper.svelte`; `components/form/TextInput.svelte`, `TextArea.svelte`, `Checkbox.svelte`, `Toggle.svelte`, `Select.svelte`, `RangeInput.svelte`, `FileInput.svelte`, `SectionDivider.svelte` |
| Move and rebuild as focused composites | `components/ui/PageHeader.svelte` -> `components/layout/PageHeader.svelte`; `components/ui/FormPageSkeleton.svelte` -> `components/loading/FormPageSkeleton.svelte`; `components/form/NumberInput.svelte` -> `components/form/NumericDraftInput.svelte` |
| Retain behavior, rebuild presentation | `LayoutContent.svelte`; all remaining files under `components/form/`, `shell/`, `directory/`, `console/`, `charts/`, `concepts/`, `datasets/`, `embeddings/`, `sampling/`, and `training/` |
| Update test wrappers | `LayoutContentTestWrapper.svelte`, `shell/HeaderTestWrapper.svelte`; delete `shell/StatusBarTestWrapper.svelte` if the migrated component has no provider requirement |
| Retain route behavior, rebuild presentation | `routes/+layout.svelte`, `login`, `general`, `model`, `lora`, `embeddings`, `datasets`, `datasets/[id]`, `concepts`, `training`, `sampling`, `backup`, `live`, `gallery`, `secrets`, and `console` page components |
| Keep redirects/load modules | `routes/+page.ts`, `+layout.ts`, `data/+page.ts`, `lora-embedding/+page.ts`, `datasets/[id]/+page.ts` |

## Planned File Structure

```text
web/
  components.json
  src/
    app.css
    app.html
    lib/
      utils.ts
      hooks/is-mobile.svelte.ts
      stores/theme.svelte.ts
      components/
        ui/<registry component>/
        ui/file-input/file-input.svelte
        overlays/ResponsiveDialogDrawer.svelte
        overlays/ResponsiveDialogSheet.svelte
        layout/PageHeader.svelte
        loading/FormPageSkeleton.svelte
        collections/AddItemCard.svelte
        form/NumericDraftInput.svelte
        form/ValueSelect.svelte
        shell/ThemeToggle.svelte
```

Canonical `ui/` owns generic interaction and native elements. `overlays/`, `layout/`, `loading/`, `collections/`, `form/`, `shell/`, and domain directories own OneTrainer contracts and composition.

---

### Task 1: Tailwind, Tokens, And Theme State

**Files:**
- Create: `web/components.json`
- Create: `web/src/lib/utils.ts`
- Create: `web/src/lib/stores/theme.svelte.ts`
- Create: `web/src/lib/stores/theme.test.ts`
- Modify: `web/package.json`
- Modify: `web/bun.lock`
- Modify: `web/vite.config.ts`
- Modify: `web/src/app.css`
- Modify: `web/src/app.html`

**Interfaces:**
- Produces: `type Theme = 'dark' | 'light'` and `theme` with reactive `value`, `set(value)`, and `toggle()`.
- Produces: `cn(...inputs: ClassValue[]): string` for canonical shadcn source.
- Preserves: dark first paint when `webui.theme` is absent or invalid.

- [x] **Step 1: Write failing theme-store tests**

Create `web/src/lib/stores/theme.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    vi.resetModules();
  });

  it('defaults to dark and applies the root class', async () => {
    const { theme } = await import('./theme.svelte');
    expect(theme.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists and applies an explicit light choice', async () => {
    const { theme } = await import('./theme.svelte');
    theme.set('light');
    expect(localStorage.getItem('webui.theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('ignores an invalid stored choice', async () => {
    localStorage.setItem('webui.theme', 'system');
    const { theme } = await import('./theme.svelte');
    expect(theme.value).toBe('dark');
  });
});
```

- [x] **Step 2: Run the theme test and verify it fails**

Run: `bun run test -- src/lib/stores/theme.test.ts`

Expected: FAIL because `theme.svelte.ts` does not exist.

- [x] **Step 3: Install and configure the styling foundation**

From `web/`, initialize Tailwind for the existing SvelteKit project and shadcn-svelte with these answers:

```text
global CSS: src/app.css
base color: Slate
CSS variables: yes
lib alias: $lib
components alias: $lib/components
utils alias: $lib/utils
hooks alias: $lib/hooks
ui alias: $lib/components/ui
```

Use the current CLI commands:

```bash
bunx sv add tailwindcss
bunx shadcn-svelte@latest init
bun add -d @axe-core/playwright
```

Review generated changes before continuing. Preserve the static adapter, proxy, Vitest conditions, existing favicon declarations, and existing global safe-area/reduced-motion rules.

- [x] **Step 4: Implement deterministic theme state**

Create `web/src/lib/stores/theme.svelte.ts`:

```ts
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'webui.theme';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(value: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', value === 'dark');
  document.documentElement.style.colorScheme = value;
}

let value = $state<Theme>(readTheme());
applyTheme(value);

export const theme = {
  get value(): Theme {
    return value;
  },
  set(next: Theme): void {
    value = next;
    if (typeof window !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  },
  toggle(): void {
    this.set(value === 'dark' ? 'light' : 'dark');
  },
};
```

Create `web/src/lib/utils.ts` using the shadcn-generated `clsx` and `tailwind-merge` helper. Add this inline script before `%sveltekit.head%` in `web/src/app.html` so first paint matches the stored theme:

```html
<script>
  (() => {
    const value = localStorage.getItem('webui.theme');
    const theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  })();
</script>
```

- [x] **Step 5: Replace generated stock tokens with approved OneTrainer tokens**

In `web/src/app.css`, retain Tailwind imports and define semantic light tokens on `:root` and dark tokens on `.dark`. Set `--radius: 0.5rem`, 14px body text, Inter fallback, 36px desktop control variables, reduced-motion overrides, safe-area utility, full-height shell behavior, and the approved palette from Global Constraints. Add this phone rule:

```css
@media (max-width: 767px) {
  :root { --control-height: 2.75rem; }
  button, input, select, textarea, [role='button'] { min-height: 44px; }
}
```

- [x] **Step 6: Run focused and global foundation checks**

Run:

```bash
bun run test -- src/lib/stores/theme.test.ts
bun run check
bun run build
```

Expected: theme tests PASS, Svelte check reports no new errors, production build PASS.

- [x] **Step 7: Commit the foundation**

```bash
git add web/package.json web/bun.lock web/components.json web/vite.config.ts web/src/app.css web/src/app.html web/src/lib/utils.ts web/src/lib/stores/theme.svelte.ts web/src/lib/stores/theme.test.ts
git commit -m "feat(web): add shadcn theme foundation"
```

### Task 2: Canonical Controls And Source Boundaries

**Files:**
- Create: `web/src/lib/components/ui/{button,input,textarea,checkbox,switch,native-select,slider}/**`
- Create: `web/src/lib/components/ui/file-input/file-input.svelte`
- Create: `web/src/lib/components/ui/file-input/index.ts`
- Create: `web/src/lib/components/form/NumericDraftInput.svelte`
- Create: `web/src/lib/components/form/NumericDraftInput.test.ts`
- Create: `web/src/lib/components/form/ValueSelect.svelte`
- Create: `web/src/lib/components/form/ValueSelect.test.ts`
- Create: `web/src/lib/components/ui-dependency-boundary.test.ts`
- Modify: `web/src/lib/components/native-control-boundary.test.ts`
- Modify: `web/src/lib/components/form/FormInputs.test.ts`

**Interfaces:**
- Produces: canonical registry exports for Button, Input, Textarea, Checkbox, Switch, Native Select, and Slider.
- Produces: `FileInput` accepting native input attributes, `onChange?: (files: FileList | null) => void`, and exported `open(): void`.
- Produces: `NumericDraftInput` accepting `value: string | number`, standard numeric constraints, and `onInput?: (draft: string) => void`.
- Produces: `ValueSelect<T>` accepting `value: T`, `options: Array<T | { value: T; label: string }>`, and `onChange?: (value: T) => void`; it composes Native Select and maps serialized option IDs back to the original typed value.

- [x] **Step 1: Rewrite boundary tests to express the target architecture**

Keep the existing Svelte AST walker, replace the filename allowlist with:

```ts
const uiRoot = '/src/lib/components/ui/';

it('allows native controls only in canonical UI source', () => {
  const violations = Object.entries(sources).flatMap(([file, source]) =>
    file.startsWith(uiRoot) ? [] : findNative(source, file)
  );
  expect(violations).toEqual([]);
});
```

Create `ui-dependency-boundary.test.ts` using `import.meta.glob('/src/lib/components/ui/**/*.{svelte,ts}', { query: '?raw', import: 'default', eager: true })`. Parse static imports and fail imports containing `/api/`, `/routes/`, `/stores/`, `/shell/`, `/form/`, `/directory/`, `/concepts/`, `/datasets/`, `/sampling/`, `/training/`, `/embeddings/`, `/console/`, or `/charts/`. Include one fixture assertion proving `$lib/api/client` is rejected.

- [x] **Step 2: Run boundary tests and verify target failures**

Run: `bun run test -- src/lib/components/native-control-boundary.test.ts src/lib/components/ui-dependency-boundary.test.ts`

Expected: FAIL because legacy native controls remain outside `components/ui/` and the new dependency test file initially has no implementation.

- [x] **Step 3: Add only the canonical controls with current consumers**

Run from `web/`:

```bash
bunx shadcn-svelte@latest add button input textarea checkbox switch native-select slider
```

Do not add Select or Combobox. Review generated files for Svelte 5 syntax and preserve generated accessibility behavior.

- [x] **Step 4: Add the canonical file input and numeric-draft adapter**

Move the old imperative file contract into `ui/file-input/file-input.svelte`; it is the only canonical native file control. Build `NumericDraftInput.svelte` by composing canonical Input with `type="number"`, forwarding `min`, `max`, `step`, ARIA attributes, and emitting `event.currentTarget.value` without parsing.

Build `ValueSelect.svelte` by assigning each option a stable index string for the native value. On change, parse the selected index and return `options[index].value` or the primitive option itself. Compare selection using the current compatible `String(optionValue) === String(value)` rule so existing loaded configuration selects correctly. Forward `id`, `name`, placeholder, disabled, required, `aria-describedby`, blur, and keydown behavior.

Add tests covering drafts `''`, `'-'`, `'1.'`, and `'1e'`, and file input `FileList | null` plus imperative `open()`.

- [x] **Step 5: Migrate leaf-control consumers without changing composites**

Update current imports across `components/form/`, shell, and domain files to canonical controls, `NumericDraftInput`, or `ValueSelect`. Preserve the contracts listed in Global Constraints. `ValueSelect` must return the original application value, not only the serialized DOM string.

Delete legacy leaf files only after `grep` shows no imports:

```text
TextInput.svelte TextArea.svelte Checkbox.svelte Toggle.svelte
Select.svelte RangeInput.svelte FileInput.svelte NumberInput.svelte
```

- [x] **Step 6: Run control and boundary tests**

Run:

```bash
bun run test -- src/lib/components/form/FormInputs.test.ts src/lib/components/form/NumericDraftInput.test.ts src/lib/components/form/ValueSelect.test.ts src/lib/components/form/FileRangeSelect.test.ts src/lib/components/native-control-boundary.test.ts src/lib/components/ui-dependency-boundary.test.ts
bun run check
```

Expected: all listed tests PASS and no production Svelte file outside `components/ui/` owns a native control.

- [x] **Step 7: Commit canonical controls**

```bash
git add web/src/lib/components web/src/lib/utils.ts
git commit -m "refactor(web): adopt canonical shadcn controls"
```

### Task 3: Overlay, Feedback, And Shared Composition Foundation

**Files:**
- Create: `web/src/lib/components/ui/{dialog,drawer,sheet,alert-dialog,alert,card,skeleton,sonner,badge,tooltip,empty,tabs,separator,scroll-area,table,dropdown-menu}/**`
- Create: `web/src/lib/hooks/is-mobile.svelte.ts`
- Create: `web/src/lib/components/overlays/ResponsiveDialogDrawer.svelte`
- Create: `web/src/lib/components/overlays/ResponsiveDialogDrawer.test.ts`
- Create: `web/src/lib/components/overlays/ResponsiveDialogSheet.svelte`
- Create: `web/src/lib/components/overlays/ResponsiveDialogSheet.test.ts`
- Create: `web/src/lib/components/layout/PageHeader.svelte`
- Create: `web/src/lib/components/loading/FormPageSkeleton.svelte`
- Create: `web/src/lib/components/collections/AddItemCard.svelte`
- Modify: `web/src/routes/+layout.svelte`

**Interfaces:**
- Produces: `isMobile.current: boolean` based on `(max-width: 767px)`.
- Produces: responsive overlay composites with `open`, `onOpenChange`, title, description, content snippet, and footer snippet; one branch is mounted at a time.
- Produces: global Sonner Toaster in `+layout.svelte`.

- [x] **Step 1: Write failing responsive-overlay tests**

Mock `window.matchMedia`. Assert `ResponsiveDialogDrawer` renders role `dialog` in both modes, renders only one branch, calls `onOpenChange(false)` once on Escape, keeps supplied child draft state across parent rerenders, and restores trigger focus. Repeat for Dialog/Sheet and assert phone content carries a full-screen class.

- [x] **Step 2: Run the overlay tests and verify they fail**

Run: `bun run test -- src/lib/components/overlays`

Expected: FAIL because responsive composites do not exist.

- [x] **Step 3: Add the required registry components**

Run:

```bash
bunx shadcn-svelte@latest add dialog drawer sheet alert-dialog alert card skeleton sonner badge tooltip empty tabs separator scroll-area table dropdown-menu
```

Keep generated generic source domain-free. Add `is-mobile.svelte.ts` with one reactive media-query object shared by Sidebar and responsive overlays.

- [x] **Step 4: Implement responsive overlay compositions**

Render Dialog when `isMobile.current` is false and Drawer or Sheet when true. The parent owns `open` and draft data; the composition only translates `onOpenChange`. Use identical title/description IDs and content snippets in either branch. Full-screen phone Sheet uses `inset: 0`, `width: 100%`, `height: 100dvh`, and safe-area padding.

- [x] **Step 5: Move repeated application compounds out of canonical UI**

Move and restyle `PageHeader` and `FormPageSkeleton` under their focused directories. Replace `AddCard` with `AddItemCard` under `collections/`. Preserve semantic heading levels, optional descriptions/actions, skeleton status semantics, and accessible add-action naming. Add Toaster once in `routes/+layout.svelte`.

- [x] **Step 6: Run overlay and compound tests**

Run:

```bash
bun run test -- src/lib/components/overlays src/lib/components/ui/Compounds.test.ts src/lib/components/ui/AddCard.test.ts
bun run check
bun run build
```

Expected: responsive tests PASS; rewritten compound behavior tests PASS; build PASS.

- [x] **Step 7: Commit shared compositions**

```bash
git add web/src/lib/components web/src/lib/hooks web/src/routes/+layout.svelte web/package.json web/bun.lock
git commit -m "feat(web): add shadcn overlay compositions"
```

### Task 4: Schema Forms And Specialized Editors

**Files:**
- Modify: `web/src/lib/components/form/Field.svelte`
- Modify: `web/src/lib/components/form/FormPanel.svelte`
- Modify: `web/src/lib/components/form/SchemaForm.svelte`
- Modify: `web/src/lib/components/form/DirectoryInput.svelte`
- Modify: `web/src/lib/components/form/PathInput.svelte`
- Modify: `web/src/lib/components/form/TimeInput.svelte`
- Modify: `web/src/lib/components/form/OptimizerSchedulerModal.svelte`
- Modify: `web/src/lib/components/form/OptimizerParamsModal.svelte`
- Modify: `web/src/lib/components/form/SchedulerParamsModal.svelte`
- Modify: corresponding tests under `web/src/lib/components/form/`
- Delete: `web/src/lib/components/form/SectionDivider.svelte`

**Interfaces:**
- Preserves: `Field` child metadata `{ id: 'field-' + id, ariaDescribedBy }` and label, tooltip, error, inline, full-width behavior.
- Preserves: `SchemaForm` `tab`, values, issues, `setRaw(path, value)`, directory callback, subtab, group-title, and optimizer/scheduler callbacks.
- Preserves: closed-to-open draft initialization and apply-only normalization in specialized dialogs.

- [x] **Step 1: Add failing behavior assertions before changing forms**

Extend existing tests to cover accessible description IDs, plain-option Native Select value mapping, empty and partial numeric drafts, multi-key time values, hidden group titles, optimizer/scheduler draft reset only on closed-to-open, and failed async apply retaining open state and draft.

- [x] **Step 2: Run form tests and record the target failures**

Run:

```bash
bun run test -- src/lib/components/form/SchemaForm.test.ts src/lib/components/form/FormInputs.test.ts src/lib/components/form/PathInput.test.ts src/lib/components/form/OptimizerParamsModal.test.ts src/lib/components/form/OptimizerSchedulerModal.test.ts
```

Expected: new shadcn-specific role and failure-retention assertions FAIL before migration.

- [x] **Step 3: Rebuild field and panel composition**

Use canonical Label support where generated, Tooltip for delayed help, Alert-style field errors, Card or bordered sections for `FormPanel`, and Separator plus local headings instead of `SectionDivider`. Keep schema grouping and field-path logic unchanged. Apply one-column phone grids below 768px and retain existing wider content breakpoints.

- [x] **Step 4: Rebuild specialized input adapters**

Compose Input, Native Select, Button, and responsive overlays. Preserve external versus context directory ownership, `PathInput` bindable value synchronization, time value/unit callbacks, and all existing ARIA IDs. Do not parse partial drafts until the application save boundary.

- [x] **Step 5: Rebuild optimizer and scheduler editors**

Use `ResponsiveDialogDrawer`, canonical controls, Alert for persistent errors, and Button pending states. Initialize a deep draft once when opening. Await apply callbacks before closing; catch failures only to preserve state while leaving error derivation to the owning route/composite.

- [x] **Step 6: Run all form tests and schema route smoke tests**

Run:

```bash
bun run test -- src/lib/components/form src/routes/general/page.test.ts src/routes/model/page.test.ts src/routes/lora/page.test.ts src/routes/training/page.test.ts
bun run check
```

Expected: all form and schema route tests PASS.

- [x] **Step 7: Commit the form system**

```bash
git add web/src/lib/components/form web/src/routes/general web/src/routes/model web/src/routes/lora web/src/routes/training
git commit -m "refactor(web): rebuild schema forms with shadcn"
```

### Task 5: Responsive Application Shell

**Files:**
- Create: `web/src/lib/components/ui/sidebar/**`
- Create: `web/src/lib/components/shell/ThemeToggle.svelte`
- Create: `web/src/lib/components/shell/ThemeToggle.test.ts`
- Modify: `web/src/lib/components/LayoutContent.svelte`
- Modify: `web/src/lib/components/LayoutContentTestWrapper.svelte`
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Modify: `web/src/lib/components/shell/Header.svelte`
- Modify: `web/src/lib/components/shell/HeaderTestWrapper.svelte`
- Modify: `web/src/lib/components/shell/StatusBar.svelte`
- Modify: `web/src/lib/components/shell/ConsoleDrawer.svelte`
- Modify: `web/src/lib/components/shell/ErrorBanner.svelte`
- Modify: all corresponding shell tests

**Interfaces:**
- Preserves: `LayoutContent` ownership of queries, workspace context, EventClient, global directory picker, and console visibility.
- Preserves: rail routes, active state, disabled `/tools`, console action, and persistence keys.
- Produces: `ThemeToggle` with accessible label `Switch to light theme` or `Switch to dark theme`.

- [x] **Step 1: Extend shell tests for responsive and persisted behavior**

Add assertions for `webui.railExpanded`, ephemeral phone navigation state, `console_drawer_open`, `console_drawer_height`, 100px/80vh resize limits, keyboard resize, all StatusBar actions, theme labels, and header action reachability at 390px.

- [x] **Step 2: Run shell tests and verify migration assertions fail**

Run: `bun run test -- src/lib/components/LayoutContent.test.ts src/lib/components/shell`

Expected: Sidebar and ThemeToggle assertions FAIL.

- [x] **Step 3: Add and configure Sidebar**

Run: `bunx shadcn-svelte@latest add sidebar`

Set desktop width variables to the current compact/expanded behavior and mobile breakpoint to 768px. Use one route data source for desktop and mobile menu rendering. Persist only desktop expansion in `webui.railExpanded`; never persist mobile open state.

- [x] **Step 4: Rebuild Header, StatusBar, and feedback**

Compose Button, Native Select, Dropdown Menu, Tooltip, Badge, Alert, and ThemeToggle. Preserve Header's injectable test props and preset/model/method ordering. Preserve save-before-preset, conflict/reload/retry/overwrite behavior. Convert gallery warning and transient operation notices to Sonner; persistent API connection failure remains Alert.

- [x] **Step 5: Rebuild console shell integration**

Preserve `ConsoleDrawer` resizing, storage keys, child override, close behavior, and exclusion from `/console`. Keep actions reachable in the Sidebar/header phone layout. Centralize shell z-index roles for header, sidebar, console, popovers, and overlays.

- [x] **Step 6: Run shell tests and build**

Run:

```bash
bun run test -- src/lib/components/LayoutContent.test.ts src/lib/components/shell
bun run check
bun run build
```

Expected: shell tests PASS, no new check errors, build PASS.

- [x] **Step 7: Commit the shell**

```bash
git add web/src/lib/components/LayoutContent.svelte web/src/lib/components/LayoutContentTestWrapper.svelte web/src/lib/components/shell web/src/lib/components/ui/sidebar
git commit -m "refactor(web): rebuild responsive app shell"
```

### Task 6: Directory, Console, And Chart Workflows

**Files:**
- Modify: `web/src/lib/components/directory/DirectoryPicker.svelte`
- Modify: `web/src/lib/components/directory/DirectoryPicker.test.ts`
- Modify: `web/src/lib/components/console/ConsoleView.svelte`
- Modify: `web/src/lib/components/console/ConsoleView.test.ts`
- Modify: `web/src/lib/components/charts/MetricsChart.svelte`
- Modify: `web/src/lib/components/charts/MetricsChart.test.ts`

**Interfaces:**
- Preserves: directory `open`, initial path, `dir | file | both`, extensions, injectable list, select, and close callbacks.
- Preserves: ConsoleStore channel/filter/ANSI/virtualization contracts.
- Preserves: uPlot lifecycle, EMA, log scale, resize, and metric filtering.

- [x] **Step 1: Add failing directory phone and error-state tests**

Assert Dialog at 1280px, full-screen Sheet at 390px, one active focus trap, Windows/POSIX breadcrumbs, root/parent navigation, typed-path Enter, file-only selection, API/truncation Alerts, focus restoration, and `onSelect(path)` before `onClose()`.

- [x] **Step 2: Run focused tests and verify target failures**

Run: `bun run test -- src/lib/components/directory src/lib/components/console src/lib/components/charts`

Expected: role/presentation assertions FAIL before migration.

- [x] **Step 3: Rebuild DirectoryPicker presentation**

Use `ResponsiveDialogSheet`, Scroll Area, Breadcrumb-style local composition, Input, Native Select where needed, Button, Alert, Skeleton, and Empty. Retain traversal and path logic intact. Keep the phone action bar safe-area padded and keep selection visible without horizontal page overflow.

- [x] **Step 4: Rebuild ConsoleView and MetricsChart controls**

Use Input, Switch or Checkbox, Native Select, Scroll Area, Button, Badge, Tooltip, and Slider. Do not change virtualization, ANSI allowlist, channel semantics, uPlot ownership, EMA, or normalization. Keep chart controls 44px on phone without changing emitted smoothing values.

- [x] **Step 5: Run focused tests and commit**

Run:

```bash
bun run test -- src/lib/components/directory src/lib/components/console src/lib/components/charts
bun run check
```

Expected: all focused tests PASS.

```bash
git add web/src/lib/components/directory web/src/lib/components/console web/src/lib/components/charts
git commit -m "refactor(web): migrate directory and monitoring views"
```

### Task 7: Concepts And Embeddings

**Files:**
- Modify: `web/src/lib/components/concepts/ConceptsEditor.svelte`
- Modify: `web/src/lib/components/concepts/ConceptDetailModal.svelte`
- Create: `web/src/lib/components/concepts/ConceptGeneralFields.svelte`
- Create: `web/src/lib/components/concepts/ConceptImageFields.svelte`
- Create: `web/src/lib/components/concepts/ConceptTextFields.svelte`
- Create: `web/src/lib/components/concepts/ConceptStatsPanel.svelte`
- Create: `web/src/lib/components/concepts/AugmentationPreview.svelte`
- Modify: `web/src/lib/components/embeddings/EmbeddingCard.svelte`
- Modify: corresponding component tests
- Create: `web/src/routes/concepts/page.test.ts`
- Modify: `web/src/routes/concepts/+page.svelte`
- Modify: `web/src/routes/embeddings/+page.svelte`
- Modify: `web/src/routes/embeddings/page.test.ts`

**Interfaces:**
- Preserves: concept bindable values, original-index callbacks, deep draft, defaults, stats/preview APIs, and one-second debounced save.
- Preserves: embedding bindable item, index-based remove/clone, enable state, numeric defaults, and directory callback.

- [x] **Step 1: Add route and modal failure-retention tests**

Cover concept add/clone/filter/index mapping, one-second debounced save, deep draft isolation, close without save, failed preview/stat requests, failed save retaining the Drawer/Dialog draft, embedding clone/remove indices, and support gating.

- [x] **Step 2: Run concept and embedding tests to establish failures**

Run: `bun run test -- src/lib/components/concepts src/lib/components/embeddings src/routes/concepts src/routes/embeddings`

Expected: new responsive overlay, shadcn role, and failure-retention assertions FAIL.

- [x] **Step 3: Rebuild concept collection and detail editing**

Use Cards/Tables, Tabs, Badge, Dropdown Menu, Alert Dialog, responsive Dialog/Drawer, Scroll Area, Empty, and Skeleton. Split `ConceptDetailModal.svelte` only along the field/preview/stat boundaries listed above; keep the parent as draft and save coordinator. Phone collection uses cards driven by the same source array and callbacks as desktop.

- [x] **Step 4: Rebuild embedding cards and route presentation**

Use Card, Switch, NumericDraftInput, Input, directory Button, Tooltip, and Alert Dialog. Preserve all payload values and indices. Replace route loading and empty states with shared Skeleton/Empty compositions.

- [x] **Step 5: Run tests and commit**

Run:

```bash
bun run test -- src/lib/components/concepts src/lib/components/embeddings src/routes/concepts src/routes/embeddings
bun run check
```

Expected: all listed tests PASS.

```bash
git add web/src/lib/components/concepts web/src/lib/components/embeddings web/src/routes/concepts web/src/routes/embeddings
git commit -m "refactor(web): migrate concepts and embeddings views"
```

### Task 8: Datasets And Sampling

**Files:**
- Create: `web/src/lib/components/datasets/DatasetCollection.svelte`
- Create: `web/src/lib/components/datasets/DatasetFileCard.svelte`
- Modify: `web/src/lib/components/datasets/DatasetPickerModal.svelte`
- Modify: `web/src/lib/components/sampling/SamplePromptTable.svelte`
- Create: `web/src/lib/components/sampling/SamplePromptCards.svelte`
- Modify: `web/src/lib/components/sampling/SampleDetailModal.svelte`
- Modify: corresponding component tests
- Modify: `web/src/routes/datasets/+page.svelte`
- Modify: `web/src/routes/datasets/[id]/+page.svelte`
- Modify: dataset route tests
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/sampling/SamplingPage.test.ts`

**Interfaces:**
- Preserves: dataset base-directory flush, CRUD, upload FormData, drag/drop, caption blur, image viewing, and picker preselection/double-click.
- Preserves: sampling original indices, full updated objects, fallback width/height `512`, seed `-1`, and save-time numeric normalization.

- [x] **Step 1: Add destructive, responsive collection, and failed-save tests**

Assert Alert Dialog replaces `confirm()`, pending deletion cannot repeat, failed deletion/edit retains visible state, desktop table and phone cards invoke identical callbacks, upload payload remains FormData, captions save on blur, sample numeric drafts remain strings until save, and failed sample save leaves the editor open.

- [x] **Step 2: Run dataset and sampling tests and verify failures**

Run: `bun run test -- src/lib/components/datasets src/lib/components/sampling src/routes/datasets src/routes/sampling`

Expected: Alert Dialog, phone card, and failure-retention assertions FAIL.

- [x] **Step 3: Rebuild dataset routes and components**

Use responsive Table/Card collections, Dropdown Menu, Badge, Alert Dialog, file input, Scroll Area, Skeleton, Empty, and responsive overlays. Keep one state/action source for table and card views. Preserve drag/drop and image behavior without placing native file input outside canonical UI.

- [x] **Step 4: Rebuild sampling routes and components**

Use Table at desktop and `SamplePromptCards` below 768px, with shared edit/delete functions receiving original indices. Use responsive Dialog/Drawer for detail editing and Alert Dialog for deletion. Await `mutateAsync` before close and preserve draft on failure.

- [x] **Step 5: Run tests and commit**

Run:

```bash
bun run test -- src/lib/components/datasets src/lib/components/sampling src/routes/datasets src/routes/sampling
bun run check
```

Expected: all listed tests PASS.

```bash
git add web/src/lib/components/datasets web/src/lib/components/sampling web/src/routes/datasets web/src/routes/sampling
git commit -m "refactor(web): migrate datasets and sampling workflows"
```

### Task 9: Training, Gallery, And Remaining Routes

**Files:**
- Modify: `web/src/lib/components/training/GpuMonitor.svelte`
- Modify: `web/src/lib/components/training/SampleGallery.svelte`
- Modify: `web/src/lib/components/training/GalleryImageViewer.svelte`
- Modify: corresponding training tests
- Modify: `web/src/routes/login/+page.svelte`, `login/page.test.ts`
- Modify: `web/src/routes/general/+page.svelte`, `general/page.test.ts`
- Modify: `web/src/routes/model/+page.svelte`, `model/page.test.ts`
- Modify: `web/src/routes/lora/+page.svelte`, `lora/page.test.ts`
- Modify: `web/src/routes/training/+page.svelte`, `training/page.test.ts`
- Modify: `web/src/routes/backup/+page.svelte`
- Create: `web/src/routes/backup/page.test.ts`
- Modify: `web/src/routes/live/+page.svelte`, `live/page.test.ts`
- Modify: `web/src/routes/gallery/+page.svelte`, `gallery/page.test.ts`
- Modify: `web/src/routes/secrets/+page.svelte`, `secrets/page.test.ts`
- Modify: `web/src/routes/console/+page.svelte`
- Create: `web/src/routes/console/page.test.ts`

**Interfaces:**
- Preserves: GPU normalization, gallery sort preference, viewer keyboard/swipe/preload, training and backup state gates, secrets payloads, and console ownership.
- Preserves: schema tab/subtab orchestration and PageHeader semantics.

- [x] **Step 1: Add missing route behavior tests**

Cover backup state gating and mutation feedback, console full-page ownership, theme-aware login, HTTP warning, secret save payloads, Alert Dialog before clearing password, training status actions, gallery sorting/viewer state, and failed operations retaining applicable drafts.

- [x] **Step 2: Run remaining route and training tests**

Run: `bun run test -- src/lib/components/training src/routes/login src/routes/general src/routes/model src/routes/lora src/routes/training src/routes/backup src/routes/live src/routes/gallery src/routes/secrets src/routes/console`

Expected: new shadcn roles, confirmations, and route tests FAIL before migration.

- [x] **Step 3: Rebuild training and gallery presentation**

Use Card, Badge, Progress-style local displays, Skeleton, Empty, Alert, Button, Native Select, Dropdown Menu, Tooltip, and responsive Dialog/Drawer. Preserve GpuMonitor transforms, gallery preference storage, viewer arrow/swipe navigation, selected batch/prompt/variant, and image preload.

- [x] **Step 4: Migrate schema, utility, and live routes**

Use moved PageHeader/FormPageSkeleton, canonical Tabs, Cards, Alerts, Sonner, and responsive action layout. Keep query/mutation bodies and payload creation unchanged. Await mutations that govern overlay closure or destructive state. Add Alert Dialog for password clearing.

- [x] **Step 5: Run all unit tests and commit**

Run:

```bash
bun run test
bun run check
bun run build
```

Expected: all unit tests PASS, no new check errors, build PASS.

```bash
git add web/src/lib/components/training web/src/routes
git commit -m "refactor(web): complete shadcn route migration"
```

### Task 10: Cutover Cleanup And Architecture Enforcement

**Files:**
- Delete: superseded flat UI primitives and tests under `web/src/lib/components/ui/`
- Delete: superseded form leaves and tests under `web/src/lib/components/form/`
- Delete: obsolete test wrappers
- Modify: all production Svelte files still importing old paths
- Modify: `web/src/app.css`
- Modify: `web/src/lib/components/native-control-boundary.test.ts`
- Modify: `web/src/lib/components/ui-dependency-boundary.test.ts`

**Interfaces:**
- Produces: no temporary compatibility adapter and no old token or component import.
- Produces: passing native-control and dependency boundaries across the final tree.

- [x] **Step 1: Search for all forbidden remnants**

Run these searches and save the results for the task review:

```bash
rg "components/(ui/(Button|ModalDialog|Alert|Toast|TabBar|Skeleton|AddCard)|form/(TextInput|TextArea|Checkbox|Toggle|Select|RangeInput|FileInput|NumberInput|SectionDivider))" src
rg "var\(--(bg|panel|panel-raised|control|line|text|muted|accent|color-bg|color-text|color-border|color-primary)" src
rg ":global\(" src/lib/components
```

Expected: any output identifies a file that must migrate or a selector that needs explicit justification.

- [x] **Step 2: Delete superseded source and brittle tests**

Delete old primitives, `CompoundsTestWrapper.svelte`, old CSS-structure tests, and `StatusBarTestWrapper.svelte` if no longer imported. Keep behavior tests by moving assertions to the new composite or route test rather than discarding payload/focus coverage.

- [x] **Step 3: Remove obsolete styles and tokens**

Remove old aliases and parent-to-child overrides only after their final consumer is gone. Keep application-level shell, safe-area, reduced-motion, chart, and virtualization rules that express behavior rather than primitive styling.

- [x] **Step 4: Tighten and run boundary tests**

Run:

```bash
bun run test -- src/lib/components/native-control-boundary.test.ts src/lib/components/ui-dependency-boundary.test.ts
bun run test
bun run check
bun run build
```

Expected: boundaries PASS, all unit tests PASS, check has no new errors, build PASS.

- [x] **Step 5: Verify the remnant searches are empty**

Repeat the three searches from Step 1. Expected: no old imports or old token usages; each remaining `:global()` is documented inline as required for a third-party DOM boundary.

- [x] **Step 6: Commit the cutover cleanup**

```bash
git add -A web/src web/package.json web/bun.lock web/components.json
git commit -m "refactor(web): remove legacy component system"
```

### Task 11: Desktop, Phone, Accessibility, And Visual Acceptance

**Files:**
- Create: `web/e2e/theme.spec.ts`
- Create: `web/e2e/responsive-workflows.spec.ts`
- Create: `web/e2e/accessibility.spec.ts`
- Create: `web/e2e/visual.spec.ts`
- Modify: `web/e2e/mobile.spec.ts`
- Modify: `web/e2e/phase-a.spec.ts`
- Modify: `web/e2e/phase-b.spec.ts`
- Modify: `web/e2e/phase-c.spec.ts`
- Modify: `web/e2e/console.spec.ts`
- Modify: `web/e2e/firefox-smoke.spec.ts`
- Modify: `web/playwright.config.ts`
- Create: curated snapshots under `web/e2e/visual.spec.ts-snapshots/`

**Interfaces:**
- Produces: behavioral E2E coverage independent of generated class names and DOM internals.
- Produces: curated shell/form/collection/overlay/state snapshots in both themes and both target viewports.

- [x] **Step 1: Add theme and responsive workflow tests**

Test dark default, light toggle, `webui.theme`, reload persistence, desktop Sidebar collapse persistence, ephemeral phone Sidebar, schema editing, directory Dialog/Sheet switch, concepts/datasets/sampling editing, training controls, console access, destructive confirmation, and no horizontal document overflow at 390px.

Use roles and accessible names. Do not select generated Tailwind classes.

- [x] **Step 2: Add representative axe checks**

In `accessibility.spec.ts`, import `AxeBuilder` from `@axe-core/playwright`. Scan login, general schema form, datasets, concepts, live, open Dialog, open Drawer, open Sheet, and Alert Dialog. Assert no violations with impact `critical` or `serious`; keep explicit keyboard/focus tests for interaction behavior.

- [x] **Step 3: Add curated visual baselines**

Capture only:

```text
shell: dark/light desktop and phone
schema form: dark/light desktop and phone
dataset collection: table desktop and cards phone
ordinary editor: Dialog desktop and Drawer phone
directory picker: Dialog desktop and Sheet phone
loading, empty, and persistent error states
```

Disable animations through Playwright screenshot options and seed deterministic E2E data. Use full-page screenshots only when validating page overflow; otherwise snapshot the named region.

- [x] **Step 4: Update existing E2E selectors and projects**

Replace old class/DOM selectors with roles and labels. Keep projects at Desktop Chrome `1280x720`, iPhone 13 `390x844`, and Desktop Firefox. Ensure visual tests run only in deterministic Chromium desktop/phone projects; behavioral smoke remains cross-browser.

- [x] **Step 5: Run the complete verification matrix**

From `web/`, run:

```bash
bun run check
bun run test
bun run build
bunx playwright test --project=chromium-desktop
bunx playwright test --project=webkit-phone
bunx playwright test --project=firefox-smoke
```

Expected: check has no new errors; all unit tests and build PASS; all available browser projects PASS. If WebKit cannot launch because host libraries are absent, record the exact missing libraries and run the phone suite under Chromium device emulation as additional evidence; do not skip product assertions.

- [x] **Step 6: Review and commit intentional snapshots**

Inspect every new image for clipping, overflow, wrong theme, stale loading, unstable timestamps, and focus artifacts. Regenerate only after fixing the cause of instability.

```bash
git add web/e2e web/playwright.config.ts web/package.json web/bun.lock
git commit -m "test(web): verify shadcn responsive migration"
```

### Task 12: Final Cutover Audit

**Files:**
- Modify only files identified by the audit.

**Interfaces:**
- Verifies every inventory entry and acceptance criterion; introduces no new architecture.

- [x] **Step 1: Audit every inventory row**

For each file in Migration Inventory, mark it in the execution notes as replaced/deleted, moved, retained-and-rebuilt, wrapper-updated/deleted, route-migrated, or redirect-retained. Any unclassified production Svelte file blocks completion.

- [x] **Step 2: Audit behavioral contracts**

Confirm numeric drafts, Native Select value shapes, file input open/payload, focus restoration, failed overlay retention, persistence keys, directory callback order, domain indices, GPU normalization, gallery sorting, training actions, and API payload assertions each have a passing test.

- [x] **Step 3: Run final clean verification**

Run from a clean `web/` dependency install:

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
bunx playwright test
```

Expected: install uses the committed lockfile; check, all tests, build, and all supported browser projects PASS.

- [x] **Step 4: Inspect final diff and repository status**

Run:

```bash
git status --short
git diff --check
git diff --stat 65732774..HEAD
```

Expected: no whitespace errors, no uncommitted migration files, and no unrelated `.gitignore` or sample-gallery-plan changes included.

- [x] **Step 5: Commit audit fixes if any**

If the audit required changes, stage only those files and commit:

```bash
git commit -m "fix(web): complete shadcn cutover audit"
```

If no files changed, do not create an empty commit.
