# Web UI Component Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all native web controls behind approved leaf components, consolidate proven repeated UI compounds, and enforce the boundary without changing product behavior or responsive design.

**Architecture:** Nine allowlisted leaf components exclusively own native `button`, `input`, `select`, `option`, and `textarea` elements. Specialized form controls and feature components compose those leaves, while stateless compounds own repeated presentation and `Toast` owns only its dismissal timer. A Svelte-compiler source test enforces the ownership boundary after the 137 current violations in 34 files are migrated.

**Tech Stack:** Svelte 5 runes and snippets, TypeScript 5, SvelteKit 2, Vitest 3, Testing Library Svelte 5, Svelte compiler `parse`, Playwright 1.49, Bun, plain component CSS.

## Global Constraints

- Preserve current desktop appearance and behavior.
- Preserve current responsive behavior; do not redesign mobile layouts.
- Add no dependencies and do not introduce a component framework, token system, Storybook, or screenshot test infrastructure.
- The complete native-control allowlist is exactly `web/src/lib/components/ui/Button.svelte`, `web/src/lib/components/form/TextInput.svelte`, `web/src/lib/components/form/NumberInput.svelte`, `web/src/lib/components/form/Checkbox.svelte`, `web/src/lib/components/form/Toggle.svelte`, `web/src/lib/components/form/TextArea.svelte`, `web/src/lib/components/form/FileInput.svelte`, `web/src/lib/components/form/RangeInput.svelte`, and `web/src/lib/components/form/Select.svelte`.
- `Select.svelte` continues to own its internal trigger buttons, option buttons, hidden native select, native options, and `bind:this={triggerBtn}`; never compose `Button` inside `Select`.
- `TimeInput`, `DirectoryInput`, and `PathInput` must compose leaves. Do not unify their picker ownership models.
- Do not make `DirectoryPicker` compose `ModalDialog`; preserve its independent focus trap, focus restoration, full-screen phone CSS, and server-path behavior.
- Do not redesign `ModalDialog`; preserve its backdrop close, Escape handling, focus trap, focus restoration, widths, footer behavior, and delegated key handling.
- Do not decompose `ConceptDetailModal`.
- Preserve IDs, labels, ARIA relationships, accessible names, disabled conditions, titles, event timing, keyboard behavior, API calls, payloads, and mutation ownership.
- `Button` defaults to native `type="button"`; every submit button must pass `type="submit"` explicitly.
- Preserve raw-string numeric editing. Never parse inside `NumberInput`, and never turn partial or invalid edits into `NaN`.
- `SamplePromptTable` commits width, height, seed, prompt, and enabled changes on `change`, not `input`.
- Preserve concept-card action `stopPropagation()` and assign `previewAugmentations` before requesting a refreshed preview.
- Preserve feature-specific native-root DOM and CSS by forwarding `class` to the leaf's native root. For every consumer selector targeting a migrated native root, retain the class and rewrite with this exact scoping pattern: `.control` to `:global(.control)`, `.parent .control` to `.parent :global(.control)`, `.control:hover` to `:global(.control:hover)`, and `.control.active` to `:global(.control.active)`.
- Wrap leaf default CSS selectors in `:where(...)` so they have zero specificity and retained feature classes can override them. Do not add generic hover filters or transforms that would stack with existing feature hover behavior.
- Preserve dataset upload `accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff,.txt,.caption"`, `multiple`, `FileList`, drag/drop upload, and caption save-on-blur.
- Preserve login form submission, explicit `type="submit"`, `required`, and `autofocus`.
- Password visibility controls must retain the changing accessible names `Show token`/`Hide token` and `Show password`/`Hide password`.
- Build before Playwright because `tests/webui/e2e_server.py` serves `web/build` through the `web/.e2e` fixture.
- Run all web commands from `web/`.

---

## File Map

**Create leaf components and tests:**
- `web/src/lib/components/ui/Button.svelte` - sole general native button owner.
- `web/src/lib/components/ui/Button.test.ts` - button type, variants, size, attributes, disabled state, and click contract.
- `web/src/lib/components/form/Checkbox.svelte` - compact boolean leaf.
- `web/src/lib/components/form/TextArea.svelte` - multiline string leaf.
- `web/src/lib/components/form/FileInput.svelte` - file-selection leaf with `open()`.
- `web/src/lib/components/form/RangeInput.svelte` - numeric range leaf.
- `web/src/lib/components/form/FormInputs.test.ts` - text, number, checkbox, toggle, and textarea contracts.
- `web/src/lib/components/form/FileRangeSelect.test.ts` - file, range, and existing Select contracts.

**Modify existing leaves:**
- `web/src/lib/components/form/TextInput.svelte:1-54` - text/password/search, events, adornments, attributes, and `focus()`.
- `web/src/lib/components/form/NumberInput.svelte:1-54` - raw input/change values and numeric constraints.
- `web/src/lib/components/form/Toggle.svelte:1-41` - boolean callback and forwarded attributes.
- `web/src/lib/components/form/Select.svelte:1-313` - preserve internal ownership while forwarding required standard attributes/events.

**Create compounds and tests:**
- `web/src/lib/components/ui/PageHeader.svelte` - title plus optional description, status, and actions snippets.
- `web/src/lib/components/ui/TabBar.svelte` - generic controlled page/dialog tabs.
- `web/src/lib/components/ui/Alert.svelte` - persistent info/success/warning/error feedback.
- `web/src/lib/components/ui/Toast.svelte` - transient feedback and restartable timer.
- `web/src/lib/components/ui/Skeleton.svelte` - hidden base loading shape.
- `web/src/lib/components/ui/FormPageSkeleton.svelte` - repeated route loading composition.
- `web/src/lib/components/ui/CompoundsTestWrapper.svelte` - concrete snippet fixture.
- `web/src/lib/components/ui/Compounds.test.ts` - compound semantics and timer behavior.

**Modify specialized forms and UI composites (14 violations):**
- `web/src/lib/components/form/TimeInput.svelte:1-94`
- `web/src/lib/components/form/DirectoryInput.svelte:1-129`
- `web/src/lib/components/form/PathInput.svelte:1-200`
- `web/src/lib/components/form/SchemaForm.svelte:1-400`
- `web/src/lib/components/form/OptimizerParamsModal.svelte:1-324`
- `web/src/lib/components/form/SchedulerParamsModal.svelte:1-103`
- `web/src/lib/components/ui/ModalDialog.svelte:1-310`
- `web/src/lib/components/ui/AddCard.svelte:1-65`
- `web/src/lib/components/form/SchemaForm.test.ts`
- `web/src/lib/components/form/OptimizerParamsModal.test.ts`
- `web/src/lib/components/form/PathInput.test.ts`
- `web/src/lib/components/ui/ModalDialog.test.ts`
- `web/src/lib/components/ui/AddCard.test.ts`

**Modify shell (24 violations):**
- `web/src/lib/components/shell/Rail.svelte:1-349`
- `web/src/lib/components/shell/Header.svelte:1-750`
- `web/src/lib/components/shell/StatusBar.svelte:1-245`
- `web/src/lib/components/shell/ErrorBanner.svelte:1-77`
- `web/src/lib/components/shell/ConsoleDrawer.svelte:1-210`
- Test: `web/src/lib/components/shell/Rail.test.ts`
- Test: `web/src/lib/components/shell/Header.test.ts`
- Test: `web/src/lib/components/shell/StatusBar.test.ts`
- Test: `web/src/lib/components/shell/ErrorBanner.test.ts`
- Test: `web/src/lib/components/shell/ConsoleDrawer.test.ts`

**Modify directory picker (10 violations):**
- `web/src/lib/components/directory/DirectoryPicker.svelte:1-675`
- `web/src/lib/components/directory/DirectoryPicker.test.ts`

**Modify feature controls (14 violations):**
- `web/src/lib/components/console/ConsoleView.svelte:1-400`
- `web/src/lib/components/charts/MetricsChart.svelte:1-312`
- `web/src/lib/components/training/GalleryImageViewer.svelte:1-489`
- `web/src/lib/components/training/SampleGallery.svelte:1-489`
- `web/src/lib/components/datasets/DatasetPickerModal.svelte:1-250`
- Test: `web/src/lib/components/console/ConsoleView.test.ts`
- Test: `web/src/lib/components/charts/MetricsChart.test.ts`
- Test: `web/src/lib/components/training/GalleryImageViewer.test.ts`
- Test: `web/src/lib/components/training/SampleGallery.test.ts`
- Test: `web/src/lib/components/datasets/DatasetPickerModal.test.ts`

**Modify sampling controls (21 violations):**
- `web/src/lib/components/sampling/SamplePromptTable.svelte:1-159`
- `web/src/lib/components/sampling/SampleDetailModal.svelte:1-307`
- `web/src/lib/components/sampling/SamplePromptTable.test.ts`
- `web/src/lib/components/sampling/SampleDetailModal.test.ts`

**Modify embedding/concept controls (27 violations):**
- `web/src/lib/components/embeddings/EmbeddingCard.svelte:1-374`
- `web/src/lib/components/concepts/ConceptsEditor.svelte:1-627`
- `web/src/lib/components/concepts/ConceptDetailModal.svelte:1-2066`
- Create `web/src/lib/components/embeddings/EmbeddingCard.test.ts`.
- Modify `web/src/lib/components/concepts/ConceptsEditor.test.ts` and `ConceptDetailModal.test.ts`.

**Modify repeated route structures and remaining controls (27 violations):**
- `web/src/routes/general/+page.svelte`, `model/+page.svelte`, `training/+page.svelte`, `backup/+page.svelte`, `sampling/+page.svelte`, `embeddings/+page.svelte`, `lora/+page.svelte`, `live/+page.svelte`, `concepts/+page.svelte`, `gallery/+page.svelte`, `datasets/+page.svelte`, `datasets/[id]/+page.svelte`, `secrets/+page.svelte`, and `login/+page.svelte`.
- Test: `web/src/routes/general/page.test.ts`
- Test: `web/src/routes/model/page.test.ts`
- Test: `web/src/routes/training/page.test.ts`
- Test: `web/src/routes/sampling/SamplingPage.test.ts`
- Test: `web/src/routes/embeddings/page.test.ts`
- Test: `web/src/routes/live/page.test.ts`
- Test: `web/src/routes/gallery/page.test.ts`
- Test: `web/src/routes/datasets/DatasetsPage.test.ts`
- Test: `web/src/routes/datasets/[id]/DatasetDetailPage.test.ts`
- Create `web/src/routes/login/page.test.ts` and `web/src/routes/secrets/page.test.ts`.

**Create enforcement and update E2E:**
- `web/src/lib/components/native-control-boundary.test.ts` - compiler-AST boundary.
- `web/e2e/phase-a.spec.ts`, `phase-b.spec.ts`, `phase-c.spec.ts`, `mobile.spec.ts`, `firefox-smoke.spec.ts`, and `console.spec.ts` - current routes, labels, and accessible selectors.

**Exact pre-migration violation inventory:**

| File | Count |
|---|---:|
| `web/src/lib/components/charts/MetricsChart.svelte` | 3 |
| `web/src/lib/components/concepts/ConceptDetailModal.svelte` | 12 |
| `web/src/lib/components/concepts/ConceptsEditor.svelte` | 8 |
| `web/src/lib/components/console/ConsoleView.svelte` | 7 |
| `web/src/lib/components/datasets/DatasetPickerModal.svelte` | 1 |
| `web/src/lib/components/directory/DirectoryPicker.svelte` | 10 |
| `web/src/lib/components/embeddings/EmbeddingCard.svelte` | 7 |
| `web/src/lib/components/form/DirectoryInput.svelte` | 2 |
| `web/src/lib/components/form/OptimizerParamsModal.svelte` | 2 |
| `web/src/lib/components/form/PathInput.svelte` | 2 |
| `web/src/lib/components/form/SchedulerParamsModal.svelte` | 1 |
| `web/src/lib/components/form/SchemaForm.svelte` | 2 |
| `web/src/lib/components/form/TimeInput.svelte` | 1 |
| `web/src/lib/components/sampling/SampleDetailModal.svelte` | 11 |
| `web/src/lib/components/sampling/SamplePromptTable.svelte` | 10 |
| `web/src/lib/components/shell/ConsoleDrawer.svelte` | 1 |
| `web/src/lib/components/shell/ErrorBanner.svelte` | 1 |
| `web/src/lib/components/shell/Header.svelte` | 7 |
| `web/src/lib/components/shell/Rail.svelte` | 5 |
| `web/src/lib/components/shell/StatusBar.svelte` | 10 |
| `web/src/lib/components/training/GalleryImageViewer.svelte` | 2 |
| `web/src/lib/components/training/SampleGallery.svelte` | 1 |
| `web/src/lib/components/ui/AddCard.svelte` | 1 |
| `web/src/lib/components/ui/ModalDialog.svelte` | 3 |
| `web/src/routes/backup/+page.svelte` | 2 |
| `web/src/routes/datasets/[id]/+page.svelte` | 5 |
| `web/src/routes/datasets/+page.svelte` | 2 |
| `web/src/routes/embeddings/+page.svelte` | 3 |
| `web/src/routes/general/+page.svelte` | 1 |
| `web/src/routes/login/+page.svelte` | 2 |
| `web/src/routes/model/+page.svelte` | 1 |
| `web/src/routes/sampling/+page.svelte` | 3 |
| `web/src/routes/secrets/+page.svelte` | 7 |
| `web/src/routes/training/+page.svelte` | 1 |
| **Total** | **137** |

### Task 1: Button Leaf

**Files:**
- Create: `web/src/lib/components/ui/Button.svelte`
- Create: `web/src/lib/components/ui/Button.test.ts`

**Interfaces:**
- Consumes: Svelte `Snippet` and `HTMLButtonAttributes`; no application state.
- Produces: `variant: 'primary' | 'secondary' | 'danger' | 'ghost'`, `size: 'small' | 'medium' | 'large' | 'icon'`, explicit native `type`, optional `children`, native attributes/events, and a native-button root.

- [ ] **Step 1: Add the failing Button contract test**

```ts
// web/src/lib/components/ui/Button.test.ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import Button from './Button.svelte';

it('defaults to type button and forwards presentation, attributes, and clicks', async () => {
  const onclick = vi.fn();
  render(Button, {
    variant: 'danger', size: 'icon', class: 'feature-button',
    'aria-label': 'Delete item', title: 'Delete', onclick,
  });
  const button = screen.getByRole('button', { name: 'Delete item' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveClass('button', 'button--danger', 'button--icon', 'feature-button');
  expect(button).toHaveAttribute('title', 'Delete');
  await fireEvent.click(button);
  expect(onclick).toHaveBeenCalledOnce();
});

it('preserves explicit submit type and native disabled behavior', async () => {
  const onclick = vi.fn();
  render(Button, { type: 'submit', disabled: true, 'aria-label': 'Sign in', onclick });
  const button = screen.getByRole('button', { name: 'Sign in' });
  expect(button).toHaveAttribute('type', 'submit');
  expect(button).toBeDisabled();
  await fireEvent.click(button);
  expect(onclick).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the Button test to verify RED**

Run: `bun run test -- src/lib/components/ui/Button.test.ts`

Expected: FAIL because `./Button.svelte` does not exist.

- [ ] **Step 3: Implement the complete Button leaf**

```svelte
<!-- web/src/lib/components/ui/Button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
  type ButtonSize = 'small' | 'medium' | 'large' | 'icon';
  type Props = Omit<HTMLButtonAttributes, 'children' | 'class' | 'type'> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
    children?: Snippet;
  };

  let {
    variant = 'secondary', size = 'medium', type = 'button',
    class: className = '', children, ...attributes
  }: Props = $props();
</script>

<button
  {...attributes}
  {type}
  class={`button button--${variant} button--${size}${className ? ` ${className}` : ''}`}
>
  {#if children}{@render children()}{/if}
</button>

<style>
  :where(.button) { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; border:1px solid transparent; border-radius:6px; font:inherit; font-weight:500; cursor:pointer; transition:background-color .15s,border-color .15s,color .15s,opacity .15s; }
  :where(.button--small) { min-height:30px; padding:.25rem .625rem; font-size:.75rem; }
  :where(.button--medium) { min-height:36px; padding:.4rem .85rem; font-size:.875rem; }
  :where(.button--large) { min-height:44px; padding:.75rem 1rem; font-size:.95rem; }
  :where(.button--icon) { width:36px; height:36px; padding:0; }
  :where(.button--primary) { background:var(--accent,#3b82f6); color:#fff; }
  :where(.button--secondary) { background:var(--panel-raised,var(--control,#14191f)); color:var(--text,#e6ebef); border-color:var(--line,#2d3741); }
  :where(.button--danger) { background:var(--danger,#ef4444); color:#fff; }
  :where(.button--ghost) { background:transparent; color:var(--muted,#8995a1); }
  :where(.button:focus-visible) { outline:2px solid var(--focus,var(--accent,#3b82f6)); outline-offset:2px; }
  :where(.button:disabled) { opacity:.5; cursor:not-allowed; }
</style>
```

- [ ] **Step 4: Run the Button test to verify GREEN**

Run: `bun run test -- src/lib/components/ui/Button.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add web/src/lib/components/ui/Button.svelte web/src/lib/components/ui/Button.test.ts
git commit -m "feat(web): add shared button primitive"
```

### Task 2: Text, Number, Checkbox, Toggle, and TextArea Leaves

**Files:**
- Modify: `web/src/lib/components/form/TextInput.svelte:1-54`
- Modify: `web/src/lib/components/form/NumberInput.svelte:1-54`
- Modify: `web/src/lib/components/form/Toggle.svelte:1-41`
- Create: `web/src/lib/components/form/Checkbox.svelte`
- Create: `web/src/lib/components/form/TextArea.svelte`
- Create: `web/src/lib/components/form/FormInputs.test.ts`

**Interfaces:**
- Consumes: controlled primitive values and standard input attributes.
- Produces: `TextInput` raw strings on input/change plus keydown and `focus()`; `NumberInput` raw strings on input/change with `min`/`max`/`step`; `Checkbox`/`Toggle` booleans on change; `TextArea` strings on input/change and blur events.

- [ ] **Step 1: Add focused failing tests for all five contracts**

```ts
// web/src/lib/components/form/FormInputs.test.ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { expect, it, vi } from 'vitest';
import TextInput from './TextInput.svelte';
import NumberInput from './NumberInput.svelte';
import Checkbox from './Checkbox.svelte';
import Toggle from './Toggle.svelte';
import TextArea from './TextArea.svelte';

it('supports password metadata, input/change/keydown, and imperative focus', async () => {
  const onInput = vi.fn(), onChange = vi.fn(), onKeyDown = vi.fn();
  const result = render(TextInput, { id:'password', type:'password', value:'secret', autocomplete:'current-password', required:true, autofocus:true, onInput, onChange, onKeyDown });
  const input = document.querySelector('#password') as HTMLInputElement;
  expect(input).toHaveAttribute('type','password');
  expect(input).toHaveAttribute('autocomplete','current-password');
  expect(input).toBeRequired();
  await fireEvent.input(input, { target:{ value:'new' } });
  await fireEvent.change(input, { target:{ value:'new' } });
  await fireEvent.keyDown(input, { key:'Enter' });
  expect(onInput).toHaveBeenCalledWith('new');
  expect(onChange).toHaveBeenCalledWith('new');
  expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key:'Enter' }));
  result.component.focus();
  expect(input).toHaveFocus();
});

it('renders optional input adornments without changing the native input',()=>{
  const startAdornment=createRawSnippet(()=>({render:()=>'<span>Search icon</span>'}));
  const endAdornment=createRawSnippet(()=>({render:()=>'<span>Clear</span>'}));
  render(TextInput,{id:'search',type:'search',startAdornment,endAdornment});
  expect(screen.getByText('Search icon')).toBeVisible();
  expect(screen.getByText('Clear')).toBeVisible();
  expect(document.querySelector('#search')).toHaveAttribute('type','search');
});

it('emits incomplete numeric edits as strings without NaN conversion', async () => {
  const onInput = vi.fn(), onChange = vi.fn();
  render(NumberInput, { id:'amount', value:'1', min:0, max:10, step:0.1, onInput, onChange });
  const input = document.querySelector('#amount') as HTMLInputElement;
  expect(input).toHaveAttribute('inputmode','decimal');
  expect(input).toHaveAttribute('min','0');
  await fireEvent.input(input, { target:{ value:'-' } });
  await fireEvent.change(input, { target:{ value:'1.' } });
  expect(onInput).toHaveBeenCalledWith('-');
  expect(onChange).toHaveBeenCalledWith('1.');
});

it('emits booleans from checkbox and toggle', async () => {
  const checkboxChange = vi.fn(), toggleChange = vi.fn();
  render(Checkbox, { id:'compact', value:false, onChange:checkboxChange });
  render(Toggle, { id:'setting', value:true, onChange:toggleChange });
  await fireEvent.click(document.querySelector('#compact')!);
  await fireEvent.click(document.querySelector('#setting')!);
  expect(checkboxChange).toHaveBeenCalledWith(true);
  expect(toggleChange).toHaveBeenCalledWith(false);
});

it('emits textarea input/change values and the blur event', async () => {
  const onInput = vi.fn(), onChange = vi.fn(), onBlur = vi.fn();
  render(TextArea, { id:'caption', value:'old', rows:3, onInput, onChange, onBlur });
  const area = document.querySelector('#caption')!;
  await fireEvent.input(area, { target:{ value:'draft' } });
  await fireEvent.change(area, { target:{ value:'saved' } });
  await fireEvent.blur(area);
  expect(onInput).toHaveBeenCalledWith('draft');
  expect(onChange).toHaveBeenCalledWith('saved');
  expect(onBlur).toHaveBeenCalledWith('saved', expect.any(FocusEvent));
});
```

- [ ] **Step 2: Run the leaf test to verify RED**

Run: `bun run test -- src/lib/components/form/FormInputs.test.ts`

Expected: FAIL because `Checkbox.svelte` and `TextArea.svelte` do not exist and existing inputs lack the expanded contracts.

- [ ] **Step 3: Replace the leaf implementations with these exact interfaces**

```svelte
<!-- TextInput.svelte script and markup; retain the existing .text-input focus/style declarations -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props = Omit<HTMLInputAttributes,'type'|'value'|'class'|'oninput'|'onchange'|'onkeydown'|'aria-describedby'|'aria-label'> & {
    type?: 'text'|'password'|'search'; value?: string; class?: string;
    ariaDescribedBy?: string; ariaLabel?: string;
    startAdornment?: Snippet; endAdornment?: Snippet;
    onInput?: (value:string)=>void; onChange?: (value:string)=>void;
    onKeyDown?: (event:KeyboardEvent)=>void;
  };
  let { type='text', value='', class:className='', ariaDescribedBy, ariaLabel, startAdornment, endAdornment, onInput, onChange, onKeyDown, ...attributes }:Props=$props();
  let input=$state<HTMLInputElement|null>(null);
  export function focus(){ input?.focus(); }
</script>
{#if startAdornment || endAdornment}<span class="text-input-shell">{#if startAdornment}{@render startAdornment()}{/if}
  <input {...attributes} bind:this={input} {type} value={value??''} aria-describedby={ariaDescribedBy} aria-label={ariaLabel} class={`text-input ${className}`} oninput={(e)=>onInput?.(e.currentTarget.value)} onchange={(e)=>onChange?.(e.currentTarget.value)} onkeydown={onKeyDown}/>
  {#if endAdornment}{@render endAdornment()}{/if}</span>
{:else}<input {...attributes} bind:this={input} {type} value={value??''} aria-describedby={ariaDescribedBy} aria-label={ariaLabel} class={`text-input ${className}`} oninput={(e)=>onInput?.(e.currentTarget.value)} onchange={(e)=>onChange?.(e.currentTarget.value)} onkeydown={onKeyDown}/>{/if}
<style>.text-input-shell{display:flex;align-items:center;width:100%;gap:.5rem}.text-input-shell :where(.text-input){min-width:0}</style>
```

```svelte
<!-- NumberInput.svelte script and markup; retain existing .number-input styles -->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props=Omit<HTMLInputAttributes,'type'|'value'|'class'|'oninput'|'onchange'|'aria-describedby'|'aria-label'> & { value?:number|string; class?:string; ariaDescribedBy?:string; ariaLabel?:string; onInput?:(value:string)=>void; onChange?:(value:string)=>void };
  let { value='', class:className='', ariaDescribedBy, ariaLabel, onInput, onChange, ...attributes }:Props=$props();
</script>
<input {...attributes} type="text" inputmode="decimal" value={value??''} aria-describedby={ariaDescribedBy} aria-label={ariaLabel} class={`number-input ${className}`} oninput={(e)=>onInput?.(e.currentTarget.value)} onchange={(e)=>onChange?.(e.currentTarget.value)}/>
```

```svelte
<!-- web/src/lib/components/form/Checkbox.svelte -->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props=Omit<HTMLInputAttributes,'type'|'checked'|'class'|'onchange'|'aria-describedby'|'aria-label'> & { value?:boolean; class?:string; ariaDescribedBy?:string; ariaLabel?:string; onChange?:(value:boolean)=>void };
  let { value=false, class:className='', ariaDescribedBy, ariaLabel, onChange, ...attributes }:Props=$props();
</script>
<input {...attributes} type="checkbox" checked={value} aria-describedby={ariaDescribedBy} aria-label={ariaLabel} class={`checkbox-input ${className}`} onchange={(e)=>onChange?.(e.currentTarget.checked)}/>
<style>:where(.checkbox-input){width:1rem;height:1rem;margin:0;cursor:pointer;accent-color:var(--accent,#3b82f6)}:where(.checkbox-input:disabled){cursor:not-allowed;opacity:.5}</style>
```

```svelte
<!-- Toggle.svelte complete replacement -->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props=Omit<HTMLInputAttributes,'type'|'checked'|'class'|'onchange'|'aria-describedby'|'aria-label'> & { value?:boolean; class?:string; ariaDescribedBy?:string; ariaLabel?:string; onChange?:(value:boolean)=>void };
  let { value=false, class:className='', ariaDescribedBy, ariaLabel, onChange, ...attributes }:Props=$props();
</script>
<input {...attributes} type="checkbox" checked={value} aria-describedby={ariaDescribedBy} aria-label={ariaLabel} class={`toggle-input ${className}`} onchange={(e)=>onChange?.(e.currentTarget.checked)}/>
<style>:where(.toggle-input){width:1.125rem;height:1.125rem;cursor:pointer;accent-color:var(--color-primary,var(--accent,#3b82f6));margin:0;vertical-align:middle}:where(.toggle-input:disabled){cursor:not-allowed;opacity:.5}</style>
```

```svelte
<!-- web/src/lib/components/form/TextArea.svelte -->
<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  type Props=Omit<HTMLTextareaAttributes,'value'|'class'|'oninput'|'onchange'|'onblur'|'aria-describedby'|'aria-label'> & { value?:string; class?:string; ariaDescribedBy?:string; ariaLabel?:string; onInput?:(value:string)=>void; onChange?:(value:string)=>void; onBlur?:(value:string,event:FocusEvent)=>void };
  let { value='', class:className='', ariaDescribedBy, ariaLabel, onInput, onChange, onBlur, ...attributes }:Props=$props();
</script>
<textarea {...attributes} value={value??''} aria-describedby={ariaDescribedBy} aria-label={ariaLabel} class={`textarea-input ${className}`} oninput={(e)=>onInput?.(e.currentTarget.value)} onchange={(e)=>onChange?.(e.currentTarget.value)} onblur={(e)=>onBlur?.(e.currentTarget.value,e)}></textarea>
<style>:where(.textarea-input){box-sizing:border-box;width:100%;padding:.5rem .75rem;border:1px solid var(--line,#2d3741);border-radius:6px;background:var(--control,#14191f);color:var(--text,#e6ebef);font:inherit;resize:vertical}:where(.textarea-input:focus){outline:none;border-color:var(--accent,#3b82f6)}</style>
```

- [ ] **Step 4: Run leaf tests and type checking**

Run: `bun run test -- src/lib/components/form/FormInputs.test.ts && bun run check`

Expected: PASS for 5 tests and `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 5: Commit Task 2**

```bash
git add web/src/lib/components/form/TextInput.svelte web/src/lib/components/form/NumberInput.svelte web/src/lib/components/form/Checkbox.svelte web/src/lib/components/form/Toggle.svelte web/src/lib/components/form/TextArea.svelte web/src/lib/components/form/FormInputs.test.ts
git commit -m "feat(web): complete shared form input leaves"
```

### Task 3: FileInput, RangeInput, and Select Contracts

**Files:**
- Create: `web/src/lib/components/form/FileInput.svelte`
- Create: `web/src/lib/components/form/RangeInput.svelte`
- Modify: `web/src/lib/components/form/Select.svelte:4-22,84-153`
- Create: `web/src/lib/components/form/FileRangeSelect.test.ts`

**Interfaces:**
- Consumes: standard native attributes and controlled values.
- Produces: `FileInput.onChange(FileList|null)` and `open():void`; `RangeInput.onInput(number)`; `Select.onChange(any)` while retaining its exact internal native controls and trigger reference.

- [ ] **Step 1: Add failing file/range/select tests**

```ts
// web/src/lib/components/form/FileRangeSelect.test.ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import FileInput from './FileInput.svelte';
import RangeInput from './RangeInput.svelte';
import Select from './Select.svelte';

it('forwards file metadata, emits FileList, and opens imperatively', async () => {
  const onChange=vi.fn();
  const result=render(FileInput,{ id:'files', accept:'image/*,.txt', multiple:true, onChange });
  const input=document.querySelector('#files') as HTMLInputElement;
  const file=new File(['x'],'x.txt');
  const files={ 0:file, length:1, item:(i:number)=>i===0?file:null } as FileList;
  Object.defineProperty(input,'files',{ configurable:true, value:files });
  const click=vi.spyOn(input,'click');
  await fireEvent.change(input);
  expect(onChange).toHaveBeenCalledWith(files);
  expect(input).toHaveAttribute('accept','image/*,.txt');
  expect(input).toHaveAttribute('multiple');
  result.component.open();
  expect(click).toHaveBeenCalledOnce();
});

it('emits a number from range input', async () => {
  const onInput=vi.fn();
  render(RangeInput,{ id:'ema', value:0, min:0, max:.99, step:.01, 'aria-label':'EMA Smoothing', onInput });
  await fireEvent.input(screen.getByLabelText('EMA Smoothing'),{target:{value:'.6'}});
  expect(onInput).toHaveBeenCalledWith(.6);
});

it('keeps Select trigger/options/native select ownership and selection behavior', async () => {
  const onChange=vi.fn();
  const {container}=render(Select,{ id:'kind', value:'a', options:[{value:'a',label:'A'},{value:'b',label:'B'}], onChange });
  expect(container.querySelector('.select-trigger')).toBeInstanceOf(HTMLButtonElement);
  expect(screen.getByRole('combobox')).toHaveValue('a');
  await fireEvent.click(container.querySelector('.select-trigger')!);
  await fireEvent.click(screen.getByRole('option',{name:'B'}));
  expect(onChange).toHaveBeenCalledWith('b');
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `bun run test -- src/lib/components/form/FileRangeSelect.test.ts`

Expected: FAIL because FileInput and RangeInput do not exist.

- [ ] **Step 3: Implement FileInput and RangeInput**

```svelte
<!-- web/src/lib/components/form/FileInput.svelte -->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props=Omit<HTMLInputAttributes,'type'|'class'|'onchange'> & { class?:string; onChange?:(files:FileList|null)=>void };
  let { class:className='', onChange, ...attributes }:Props=$props();
  let input=$state<HTMLInputElement|null>(null);
  export function open(){ input?.click(); }
</script>
<input {...attributes} bind:this={input} type="file" class={`file-input ${className}`} onchange={(e)=>onChange?.(e.currentTarget.files)}/>
```

```svelte
<!-- web/src/lib/components/form/RangeInput.svelte -->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  type Props=Omit<HTMLInputAttributes,'type'|'value'|'class'|'oninput'> & { value?:number; class?:string; onInput?:(value:number)=>void };
  let { value=0, class:className='', onInput, ...attributes }:Props=$props();
</script>
<input {...attributes} type="range" value={value} class={`range-input ${className}`} oninput={(e)=>onInput?.(e.currentTarget.valueAsNumber)}/>
<style>:where(.range-input){accent-color:var(--accent,#3b82f6);cursor:pointer}:where(.range-input:disabled){cursor:not-allowed;opacity:.5}</style>
```

- [ ] **Step 4: Preserve Select internals and add only standard forwarding**

Add `name?: string`, `required?: boolean`, `class?: string`, `onBlur?: (event:FocusEvent)=>void`, and `onKeyDown?: (event:KeyboardEvent)=>void` to props. Add the external class to `.custom-select-wrapper`; pass `name` and `required` to the hidden `<select>` and `onblur={onBlur}`/`onkeydown={onKeyDown}` to its native element. Do not alter lines containing `<button>`, `<select>`, `<option>`, or `bind:this={triggerBtn}` and do not import `Button`.

- [ ] **Step 5: Run focused tests**

Run: `bun run test -- src/lib/components/form/FileRangeSelect.test.ts src/lib/components/form/SchemaForm.test.ts`

Expected: PASS for the new 3 tests and all existing SchemaForm tests.

- [ ] **Step 6: Commit Task 3**

```bash
git add web/src/lib/components/form/FileInput.svelte web/src/lib/components/form/RangeInput.svelte web/src/lib/components/form/Select.svelte web/src/lib/components/form/FileRangeSelect.test.ts
git commit -m "feat(web): add file and range input leaves"
```

### Task 4: Repeated UI Compounds

**Files:**
- Create: `web/src/lib/components/ui/PageHeader.svelte`
- Create: `web/src/lib/components/ui/TabBar.svelte`
- Create: `web/src/lib/components/ui/Alert.svelte`
- Create: `web/src/lib/components/ui/Toast.svelte`
- Create: `web/src/lib/components/ui/Skeleton.svelte`
- Create: `web/src/lib/components/ui/FormPageSkeleton.svelte`
- Create: `web/src/lib/components/ui/CompoundsTestWrapper.svelte`
- Create: `web/src/lib/components/ui/Compounds.test.ts`

**Interfaces:**
- Consumes: display values, snippets, and controlled callbacks only; no API/query/store imports.
- Produces: `PageHeader`, generic `TabBar<T extends string>`, `AlertTone`, restartable `Toast`, `Skeleton`, and configurable `FormPageSkeleton`.

- [ ] **Step 1: Add the complete compound fixture and failing tests**

```svelte
<!-- web/src/lib/components/ui/CompoundsTestWrapper.svelte -->
<script lang="ts">
  import PageHeader from './PageHeader.svelte'; import TabBar from './TabBar.svelte';
  import Alert from './Alert.svelte'; import Toast from './Toast.svelte'; import FormPageSkeleton from './FormPageSkeleton.svelte';
  let { active='one', message='Saved', tone='success', duration=4000, onSelect=()=>{}, onDismiss=()=>{} }=$props<{active?:string;message?:string;tone?:'info'|'success'|'warning'|'error';duration?:number;onSelect?:(id:string)=>void;onDismiss?:()=>void}>();
</script>
{#snippet description()}<p>Page description</p>{/snippet}
{#snippet status()}<span>Ready</span>{/snippet}
{#snippet actions()}<a href="/next">Next</a>{/snippet}
<PageHeader title="Settings" {description} {status} {actions}/>
<TabBar tabs={[{id:'one',label:'One'},{id:'two',label:'Two'}]} {active} variant="dialog" {onSelect}/>
<Alert tone="error">Persistent failure</Alert>
<Toast {message} {tone} {duration} {onDismiss}/>
<FormPageSkeleton rows={2} label="Loading settings"/>
```

```ts
// web/src/lib/components/ui/Compounds.test.ts
import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import Wrapper from './CompoundsTestWrapper.svelte';

it('renders heading snippets, controlled dialog tabs, alert semantics, and hidden skeleton rows', async()=>{
  const onSelect=vi.fn(); const {container}=render(Wrapper,{onSelect});
  expect(screen.getByRole('heading',{level:1,name:'Settings'})).toBeVisible();
  expect(screen.getByText('Page description')).toBeVisible(); expect(screen.getByText('Ready')).toBeVisible();
  expect(screen.getByRole('tab',{name:'One'})).toHaveAttribute('aria-selected','true');
  await fireEvent.click(screen.getByRole('tab',{name:'Two'})); expect(onSelect).toHaveBeenCalledWith('two');
  expect(screen.getByRole('alert')).toHaveTextContent('Persistent failure');
  expect(screen.getByRole('status',{name:'Loading settings'})).toBeVisible();
  expect(container.querySelectorAll('.skeleton')).toHaveLength(2);
  expect(container.querySelector('.skeleton')).toHaveAttribute('aria-hidden','true');
});

it('restarts and clears the toast timer', async()=>{
  vi.useFakeTimers(); const onDismiss=vi.fn();
  const result=render(Wrapper,{message:'First',tone:'success',duration:1000,onDismiss});
  await vi.advanceTimersByTimeAsync(600); await result.rerender({message:'First',tone:'error',duration:1000,onDismiss});
  await vi.advanceTimersByTimeAsync(600); expect(onDismiss).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(400); expect(onDismiss).toHaveBeenCalledOnce();
  result.unmount(); await vi.runAllTimersAsync(); expect(onDismiss).toHaveBeenCalledOnce(); vi.useRealTimers();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `bun run test -- src/lib/components/ui/Compounds.test.ts`

Expected: FAIL because the six compounds do not exist.

- [ ] **Step 3: Implement all compounds with these complete contents**

```svelte
<!-- PageHeader.svelte -->
<script lang="ts">import type{Snippet}from'svelte';let{title,description,status,actions,class:className=''}=$props<{title:string;description?:Snippet;status?:Snippet;actions?:Snippet;class?:string}>();</script>
<header class={`page-header ${className}`}><div class="page-header__title-group"><h1 class="page-title">{title}</h1>{#if description}<div class="page-description">{@render description()}</div>{/if}{#if status}<div class="page-status">{@render status()}</div>{/if}</div>{#if actions}<div class="header-actions">{@render actions()}</div>{/if}</header>
<style>.page-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.page-header__title-group{display:flex;align-items:center;gap:1rem}.page-title{font-size:1.5rem;font-weight:700;margin:0;color:var(--color-text-title,var(--accent,#3b82f6))}.page-description{color:var(--muted,#8995a1)}.page-status,.header-actions{display:flex;align-items:center;gap:.5rem}</style>
```

```svelte
<!-- TabBar.svelte -->
<svelte:options generics="T extends string" />
<script lang="ts">import Button from './Button.svelte';let{tabs,active,variant='page',onSelect,class:className=''}=$props<{tabs:Array<{id:T;label:string;disabled?:boolean}>;active:T;variant?:'page'|'dialog';onSelect:(id:T)=>void;class?:string}>();</script>
<div class={`tab-bar tab-bar--${variant} ${className}`} role="tablist">{#each tabs as tab(tab.id)}<Button variant="ghost" class={`tab-bar__button${active===tab.id?' active':''}`} role="tab" aria-selected={active===tab.id} disabled={tab.disabled} onclick={()=>onSelect(tab.id)}>{tab.label}</Button>{/each}</div>
<style>.tab-bar{display:flex;align-items:center;gap:.25rem;overflow-x:auto}.tab-bar--page{border-bottom:1px solid var(--line,#2d3741);padding:0 .25rem}.tab-bar--dialog{border-bottom:1px solid var(--line,#2d3741)}:global(.tab-bar__button){white-space:nowrap}:global(.tab-bar--page .tab-bar__button){border-bottom-left-radius:0;border-bottom-right-radius:0;margin-bottom:-1px}:global(.tab-bar__button.active){color:var(--accent,#3b82f6);border-color:var(--line,#2d3741);background:var(--panel,#181e25)}</style>
```

```svelte
<!-- Alert.svelte -->
<script module lang="ts">export type AlertTone='info'|'success'|'warning'|'error';</script>
<script lang="ts">import type{Snippet}from'svelte';let{tone='info',children,class:className=''}=$props<{tone?:AlertTone;children:Snippet;class?:string}>();const role=$derived(tone==='warning'||tone==='error'?'alert':'status');</script>
<div {role} class={`alert alert--${tone} ${className}`}>{@render children()}</div>
<style>.alert{display:flex;align-items:flex-start;gap:.625rem;padding:.75rem 1rem;border:1px solid;border-radius:6px;font-size:.875rem}.alert--info{background:rgba(59,130,246,.15);border-color:rgba(59,130,246,.3);color:#60a5fa}.alert--success{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.3);color:#34d399}.alert--warning{background:rgba(234,179,8,.12);border-color:rgba(234,179,8,.3);color:#fde047}.alert--error{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#f87171}</style>
```

```svelte
<!-- Toast.svelte -->
<script lang="ts">import{onDestroy}from'svelte';import type{AlertTone}from'./Alert.svelte';let{message,tone='info',duration=4000,onDismiss,class:className=''}=$props<{message:string;tone?:AlertTone;duration?:number;onDismiss:()=>void;class?:string}>();let timer:ReturnType<typeof setTimeout>|null=null;function clearTimer(){if(timer){clearTimeout(timer);timer=null}}$effect(()=>{message;tone;duration;onDismiss;clearTimer();if(message&&duration>0)timer=setTimeout(()=>{timer=null;onDismiss()},duration);return clearTimer});onDestroy(clearTimer);</script>
<div role="status" class={`toast toast--${tone} ${className}`}>{message}</div>
<style>.toast{padding:.75rem 1.25rem;border:1px solid;border-radius:8px;font-size:.9375rem;font-weight:500}.toast--info{background:rgba(59,130,246,.15);border-color:rgba(59,130,246,.3);color:#60a5fa}.toast--success{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.3);color:#34d399}.toast--warning{background:rgba(234,179,8,.12);border-color:rgba(234,179,8,.3);color:#fde047}.toast--error{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#fca5a5}</style>
```

```svelte
<!-- Skeleton.svelte -->
<script lang="ts">let{height='3rem',radius='6px',class:className=''}=$props<{height?:string;radius?:string;class?:string}>();</script>
<div class={`skeleton ${className}`} aria-hidden="true" style:height style:border-radius={radius}></div>
<style>.skeleton{width:100%;background:var(--color-skeleton,var(--line,#374151));animation:skeleton-pulse 1.5s infinite ease-in-out}@keyframes skeleton-pulse{0%,100%{opacity:1}50%{opacity:.5}}</style>
```

```svelte
<!-- FormPageSkeleton.svelte -->
<script lang="ts">import Skeleton from './Skeleton.svelte';let{rows=3,rowHeight='3rem',label='Loading configuration',padded=true,class:className=''}=$props<{rows?:number;rowHeight?:string;label?:string;padded?:boolean;class?:string}>();</script>
<div class={`form-page-skeleton ${padded?'padded':''} ${className}`} role="status" aria-label={label}>{#each Array(rows) as _,index(index)}<Skeleton height={rowHeight}/>{/each}</div>
<style>.form-page-skeleton{display:flex;flex-direction:column;gap:1rem}.form-page-skeleton.padded{padding:1.5rem}</style>
```

- [ ] **Step 4: Run compound tests and checking**

Run: `bun run test -- src/lib/components/ui/Compounds.test.ts && bun run check`

Expected: PASS for 2 tests and zero Svelte diagnostics.

- [ ] **Step 5: Commit Task 4**

```bash
git add web/src/lib/components/ui/PageHeader.svelte web/src/lib/components/ui/TabBar.svelte web/src/lib/components/ui/Alert.svelte web/src/lib/components/ui/Toast.svelte web/src/lib/components/ui/Skeleton.svelte web/src/lib/components/ui/FormPageSkeleton.svelte web/src/lib/components/ui/CompoundsTestWrapper.svelte web/src/lib/components/ui/Compounds.test.ts
git commit -m "feat(web): add shared UI compounds"
```

### Task 5: Specialized Forms, ModalDialog, and AddCard (14 Violations)

**Files:**
- Modify: `web/src/lib/components/form/TimeInput.svelte`
- Modify: `web/src/lib/components/form/DirectoryInput.svelte`
- Modify: `web/src/lib/components/form/PathInput.svelte`
- Modify: `web/src/lib/components/form/SchemaForm.svelte`
- Modify: `web/src/lib/components/form/OptimizerParamsModal.svelte`
- Modify: `web/src/lib/components/form/SchedulerParamsModal.svelte`
- Modify: `web/src/lib/components/ui/ModalDialog.svelte`
- Modify: `web/src/lib/components/ui/AddCard.svelte`
- Test: `web/src/lib/components/form/SchemaForm.test.ts`
- Test: `web/src/lib/components/form/OptimizerParamsModal.test.ts`
- Test: `web/src/lib/components/form/PathInput.test.ts`
- Test: `web/src/lib/components/ui/ModalDialog.test.ts`
- Test: `web/src/lib/components/ui/AddCard.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3 leaves with their exact callback types.
- Produces: unchanged public APIs for `TimeInput`, `DirectoryInput`, `PathInput`, `SchemaForm`, both parameter modals, `ModalDialog`, and `AddCard`; zero native controls in these files.

- [ ] **Step 1: Extend behavioral tests before migration**

Add these exact assertions:

```ts
// SchemaForm.test.ts: append
it('keeps incomplete numeric schema edits as raw strings', async()=>{
  const setRaw=vi.fn();
  render(SchemaForm,{tab:{id:'x',label:'X',groups:[{id:'g',fields:[{id:'n',keys:['n'],label:'N',control:'number'}]}]},values:{n:1},issues:[],setRaw});
  await fireEvent.input(screen.getByLabelText('N'),{target:{value:'-'}});
  expect(setRaw).toHaveBeenCalledWith('n','-');
});

// ModalDialog.test.ts: append inside describe
it('keeps focus trapped after shared buttons are composed', async()=>{
  render(ModalDialog,{props:{open:true,title:'Trap',onClose:vi.fn(),onApply:vi.fn()}});
  const dialog=screen.getByRole('dialog'); const apply=screen.getByRole('button',{name:'Apply'}); const close=screen.getByRole('button',{name:'Close'});
  apply.focus(); await fireEvent.keyDown(dialog,{key:'Tab'}); expect(close).toHaveFocus();
});
```

- [ ] **Step 2: Run the focused suite to establish GREEN before refactoring**

Run: `bun run test -- src/lib/components/form/SchemaForm.test.ts src/lib/components/form/OptimizerParamsModal.test.ts src/lib/components/form/PathInput.test.ts src/lib/components/ui/ModalDialog.test.ts src/lib/components/ui/AddCard.test.ts`

Expected: PASS.

Run: `rg -n -o '<(button|input|select|option|textarea)\b' src/lib/components/form/TimeInput.svelte src/lib/components/form/DirectoryInput.svelte src/lib/components/form/PathInput.svelte src/lib/components/form/SchemaForm.svelte src/lib/components/form/OptimizerParamsModal.svelte src/lib/components/form/SchedulerParamsModal.svelte src/lib/components/ui/ModalDialog.svelte src/lib/components/ui/AddCard.svelte | wc -l`

Expected: prints `14`, the RED ownership state for this task.

- [ ] **Step 3: Migrate each exact native control**

- `TimeInput.svelte:47-56`: replace with `<NumberInput {id} value={value} {disabled} {ariaDescribedBy} class="time-value-input" onInput={onValueInput}/>`; remove `handleValueInput`.
- `DirectoryInput.svelte:52-73`: use `<TextInput ... class="directory-input" onInput={onInput}/>` and `<Button variant="secondary" class="directory-btn" aria-label="Browse directory" ...>`; retain `handleOpen` and route-context ownership unchanged.
- `PathInput.svelte:59-77`: use controlled `TextInput` and `Button`; `onInput` must set `value`, invoke `onInput`, then invoke `onChange` in that order. Keep the local `DirectoryPicker` architecture.
- `SchemaForm.svelte:185-205`: replace both gear buttons with icon-size ghost `Button` instances retaining `title`, disabled logic, and callbacks.
- `OptimizerParamsModal.svelte:180-220`: use secondary `Button` for Load Defaults and `NumberInput` for int/float specs. Store each raw string during editing; in `handleApply`, convert non-empty numeric spec values with `Number(value)` and preserve empty strings rather than producing `NaN`.
- `SchedulerParamsModal.svelte:45-51`: use controlled `TextInput` with `onInput={(value)=>(customClassName=value)}`.
- `ModalDialog.svelte:134-167`: use ghost icon `Button` for Close, secondary Button for Cancel, and primary Button for Apply. Do not alter lines 37-108 or the dialog/backdrop markup.
- `AddCard.svelte:15-25`: make `Button variant="ghost" class="add-card"` the root and retain children and callback unchanged.

Use imports from the exact colocated or `$lib/components/...` paths already used by each file. Retain existing feature class names. Rewrite the component-root selectors as `:global(.time-value-input)`, `:global(.directory-input)`, `:global(.directory-btn)`, `:global(.path-input)`, `:global(.browse-btn)`, `:global(.defaults-btn)`, `:global(.param-input)`, `:global(.close-btn)`, `:global(.cancel-btn)`, `:global(.apply-btn)`, and `:global(.add-card)` using the Global Constraints pattern.

- [ ] **Step 4: Run focused migration tests and verify native-tag reduction**

Run: `bun run test -- src/lib/components/form/SchemaForm.test.ts src/lib/components/form/OptimizerParamsModal.test.ts src/lib/components/form/PathInput.test.ts src/lib/components/ui/ModalDialog.test.ts src/lib/components/ui/AddCard.test.ts && rg -n '<(button|input|select|option|textarea)\b' src/lib/components/form/TimeInput.svelte src/lib/components/form/DirectoryInput.svelte src/lib/components/form/PathInput.svelte src/lib/components/form/SchemaForm.svelte src/lib/components/form/OptimizerParamsModal.svelte src/lib/components/form/SchedulerParamsModal.svelte src/lib/components/ui/ModalDialog.svelte src/lib/components/ui/AddCard.svelte`

Expected: tests PASS; `rg` exits 1 with no matches.

- [ ] **Step 5: Commit Task 5**

```bash
git add web/src/lib/components/form web/src/lib/components/ui/ModalDialog.svelte web/src/lib/components/ui/ModalDialog.test.ts web/src/lib/components/ui/AddCard.svelte web/src/lib/components/ui/AddCard.test.ts
git commit -m "refactor(web): compose leaves in form controls and modals"
```

### Task 6: Shell Controls (24 Violations)

**Files:**
- Modify: `web/src/lib/components/shell/Rail.svelte`
- Modify: `web/src/lib/components/shell/Header.svelte`
- Modify: `web/src/lib/components/shell/StatusBar.svelte`
- Modify: `web/src/lib/components/shell/ErrorBanner.svelte`
- Modify: `web/src/lib/components/shell/ConsoleDrawer.svelte`
- Test: the five exact shell test paths in the global file map.

**Interfaces:**
- Consumes: `Button`, `TextInput`, `Alert`, existing `Select`, and existing shell state/API callbacks.
- Produces: unchanged shell navigation, autosave/conflict actions, training actions, console drawer behavior, and accessible names.

- [ ] **Step 1: Run the existing shell regression suite**

Run: `bun run test -- src/lib/components/shell`

Expected: PASS.

- [ ] **Step 2: Verify the shell ownership gate is RED**

Run: `rg -n -o '<(button|input|select|option|textarea)\b' src/lib/components/shell --glob '*.svelte' | wc -l`

Expected: prints `24`, proving the behavior passes while ownership still violates the approved boundary.

- [ ] **Step 3: Replace all shell controls with exact leaf mappings**

- `Rail.svelte`: map `mobile-toggle-btn`, `close-btn`, both `console-nav-btn` controls, and `rail-toggle-btn` to ghost `Button`; retain all classes, labels, titles, localStorage writes, drawer close ordering, and links.
- `Header.svelte`: map Load/Save/Retry/Reload to secondary `Button`, Overwrite controls to danger `Button`, and Preset Name to `<TextInput value={presetName} onInput={(value)=>(presetName=value)} onKeyDown={(event)=>{if(event.key==='Enter'){event.preventDefault();handleSavePreset();}}}/>` so `handleSavePreset()` remains after `preventDefault()`. Render both persistent save/training failures with `Alert tone="error" class="save-error-toast"`; do not add a dismissal timer.
- `StatusBar.svelte`: map every action by existing class: primary for Start/Resume, danger for Stop, secondary for Pause/Sample/Backup. Preserve all conditional branches and API functions.
- `ErrorBanner.svelte`: make it a compatibility wrapper around `Alert tone="error" class="error-banner"` plus a danger small `Button class="dismiss-btn"`; retain the `Error:` prefix and local dismissal reset behavior.
- `ConsoleDrawer.svelte`: use ghost icon `Button class="btn-icon" title="Close Console Drawer"`; leave the full-page console `<a>` unchanged.

Do not replace anchors with Button. Keep native-root feature classes and convert their selectors with the exact `:global(...)` pattern in Global Constraints.

- [ ] **Step 4: Verify shell behavior and ownership**

Run: `bun run test -- src/lib/components/shell && rg -n '<(button|input|select|option|textarea)\b' src/lib/components/shell`

Expected: shell tests PASS; `rg` exits 1 with no matches.

- [ ] **Step 5: Commit Task 6**

```bash
git add web/src/lib/components/shell
git commit -m "refactor(web): migrate shell controls to shared leaves"
```

### Task 7: DirectoryPicker Controls (10 Violations)

**Files:**
- Modify: `web/src/lib/components/directory/DirectoryPicker.svelte:1-675`
- Modify: `web/src/lib/components/directory/DirectoryPicker.test.ts`

**Interfaces:**
- Consumes: `Button`, `TextInput.focus()`, `Alert`, existing API/list callback.
- Produces: unchanged independent picker dialog and focus architecture; no native controls.

- [ ] **Step 1: Keep the existing 10 DirectoryPicker tests as the RED/GREEN regression contract and add an Enter-order assertion**

Extend the manual-path test with `expect(screen.getByDisplayValue('/custom/path')).toHaveFocus()` before Enter and retain `expect(list).toHaveBeenLastCalledWith('/custom/path')` after Enter.

- [ ] **Step 2: Run the picker test before migration**

Run: `bun run test -- src/lib/components/directory/DirectoryPicker.test.ts`

Expected: PASS, 10 tests.

Run: `rg -n -o '<(button|input|select|option|textarea)\b' src/lib/components/directory/DirectoryPicker.svelte | wc -l`

Expected: prints `10`, the RED ownership state.

- [ ] **Step 3: Migrate without changing architecture**

Import `Button` and `TextInput`. Change `pathInputEl` to `let pathInputControl=$state<{focus:()=>void}|null>(null)` and focus it after `tick()`. Replace path input with:

```svelte
<TextInput bind:this={pathInputControl} value={typedPath} class="path-input" placeholder="Enter path..." onInput={(value)=>(typedPath=value)} onKeyDown={handleInputKeyDown}/>
```

Update `handleInputKeyDown` to use `typedPath` directly. Replace Close/Go/breadcrumb/root/parent/directory/file/Cancel/Select controls with Button while retaining every existing class, `aria-label`, disabled condition, single/double-click callback, and callback order. Use ghost for navigation/list/close, secondary for Go/Cancel, and primary for Select. Render the existing picker error as `Alert tone="error" class="error-message"` and warning as `Alert tone="warning" class="warning-message"`, preserving their lifetime and text. Leave backdrop, modal, `bind:this={modalEl}`, focusable selector, focus trap, restoration, and phone media query unchanged.

- [ ] **Step 4: Verify picker behavior and ownership**

Run: `bun run test -- src/lib/components/directory/DirectoryPicker.test.ts && rg -n '<(button|input|select|option|textarea)\b' src/lib/components/directory/DirectoryPicker.svelte`

Expected: 10 tests PASS; `rg` exits 1.

- [ ] **Step 5: Commit Task 7**

```bash
git add web/src/lib/components/directory/DirectoryPicker.svelte web/src/lib/components/directory/DirectoryPicker.test.ts
git commit -m "refactor(web): compose directory picker controls"
```

### Task 8: Console, Charts, Training Gallery, and Dataset Picker (14 Violations)

**Files:**
- Modify: `web/src/lib/components/console/ConsoleView.svelte`
- Modify: `web/src/lib/components/charts/MetricsChart.svelte`
- Modify: `web/src/lib/components/training/GalleryImageViewer.svelte`
- Modify: `web/src/lib/components/training/SampleGallery.svelte`
- Modify: `web/src/lib/components/datasets/DatasetPickerModal.svelte`
- Test: `web/src/lib/components/console/ConsoleView.test.ts`
- Test: `web/src/lib/components/charts/MetricsChart.test.ts`
- Test: `web/src/lib/components/training/GalleryImageViewer.test.ts`
- Test: `web/src/lib/components/training/SampleGallery.test.ts`
- Test: `web/src/lib/components/datasets/DatasetPickerModal.test.ts`

**Interfaces:**
- Consumes: Button, TextInput, RangeInput.
- Produces: unchanged console channel/filter timing, numeric EMA input, gallery navigation, card native-root DOM, and dataset double-click selection.

- [ ] **Step 1: Add exact RangeInput boundary assertions to `MetricsChart.test.ts`**

Insert after the existing slider lookup in `updates EMA smoothing value when slider is moved`:

```ts
expect(slider).toHaveAttribute('min', '0');
expect(slider).toHaveAttribute('max', '0.99');
expect(slider).toHaveAttribute('step', '0.01');
```

- [ ] **Step 2: Run feature tests and verify RED ownership**

Run: `bun run test -- src/lib/components/console/ConsoleView.test.ts src/lib/components/charts/MetricsChart.test.ts src/lib/components/training/GalleryImageViewer.test.ts src/lib/components/training/SampleGallery.test.ts src/lib/components/datasets/DatasetPickerModal.test.ts`

Expected: PASS.

Run: `rg -n -o '<(button|input|select|option|textarea)\b' src/lib/components/console/ConsoleView.svelte src/lib/components/charts/MetricsChart.svelte src/lib/components/training/GalleryImageViewer.svelte src/lib/components/training/SampleGallery.svelte src/lib/components/datasets/DatasetPickerModal.svelte | wc -l`

Expected: prints `14`.

- [ ] **Step 3: Apply exact migrations while retaining feature classes**

- `ConsoleView.svelte`: page through `Button` for Console/Web UI/ALL/Pause/Clear/Latest; use `TextInput type="search" class="filter-input" value={filterText} onInput={(value)=>(filterText=value)}`. Keep radio-group container and all labels. Do not rename `Latest` to `Jump to latest`.
- `MetricsChart.svelte`: use `RangeInput class="ema-slider" value={emaFactor} min={0} max={0.99} step={0.01} aria-label="EMA Smoothing" onInput={(value)=>(emaFactor=value)}` and secondary small Buttons for scale/reset.
- `GalleryImageViewer.svelte`: use ghost icon Buttons for Previous/Next with existing disabled logic and callbacks.
- `SampleGallery.svelte`: use ghost Button as the exact native root of `.sample-card.ready-card`, retaining aria-label and child DOM.
- `DatasetPickerModal.svelte`: use ghost Button as the exact native root of `.dataset-card`, retaining single click and double click separately.

- [ ] **Step 4: Verify tests, control count, and Svelte compilation**

Run: `bun run test -- src/lib/components/console/ConsoleView.test.ts src/lib/components/charts/MetricsChart.test.ts src/lib/components/training/GalleryImageViewer.test.ts src/lib/components/training/SampleGallery.test.ts src/lib/components/datasets/DatasetPickerModal.test.ts && bun run check`

Expected: PASS and zero Svelte diagnostics.

Run: `rg -n '<(button|input|select|option|textarea)\b' src/lib/components/console/ConsoleView.svelte src/lib/components/charts/MetricsChart.svelte src/lib/components/training/GalleryImageViewer.svelte src/lib/components/training/SampleGallery.svelte src/lib/components/datasets/DatasetPickerModal.svelte`

Expected: exits 1 with no matches.

- [ ] **Step 5: Commit Task 8**

```bash
git add web/src/lib/components/console web/src/lib/components/charts web/src/lib/components/training/GalleryImageViewer.svelte web/src/lib/components/training/GalleryImageViewer.test.ts web/src/lib/components/training/SampleGallery.svelte web/src/lib/components/training/SampleGallery.test.ts web/src/lib/components/datasets/DatasetPickerModal.svelte web/src/lib/components/datasets/DatasetPickerModal.test.ts
git commit -m "refactor(web): migrate feature controls to shared leaves"
```

### Task 9: Sampling Components (21 Violations)

**Files:**
- Modify: `web/src/lib/components/sampling/SamplePromptTable.svelte`
- Modify: `web/src/lib/components/sampling/SampleDetailModal.svelte`
- Test: `web/src/lib/components/sampling/SamplePromptTable.test.ts`
- Test: `web/src/lib/components/sampling/SampleDetailModal.test.ts`

**Interfaces:**
- Consumes: Button, Checkbox, NumberInput, TextInput, TextArea, Select.
- Produces: unchanged SamplePromptTable change-time commits and SampleDetailModal draft payload.

- [ ] **Step 1: Strengthen change timing and raw-value tests**

In `SamplePromptTable.test.ts`, insert `await fireEvent.input(widthInput,{target:{value:'640'}}); expect(onUpdate).not.toHaveBeenCalled();` before the existing `fireEvent.change`, clearing the mock immediately before this assertion. In `SampleDetailModal.test.ts`, input `768`, `40`, `8.5`, and `123` through labels, click Save, and assert those exact numbers in the saved object.

- [ ] **Step 2: Run sampling tests before migration**

Run: `bun run test -- src/lib/components/sampling`

Expected: PASS.

Run: `rg -n -o '<(button|input|select|option|textarea)\b' src/lib/components/sampling | wc -l`

Expected: prints `21`, the RED ownership state.

- [ ] **Step 3: Migrate SamplePromptTable with change-only callbacks**

Use Checkbox for enabled. Use NumberInput for width/height/seed with `onChange` only, never `onInput`; retain parseInt fallback functions exactly. Use TextInput for prompt with `onChange` only. Use Button for dice/edit/clone/delete/add, preserving every class, title, aria-label, and callback. Because NumberInput is `type="text"`, update test selection from `getAllByRole('spinbutton')` to exact IDs added as `sample-width-${index}`, `sample-height-${index}`, and `sample-seed-${index}`.

- [ ] **Step 4: Migrate SampleDetailModal with controlled raw-string conversion**

Use TextArea for prompt fields, Checkbox for enabled, Buttons for 512/768/1024, and NumberInput for five numeric fields. Each numeric callback must guard conversion:

```ts
function setDraftNumber(key:'width'|'height'|'diffusion_steps'|'cfg_scale'|'seed', value:string) {
  if (value.trim()==='') return;
  const parsed=Number(value);
  if (!Number.isNaN(parsed)) draft[key]=parsed;
}
```

Pass existing min/max/step attributes and call this function from `onInput`. Keep draft initialization, deep cloning, scheduler selection, and save object unchanged.

- [ ] **Step 5: Verify sampling behavior and ownership**

Run: `bun run test -- src/lib/components/sampling && rg -n '<(button|input|select|option|textarea)\b' src/lib/components/sampling`

Expected: all sampling tests PASS; `rg` exits 1.

- [ ] **Step 6: Commit Task 9**

```bash
git add web/src/lib/components/sampling
git commit -m "refactor(web): migrate sampling controls"
```

### Task 10: Embeddings and Concepts (27 Violations)

**Files:**
- Modify: `web/src/lib/components/embeddings/EmbeddingCard.svelte`
- Create: `web/src/lib/components/embeddings/EmbeddingCard.test.ts`
- Modify: `web/src/lib/components/concepts/ConceptsEditor.svelte`
- Modify: `web/src/lib/components/concepts/ConceptDetailModal.svelte`
- Test: `web/src/lib/components/concepts/ConceptsEditor.test.ts`
- Test: `web/src/lib/components/concepts/ConceptDetailModal.test.ts`

**Interfaces:**
- Consumes: Button, TextInput, NumberInput, Checkbox, Toggle, TabBar.
- Produces: unchanged embedding bindable object, concept card interactions, concept modal draft, preview ordering, stats actions, and picker ownership.

- [ ] **Step 1: Add exact behavior tests before migration**

```ts
// EmbeddingCard.test.ts
import{fireEvent,render,screen}from'@testing-library/svelte';import{expect,it,vi}from'vitest';import EmbeddingCard from'./EmbeddingCard.svelte';
it('updates fields and preserves clone/remove/browse callbacks',async()=>{const embedding={model_name:'',placeholder:'<x>',token_count:1,train:true,initial_embedding_text:'*'};const onClone=vi.fn(),onRemove=vi.fn(),onOpenDirectory=vi.fn((_p,cb)=>cb?.('/model.pt'));render(EmbeddingCard,{embedding,index:0,onClone,onRemove,onOpenDirectory});await fireEvent.input(screen.getByLabelText('Placeholder'),{target:{value:'<y>'}});await fireEvent.click(screen.getByTitle('Browse file'));expect(embedding.placeholder).toBe('<y>');expect(embedding.model_name).toBe('/model.pt');await fireEvent.click(screen.getByTitle('Clone embedding'));await fireEvent.click(screen.getByTitle('Remove embedding'));expect(onClone).toHaveBeenCalledWith(0);expect(onRemove).toHaveBeenCalledWith(0)});
```

Append these exact tests:

```ts
// ConceptsEditor.test.ts, inside describe
it('stops clone and delete actions from opening the card modal',async()=>{
  const onChange=vi.fn();
  render(ConceptsEditor,{props:{concepts:[{name:'A',path:'/a',enabled:true}],onChange}});
  await fireEvent.click(screen.getByTitle('Duplicate Concept'));
  expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({name:'A (Copy)'})]));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await fireEvent.click(screen.getByTitle('Delete Concept'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

```ts
// ConceptDetailModal.test.ts: add `import { api } from '$lib/api/client';`, then append inside describe
it('updates preview augmentation state before requesting the preview',async()=>{
  const preview=vi.spyOn(api,'previewConceptAugmentation').mockResolvedValue({image_data:'',filename:'x.png',prompt:'x'});
  render(ConceptDetailModal,{props:{concept:{name:'A',path:'/a',enabled:true},isOpen:true,onSave:vi.fn(),onClose:vi.fn()}});
  await fireEvent.click(screen.getByRole('tab',{name:'Image Augmentations'}));
  await fireEvent.click(screen.getByRole('button',{name:'Preview'}));
  await fireEvent.click(await screen.findByLabelText('Preview Augmentations'));
  await waitFor(()=>expect(preview).toHaveBeenLastCalledWith(expect.any(Object),0,true));
});
```

- [ ] **Step 2: Run embedding/concept tests and verify RED ownership**

Run: `bun run test -- src/lib/components/embeddings/EmbeddingCard.test.ts src/lib/components/concepts`

Expected: behavior tests PASS.

Run: `rg -n -o '<(button|input|select|option|textarea)\b' src/lib/components/embeddings/EmbeddingCard.svelte src/lib/components/concepts | wc -l`

Expected: prints `27`.

- [ ] **Step 3: Migrate EmbeddingCard and ConceptsEditor**

- `EmbeddingCard.svelte`: use Button for Clone/Remove/Browse, TextInput for model/placeholder/initial text, NumberInput for token count. For controlled bindable fields, assign raw text directly; assign token count only when `Number(value)` is not `NaN`. Retain TimeInput's existing `Number(val)||0` behavior.
- `ConceptsEditor.svelte`: use search TextInput with `type="search"`; Checkbox for Show Disabled and per-card enabled state; Button for Disable/Enable All, Add First, Edit, Clone, Delete. Keep the `.toggle-wrapper` click/keydown `stopPropagation()` handlers. Keep explicit `e.stopPropagation()` as the first statement in each Edit/Clone/Delete Button callback before the domain action.

- [ ] **Step 4: Migrate ConceptDetailModal in place without decomposition**

Replace its four raw tab buttons with:

```svelte
<TabBar variant="dialog" tabs={[{id:'general',label:'General'},{id:'image',label:'Image Augmentations'},{id:'text',label:'Text Augmentations'},{id:'stats',label:'Statistics'}]} active={activeTab} onSelect={(tab)=>(activeTab=tab)}/>
```

Use Buttons for Browse, Datasets, Preview, Refresh Basic, Refresh Advanced, Previous, and Next, retaining classes/titles/disabled conditions. Replace preview checkbox with:

```svelte
<Checkbox id="preview-augmentations" value={previewAugmentations} onChange={(value)=>{ previewAugmentations=value; fetchAugPreview(); }}/>
```

This assignment must remain before `fetchAugPreview()`. Keep `handlePrevPreview` as decrement-then-fetch and `handleNextPreview` as increment-then-fetch. Do not alter API imports, effects, draft initialization, modal nesting, DirectoryPicker, DatasetPickerModal, or any non-control section.

- [ ] **Step 5: Verify behavior and ownership**

Run: `bun run test -- src/lib/components/embeddings/EmbeddingCard.test.ts src/lib/components/concepts && rg -n '<(button|input|select|option|textarea)\b' src/lib/components/embeddings/EmbeddingCard.svelte src/lib/components/concepts`

Expected: tests PASS; `rg` exits 1.

- [ ] **Step 6: Commit Task 10**

```bash
git add web/src/lib/components/embeddings web/src/lib/components/concepts
git commit -m "refactor(web): migrate embedding and concept controls"
```

### Task 11: Repeated Route Structures (3 Violations)

**Files:**
- Modify: `web/src/routes/general/+page.svelte`
- Modify: `web/src/routes/model/+page.svelte`
- Modify: `web/src/routes/training/+page.svelte`
- Modify: `web/src/routes/backup/+page.svelte`
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/embeddings/+page.svelte`
- Modify: `web/src/routes/lora/+page.svelte`
- Modify: `web/src/routes/live/+page.svelte`
- Modify: `web/src/routes/concepts/+page.svelte`
- Modify: `web/src/routes/gallery/+page.svelte`
- Modify: `web/src/routes/datasets/+page.svelte`
- Modify: `web/src/routes/secrets/+page.svelte`
- Test: `web/src/routes/general/page.test.ts`
- Test: `web/src/routes/model/page.test.ts`
- Test: `web/src/routes/training/page.test.ts`
- Test: `web/src/routes/sampling/SamplingPage.test.ts`
- Test: `web/src/routes/embeddings/page.test.ts`
- Test: `web/src/routes/lora/page.test.ts`
- Test: `web/src/routes/live/page.test.ts`
- Test: `web/src/routes/gallery/page.test.ts`
- Test: `web/src/routes/datasets/DatasetsPage.test.ts`

**Interfaces:**
- Consumes: PageHeader, TabBar, Alert, Toast, FormPageSkeleton.
- Produces: shared route presentation while routes retain all state, API, mutation, and navigation ownership.

- [ ] **Step 1: Run route unit tests before migration**

Run: `bun run test -- src/routes`

Expected: PASS.

- [ ] **Step 2: Verify the three route-tab ownership failures are RED**

Run: `rg -n -o '<button\b' src/routes/general/+page.svelte src/routes/model/+page.svelte src/routes/training/+page.svelte | wc -l`

Expected: prints `3`.

- [ ] **Step 3: Replace exact repeated structures**

- General: `<PageHeader title={tab.label||'General'}/>`; page TabBar with Workspace/Debug/Tensors/Hardware.
- Model: `<PageHeader title={tab.label||'Model'}/>`; page TabBar with Model/Output/Quant/Text/VAE.
- Training: `<PageHeader title={tab.label||'Training'}/>`; page TabBar with Base/Execution/Text/Denoise/Layer/Noise/Masking/Loss.
- Backup: PageHeader with Backup Now and Save Model Now in its `actions` snippet; Toast for operation state.
- Sampling: PageHeader with Sample Now action; Toast for operation state; Alert tone `info` for queued changes.
- Embeddings: PageHeader; Alert tone `warning` for unsupported model.
- LoRA: PageHeader; Alert tone `warning` for inactive training method.
- Live: PageHeader with its status badge in `status`; Toast for operation state; Alert tone `error` for training error.
- Concepts: PageHeader; Alert tone `error` for query/mutation failure.
- Gallery: PageHeader with Gallery run label/Select in `actions`.
- Datasets: `<PageHeader title="Datasets"/>`.
- Secrets: `<PageHeader title="Secrets & Security Settings"/>`; Alert tone `error` for insecure HTTP; show successful saves with Toast and failed saves with persistent Alert so the existing failure lifetime is unchanged.

Replace loading markup in General, Model, Training, Backup, Sampling, Embeddings, and LoRA with `<FormPageSkeleton/>`. Concepts uses a local `<div role="status" aria-label="Loading concepts">` containing two `<Skeleton height="140px"/>` children. Secrets uses a local `<div role="status" aria-label="Loading secrets">` containing two `<Skeleton height="120px"/>` children. This reserves `FormPageSkeleton` for the repeated schema-page composition.

Delete route-owned `toastTimeout` variables and timeout logic in Backup, Sampling, and Live; `triggerToast` now only assigns state. Render `<Toast message={toast.message} tone={toast.type} onDismiss={()=>(toast=null)}/>` so Toast owns restart/cleanup. In Secrets, remove `setTimeout`; render Toast only for `saveStatus.type==='success'`, and render persistent Alert for `saveStatus.type==='error'`.

- [ ] **Step 4: Remove only the repeated CSS moved into compounds**

Delete repeated structural declarations from the `.page-header` and `.page-title` blocks, but retain route-specific spacing and alignment through a unique class passed to `PageHeader` and a matching `:global(.route-specific-class)` rule. Delete `.skeleton-container`, `.skeleton-row`, `.skeleton-card`, and local `@keyframes pulse` from all nine skeleton routes; delete `.toast-banner` tone blocks from Backup, Sampling, Live, and Secrets; delete route-owned `.alert`/`.alert-error`, `.disabled-warning-banner`, `.security-warning-banner`, and `.error-banner` box styles after preserving their inner icon/text layout classes. Retain route-specific margins around Alert and Toast through consumer wrapper classes so this refactor does not change vertical rhythm.

- [ ] **Step 5: Verify structures and the three migrated raw tab controls**

Run: `bun run test -- src/routes && bun run check`

Expected: PASS and zero diagnostics.

Run: `rg -n '<button\b' src/routes/general/+page.svelte src/routes/model/+page.svelte src/routes/training/+page.svelte`

Expected: exits 1.

- [ ] **Step 6: Commit Task 11**

```bash
git add web/src/routes
git commit -m "refactor(web): consolidate repeated route structures"
```

### Task 12: Remaining Route Controls (24 Violations)

**Files:**
- Modify: `web/src/routes/backup/+page.svelte`
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/embeddings/+page.svelte`
- Modify: `web/src/routes/datasets/+page.svelte`
- Modify: `web/src/routes/datasets/[id]/+page.svelte`
- Modify: `web/src/routes/login/+page.svelte`
- Modify: `web/src/routes/secrets/+page.svelte`
- Test: `web/src/routes/sampling/SamplingPage.test.ts`
- Test: `web/src/routes/embeddings/page.test.ts`
- Test: `web/src/routes/datasets/DatasetsPage.test.ts`
- Test: `web/src/routes/datasets/[id]/DatasetDetailPage.test.ts`
- Create: `web/src/routes/login/page.test.ts`
- Create: `web/src/routes/secrets/page.test.ts`

**Interfaces:**
- Consumes: all leaves and compounds.
- Produces: zero route-owned native controls with unchanged API payloads and event timing.

- [ ] **Step 1: Add exact route behavior tests**

```ts
// login/page.test.ts
import{fireEvent,render,screen}from'@testing-library/svelte';import{beforeEach,expect,it,vi}from'vitest';import Page from'./+page.svelte';
beforeEach(()=>vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({detail:'Invalid password'})})));
it('keeps required autofocus password and explicit submit behavior',async()=>{render(Page);const input=screen.getByLabelText('Password');expect(input).toBeRequired();expect(input).toHaveAttribute('autofocus');await fireEvent.input(input,{target:{value:'bad'}});const submit=screen.getByRole('button',{name:'Sign In'});expect(submit).toHaveAttribute('type','submit');await fireEvent.click(submit);expect(fetch).toHaveBeenCalledWith('/api/auth/login',expect.objectContaining({method:'POST',body:JSON.stringify({password:'bad'})}));expect(await screen.findByRole('alert')).toHaveTextContent('Invalid password')});
```

```ts
// secrets/page.test.ts
import{fireEvent,render,screen}from'@testing-library/svelte';import{beforeEach,expect,it,vi}from'vitest';import Page from'./+page.svelte';
beforeEach(()=>vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({huggingface_token:'',huggingface_token_set:false,webui_password_set:false})})));
it('keeps password visibility names and saves exact secret payloads',async()=>{render(Page);expect(await screen.findByLabelText('API Token')).toHaveAttribute('type','password');await fireEvent.click(screen.getByRole('button',{name:'Show token'}));expect(screen.getByLabelText('API Token')).toHaveAttribute('type','text');await fireEvent.input(screen.getByLabelText('API Token'),{target:{value:'hf_x'}});await fireEvent.click(screen.getByRole('button',{name:'Save Token'}));expect(fetch).toHaveBeenLastCalledWith('/api/secrets',expect.objectContaining({method:'POST',body:JSON.stringify({huggingface_token:'hf_x'})}))});
```

- [ ] **Step 2: Run relevant route tests before migration**

Run: `bun run test -- src/routes/datasets src/routes/sampling src/routes/embeddings src/routes/login src/routes/secrets`

Expected: all listed behavior tests PASS.

Run: `rg -n -o '<(button|input|select|option|textarea)\b' src/routes/backup/+page.svelte src/routes/sampling/+page.svelte src/routes/embeddings/+page.svelte src/routes/datasets/+page.svelte 'src/routes/datasets/[id]/+page.svelte' src/routes/login/+page.svelte src/routes/secrets/+page.svelte | wc -l`

Expected: prints `24`, the RED ownership state after Task 11 has removed the three route tab buttons.

- [ ] **Step 3: Apply exact route mappings**

- Backup: secondary Buttons for Backup Now and Save Model Now with existing disabled expressions/titles.
- Sampling: secondary Buttons for Sample Now and Add Config; TextInput for `newConfigName`, assigning value on input and preserving Enter `preventDefault()` then create; persistent modal creation errors use `Alert tone="error"`.
- Embeddings: secondary Button for Enable/Disable All; primary Buttons for both Add Embedding locations.
- Datasets list: ghost icon Button for delete retaining `(e)=>handleDeleteDataset(e,ds.name)` so stop/prevent occur; TextInput for dataset name; persistent creation errors use `Alert tone="error"`.
- Dataset detail: `let fileInput=$state<{open:()=>void}|null>(null)`; primary Button calls `fileInput?.open()`; FileInput retains exact accept/multiple and `onChange={(files)=>files&&handleFileUpload(files)}`; ghost Button roots for card image and lightbox close; TextArea uses `value={item.caption_content}` and `onBlur={(value)=>handleCaptionSave(name,value)}`. Keep drag/drop FileList path unchanged.
- Login: TextInput type password, value/onInput, required, autofocus; primary large Button with explicit `type="submit"`; use warning Alert for insecure HTTP and error Alert for login failure. Preserve the form `onsubmit` handler, JSON body, and persistent failure lifetime.
- Secrets: TextInput type switches for token/password with `autocomplete="off"`; ghost icon Buttons retain changing aria-labels; primary Buttons save; danger Button clears. Preserve save payloads, clear-after-save ordering, success Toast, and persistent error Alert established in Task 11.

- [ ] **Step 4: Verify all route behavior and ownership**

Run: `bun run test -- src/routes && rg -n '<(button|input|select|option|textarea)\b' src/routes --glob '*.svelte'`

Expected: route tests PASS; `rg` exits 1 with no raw native controls in routes.

- [ ] **Step 5: Commit Task 12**

```bash
git add web/src/routes
git commit -m "refactor(web): migrate remaining route controls"
```

### Task 13: Compiler Boundary and Stale CSS Cleanup

**Files:**
- Create: `web/src/lib/components/native-control-boundary.test.ts`
- Modify: migrated Svelte files only to remove the exact stale selectors below.

**Interfaces:**
- Consumes: Svelte compiler `parse(source,{filename,modern:true})`, recursive `ast.fragment` traversal, and Vite `import.meta.glob` raw source map.
- Produces: a mechanical allowlist failure naming every forbidden tag/file.

- [ ] **Step 1: Add the boundary test with an intentionally incomplete traversal to verify RED**

Create the test below with `visit` temporarily defined as `const visit=()=>{};`.

```ts
// web/src/lib/components/native-control-boundary.test.ts
import{parse}from'svelte/compiler';import{describe,expect,it}from'vitest';
const allowed=new Set(['/src/lib/components/ui/Button.svelte','/src/lib/components/form/TextInput.svelte','/src/lib/components/form/NumberInput.svelte','/src/lib/components/form/Checkbox.svelte','/src/lib/components/form/Toggle.svelte','/src/lib/components/form/TextArea.svelte','/src/lib/components/form/FileInput.svelte','/src/lib/components/form/RangeInput.svelte','/src/lib/components/form/Select.svelte']);
const native=new Set(['button','input','select','option','textarea']);
const sources=import.meta.glob('/src/**/*.svelte',{query:'?raw',import:'default',eager:true}) as Record<string,string>;

function findNative(source:string,filename:string):string[]{
  const ast=parse(source,{filename,modern:true});const found:string[]=[];const seen=new WeakSet<object>();
  const visit=(node:unknown):void=>{};
  visit(ast.fragment);return found;
}

describe('native control ownership',()=>{
  it('detects forbidden native markup through the modern fragment AST',()=>{
    expect(findNative('<script>const sample="<button>";</script><!-- <input> --><section><button>Save</button></section>','fixture.svelte')).toEqual(['fixture.svelte:1 <button>']);
  });
  it('allows native controls only in explicit leaves',()=>{
    const violations=Object.entries(sources).flatMap(([file,source])=>allowed.has(file)?[]:findNative(source,file));
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the boundary test to verify RED**

Run: `bun run test -- src/lib/components/native-control-boundary.test.ts`

Expected: FAIL; synthetic test receives `[]` instead of `['fixture.svelte:1 <button>']`.

- [ ] **Step 3: Implement recursive traversal of `ast.fragment`**

Replace `visit` with:

```ts
const visit=(node:unknown):void=>{
  if(!node||typeof node!=='object'||seen.has(node))return;
  seen.add(node);
  if(Array.isArray(node)){for(const child of node)visit(child);return;}
  const record=node as Record<string,unknown>;
  if(record.type==='RegularElement'&&typeof record.name==='string'&&typeof record.start==='number'&&native.has(record.name)){const line=source.slice(0,record.start).split('\n').length;found.push(`${filename}:${line} <${record.name}>`);}
  for(const value of Object.values(record))visit(value);
};
```

- [ ] **Step 4: Run the boundary test to verify GREEN and confirm the original baseline**

Run: `bun run test -- src/lib/components/native-control-boundary.test.ts`

Expected: PASS, 2 tests. If the ownership test reports violations, fix the named migration rather than widening the allowlist.

The historical baseline this test replaces is exactly 146 raw tags in 38 files, minus 9 tags in the four pre-existing allowed leaves (`TextInput`, `NumberInput`, `Toggle`, `Select`), yielding 137 violations in 34 files. Do not change the allowlist to absorb a feature or composite.

- [ ] **Step 5: Remove demonstrably stale selectors**

Delete these exact unused selectors after confirming no matching markup remains: Header `.actions`, `.modal-overlay`, `.modal-content`, `.modal-actions`, `.training-bar`, `.custom-dropdown-container`, `.dropdown-trigger`, `.dropdown-popover`, `.popover-option`, `.sr-only-select`; SampleGallery `.sort-select`; EmbeddingCard `.select-input`; Field, SchemaForm, and ConceptDetailModal descendant `.select-input` selectors; route selectors already enumerated in Task 11. For migrated feature classes that remain on leaf native roots, keep their selectors and use `:global(.class)` rather than deleting them. Do not normalize any other token or style.

- [ ] **Step 6: Run boundary, check, and unit suite**

Run: `bun run check && bun run test`

Expected: `svelte-check found 0 errors and 0 warnings`; all Vitest files PASS, including ownership.

- [ ] **Step 7: Commit Task 13**

```bash
git add web/src/lib/components/native-control-boundary.test.ts web/src/lib/components/shell/Header.svelte web/src/lib/components/training/SampleGallery.svelte web/src/lib/components/embeddings/EmbeddingCard.svelte web/src/lib/components/form/Field.svelte web/src/lib/components/form/SchemaForm.svelte web/src/lib/components/concepts/ConceptDetailModal.svelte
git commit -m "test(web): enforce native control ownership"
```

### Task 14: Current Playwright Flows and Full Verification

**Files:**
- Modify: `web/e2e/phase-a.spec.ts`
- Modify: `web/e2e/phase-b.spec.ts`
- Modify: `web/e2e/phase-c.spec.ts`
- Modify: `web/e2e/mobile.spec.ts`
- Modify: `web/e2e/firefox-smoke.spec.ts`
- Modify: `web/e2e/console.spec.ts`

**Interfaces:**
- Consumes: current app routes/accessibility and `web/build` fixture.
- Produces: current desktop, phone, and Firefox smoke coverage; no application code.

- [ ] **Step 1: Build and demonstrate the stale Playwright expectations are RED**

Run: `bun run build && bun run e2e -- --project=chromium-desktop`

Expected: FAIL with current-behavior mismatches including root expected `/general` instead of `/live`, stale `/data`/Data navigation, stale optimizer or concept selectors, and `Jump to latest` instead of `Latest`. Record external-service failures separately from these deterministic stale assertions.

- [ ] **Step 2: Make the exact stale E2E corrections**

- `phase-a.spec.ts`: rename the first test to root redirects to Live; expect `/live`. Replace every `/data`, `Data`, and `a[href="/data"]` expectation with `/datasets`, `Datasets`, and `getByRole('link',{name:'Datasets'})`. Keep General/Backup history assertions with the corrected Datasets URL. Replace every successful-save `.state-badge` text assertion with `getByTestId('saved-icon-badge')`; for the invalid-number case assert the edited value remains visible and the saved icon is absent. Keep `Conflict` on `.state-badge`. Use separate `getByRole('button',{name:'Reload'})` and `getByRole('button',{name:'Overwrite'})` locators. Open the preset dialog with `page.locator('.header-left').getByRole('button',{name:'Save'})`, fill `getByLabel('Preset Name')`, then click the dialog-scoped Save button.
- `phase-b.spec.ts`: expect root `/live`; open optimizer with `getByTitle('Configure advanced optimizer parameters')`; use `dialog.locator('#param-beta1')`, fill `0.8`, and click `Apply Parameters`. Before the concept flow, run `const reset=await page.request.put('/api/concepts',{data:{concepts:[]}}); expect(reset.ok()).toBeTruthy();` so persisted `.e2e` state cannot change the empty-state action. Replace stale `#instance-prompt-0`/`Save Changes` flow with `getByRole('button',{name:'Add First Concept'})`, modal `getByLabel('Name')` set to `E2E Concept`, `getByRole('button',{name:'Save Concept Settings'})`, and visible `E2E Concept` card.
- `phase-c.spec.ts`: after `/`, directly expect `/live`; remove the redundant Live link click; use `getByRole('button',{name:'Start Training'})`.
- `mobile.spec.ts`: navigate via `drawer.getByRole('link',{name:'Datasets'})`; expect `/datasets`; use `getByRole('button',{name:'Open navigation'})`, `getByRole('button',{name:'Close navigation'})`, `getByRole('button',{name:'Browse directory'}).first()`, and `modal.getByRole('button',{name:'Select Folder'})`; retain current DirectoryPicker focus-trap and restoration assertions.
- `firefox-smoke.spec.ts`: replace General/Data/Backup with General/Datasets/Backup and `/datasets`; assert `getByRole('heading',{level:1,name:'General'})`, `getByRole('heading',{level:1,name:'Datasets'})`, and `getByRole('heading',{level:1,name:'Backup'})` after their respective navigations.
- `console.spec.ts`: replace `button:has-text("Jump to latest")` with `getByRole('button',{name:'Latest'})`; use `getByPlaceholder('Filter console...')` and `getByTitle('Toggle Console Drawer')`.

- [ ] **Step 3: Run unit/static verification before browser build**

Run: `bun run check && bun run test`

Expected: zero Svelte diagnostics and all Vitest tests PASS.

- [ ] **Step 4: Build the fixture before Playwright**

Run: `bun run build`

Expected: Vite/SvelteKit production build succeeds and refreshes `web/build`.

- [ ] **Step 5: Run Chromium desktop flows**

Run: `bun run e2e -- --project=chromium-desktop`

Expected: phase-a, phase-b, phase-c, and console specs PASS. Report any failure that requires an unavailable external service with the failing test name and service response; do not skip it silently.

- [ ] **Step 6: Run phone and Firefox flows**

Run: `bun run e2e -- --project=webkit-phone && bun run e2e -- --project=firefox-smoke`

Expected: mobile and Firefox smoke specs PASS, subject only to explicitly reported unavailable external services.

- [ ] **Step 7: Reconfirm the exact ownership boundary**

Run: `bun run test -- src/lib/components/native-control-boundary.test.ts && rg -l '<(button|input|select|option|textarea)\b' src --glob '*.svelte' | sort`

Expected: boundary tests PASS; `rg` lists exactly the nine allowlisted leaf files and no others.

- [ ] **Step 8: Commit Task 14**

```bash
git add web/e2e/phase-a.spec.ts web/e2e/phase-b.spec.ts web/e2e/phase-c.spec.ts web/e2e/mobile.spec.ts web/e2e/firefox-smoke.spec.ts web/e2e/console.spec.ts
git commit -m "test(web): update current UI browser flows"
```

## Coverage Ledger

| Task | Files made boundary-compliant | Violations removed |
|---|---:|---:|
| 5 | 8 | 14 |
| 6 | 5 | 24 |
| 7 | 1 | 10 |
| 8 | 5 | 14 |
| 9 | 2 | 21 |
| 10 | 3 | 27 |
| 11 | 3 route tab files | 3 |
| 12 | 7 route areas / 8 files | 24 |
| **Total** | **34 distinct violating files** | **137** |

The 34-file total counts files once across Tasks 5-12; Task 11 also updates repeated structures in raw-control-free routes. The final boundary permits the nine leaf files only, including all six native tags intentionally retained inside `Select.svelte`.
