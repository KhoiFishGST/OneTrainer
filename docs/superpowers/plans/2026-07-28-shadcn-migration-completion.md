# shadcn-svelte Migration Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the shadcn-svelte migration by removing all 286 parent-to-child `:global()` overrides, making the phone 44px target and colour contrast intrinsic to the canonical components, and fixing the correctness and test-trustworthiness defects the overrides were hiding.

**Architecture:** Accessibility invariants move from low-specificity global CSS into the canonical component variant definitions, so no consumer stylesheet can defeat them. Application components then style themselves through `variant`/`size`/`class` props only. Correctness bugs land first so they are not buried in the refactor; new static and browser-level tests land before the cutover so the cutover has a safety net once the visual baselines are invalidated.

**Tech Stack:** Svelte 5, SvelteKit 2, TypeScript, shadcn-svelte/Bits UI, Tailwind CSS v4, TanStack Svelte Query, Vitest, Testing Library, Playwright, axe-core, Bun.

---

## Global Constraints

- Baseline for this work is `77dddf21`. Spec: `docs/superpowers/specs/2026-07-28-shadcn-migration-completion-design.md`.
- Preserve route URLs, backend payload shapes, saved configuration formats, callback ordering, and existing persistence keys.
- Phone behaviour is below `768px`; desktop behaviour starts at `768px`.
- Native controls remain restricted to `web/src/lib/components/ui/`.
- No new legacy token aliases and no new parent-to-child styling overrides.
- Do not weaken tests to accommodate defects. Add a failing reproduction before each fix.
- All commands run from `web/` unless stated otherwise.
- Do not modify the untracked `.github/hooks/` directory.

## Environment Notes

Two facts constrain how tests are written; violating either produces a test that passes for the wrong reason:

1. **jsdom performs no layout.** `getBoundingClientRect()` returns zeros. Element size can only be asserted in a real browser (Playwright).
2. **`src/app.css` is not imported by `vitest-setup.ts`.** Design tokens do not exist in the jsdom CSSOM, so `getComputedStyle(el).color` cannot resolve them.

Therefore: size assertions live in Playwright, token contrast is asserted by parsing `src/app.css` as text, and Vitest covers logic and source-level lint rules.

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/lib/theme/token-contrast.test.ts` | Parses `src/app.css`, asserts every foreground/surface pair meets WCAG AA in both themes |
| `src/lib/components/style-boundary.test.ts` | Source lint: forbids `min-height: 0` and non-ANSI `:global()` in `.svelte` files |
| `e2e/touch-targets.spec.ts` | Phone-project browser test asserting real 44×44 boxes |

**Modified (grouped by task):** listed per task below.

---

## Phase 1 — Correctness bugs

### Task 1: Fix sampling identity and the silent delete

**Files:**
- Modify: `web/src/routes/sampling/+page.svelte`
- Modify: `web/src/routes/sampling/SamplingPage.test.ts`

**Interfaces:**
- `resolveSampleIndex(target: any): number` returns the current array index of a sample, matched by `webui_id` when present and by object reference otherwise, or `-1`.
- Every mutation path resolves its target immediately before constructing the payload.
- A target that can no longer be found produces a user-visible error, never a success toast.

- [ ] **Step 1: Add the reorder regression test**

Append inside the top-level `describe('SamplingPage', ...)` block in `web/src/routes/sampling/SamplingPage.test.ts`:

```ts
it('writes the edited prompt by identity after the list reorders', async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  (createUpdateSamplesMutation as any).mockReturnValue(
    writable({ mutateAsync, isPending: false })
  );
  const samplesStore = writable({ data: { samples: mockSamples }, isLoading: false });
  (createSamplesQuery as any).mockReturnValue(samplesStore);

  render(SamplingPage);

  const editButtons = await screen.findAllByRole('button', { name: /edit/i });
  await fireEvent.click(editButtons[0]);

  // The query refetches and returns the same samples in the opposite order
  // while the editor for prompt_1 is still open.
  await act(() => {
    samplesStore.set({
      data: { samples: [mockSamples[1], mockSamples[0]] },
      isLoading: false,
    });
  });

  const saveButton = await screen.findByRole('button', { name: /^save$/i });
  await fireEvent.click(saveButton);

  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  const written = mutateAsync.mock.calls[0][0].samples;
  const edited = written.find((s: any) => s.webui_id === 'prompt_1');
  const untouched = written.find((s: any) => s.webui_id === 'prompt_2');
  expect(edited).toBeDefined();
  expect(untouched.prompt).toBe(mockSamples[1].prompt);
});
```

- [ ] **Step 2: Add the vanished-target delete test**

Append in the same describe block:

```ts
it('reports an error instead of a false success when the delete target is gone', async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  (createUpdateSamplesMutation as any).mockReturnValue(
    writable({ mutateAsync, isPending: false })
  );
  const samplesStore = writable({ data: { samples: mockSamples }, isLoading: false });
  (createSamplesQuery as any).mockReturnValue(samplesStore);

  render(SamplingPage);

  const deleteButtons = await screen.findAllByRole('button', { name: /delete/i });
  await fireEvent.click(deleteButtons[0]);

  // The sample disappears server-side while the confirmation is open.
  await act(() => {
    samplesStore.set({ data: { samples: [mockSamples[1]] }, isLoading: false });
  });

  const confirm = await screen.findByRole('button', { name: /^delete$/i });
  await fireEvent.click(confirm);

  await waitFor(() => {
    expect(sonnerToast.success).not.toHaveBeenCalledWith('Sample prompt deleted');
  });
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Add the edit-success feedback test**

Append in the same describe block:

```ts
it('reports success after an inline row edit commits', async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  (createUpdateSamplesMutation as any).mockReturnValue(
    writable({ mutateAsync, isPending: false })
  );
  (createSamplesQuery as any).mockReturnValue(
    writable({ data: { samples: mockSamples }, isLoading: false })
  );

  render(SamplingPage);

  const widthInputs = await screen.findAllByLabelText(/width/i);
  await fireEvent.input(widthInputs[0], { target: { value: '640' } });
  await fireEvent.change(widthInputs[0], { target: { value: '640' } });

  await waitFor(() =>
    expect(sonnerToast.success).toHaveBeenCalledWith('Sample prompt updated')
  );
});
```

- [ ] **Step 4: Run the tests and verify all three fail**

```bash
bun run test -- src/routes/sampling/SamplingPage.test.ts
```

Expected: the reorder test writes the wrong prompt, the vanished-target test sees a success toast and a `mutateAsync` call, and the edit test finds no success toast.

- [ ] **Step 5: Add the identity resolver**

In `web/src/routes/sampling/+page.svelte`, add next to `getSampleIdentity`:

```ts
function resolveSampleIndex(target: any): number {
  if (!target) return -1;
  return samples.findIndex(
    (s: any) => s === target || (s.webui_id && s.webui_id === target.webui_id)
  );
}
```

- [ ] **Step 6: Resolve edit and modal-save by identity**

Replace `handleUpdateSample` and `handleSaveSampleModal` with:

```ts
async function handleUpdateSample(index: number, updatedSample: any) {
  const target = samples[index];
  const currentIndex = resolveSampleIndex(target);
  if (currentIndex === -1) {
    triggerToast('That sample prompt no longer exists', 'error');
    return;
  }
  const updated = samples.map((s: any, i: number) =>
    i === currentIndex ? updatedSample : s
  );
  try {
    await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
    const identity = getSampleIdentity(target, currentIndex);
    if (drafts[identity]) {
      delete drafts[identity];
    }
    triggerToast('Sample prompt updated', 'success');
  } catch (err: any) {
    triggerToast(err?.message || 'Failed to update sample prompt', 'error');
  }
}

async function handleSaveSampleModal(sampleData: any) {
  let updated: any[];
  if (modalMode === 'add') {
    updated = [...samples, sampleData];
  } else {
    const currentIndex = resolveSampleIndex(editingSample);
    if (currentIndex === -1) {
      triggerToast('That sample prompt no longer exists', 'error');
      return;
    }
    updated = samples.map((s: any, i: number) =>
      i === currentIndex ? sampleData : s
    );
  }
  try {
    await $updateSamplesMutation.mutateAsync({ samples: updated, file: currentConfigFile });
    isModalOpen = false;
    triggerToast(
      modalMode === 'add' ? 'Sample prompt added' : 'Sample prompt updated',
      'success'
    );
  } catch (err: any) {
    triggerToast(err?.message || 'Failed to save sample prompt', 'error');
  }
}
```

`editingSample` is already assigned in `handleEditSample`; it is now the identity source rather than `editingIndex`.

- [ ] **Step 7: Guard the delete path**

In `confirmDeleteSample`, replace the `targetIndex`/`updated` computation and the block that follows with:

```ts
const targetIndex = resolveSampleIndex(sampleToDeleteTarget);
if (targetIndex === -1) {
  deleteSampleError = 'That sample prompt no longer exists';
  isDeletingSample = false;
  return;
}
const updated = samples.filter((_: any, i: number) => i !== targetIndex);
```

Leave the existing `try`/`catch`/`finally` intact below it.

- [ ] **Step 8: Run the tests and verify they pass**

```bash
bun run test -- src/routes/sampling/SamplingPage.test.ts src/lib/components/sampling
bun run check
```

Expected: all sampling tests pass; `check` reports no new errors.

- [ ] **Step 9: Commit**

```bash
git add web/src/routes/sampling/+page.svelte web/src/routes/sampling/SamplingPage.test.ts
git commit -m "fix(web): resolve sample mutations by identity"
```

---

### Task 2: Stop `normalizeConceptDraft` inventing keys

**Files:**
- Modify: `web/src/lib/components/concepts/concept-draft.ts:35-50`
- Modify: `web/src/lib/components/concepts/concept-draft.test.ts`

**Interfaces:**
- `normalizeConceptDraft` normalizes only paths whose final key is present on the source object; absent keys stay absent.

- [ ] **Step 1: Add the key-injection regression test**

Append to `web/src/lib/components/concepts/concept-draft.test.ts`:

```ts
it('does not add numeric keys that were absent from the source draft', () => {
  const sparse: any = { name: 'Sparse Concept', path: '/data/sparse' };

  const result: any = normalizeConceptDraft(sparse);

  expect(result).toEqual({ name: 'Sparse Concept', path: '/data/sparse' });
  expect('image_variations' in result).toBe(false);
  expect('balancing' in result).toBe(false);
  expect('loss_weight' in result).toBe(false);
});

it('normalizes a nested key only when its parent object exists', () => {
  const withImage: any = {
    name: 'Partial',
    image: { random_rotate_max_angle: '12.5' },
  };

  const result: any = normalizeConceptDraft(withImage);

  expect(result.image.random_rotate_max_angle).toBe(12.5);
  expect('random_brightness_max_strength' in result.image).toBe(false);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
bun run test -- src/lib/components/concepts/concept-draft.test.ts
```

Expected: FAIL — the result gains `image_variations: 1`, `balancing: 1`, `loss_weight: 1`, and `image.random_brightness_max_strength: 0`.

- [ ] **Step 3: Skip absent keys**

In `web/src/lib/components/concepts/concept-draft.ts`, replace the assignment block inside the `for (const { path, normalize } of NUMERIC_PATHS)` loop with:

```ts
    let current: any = result;
    let reachable = true;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current || typeof current !== 'object' || !(path[i] in current)) {
        reachable = false;
        break;
      }
      current = current[path[i]];
    }
    if (!reachable || !current || typeof current !== 'object') continue;
    const lastKey = path[path.length - 1];
    if (!(lastKey in current)) continue;
    current[lastKey] = normalize(current[lastKey]);
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
bun run test -- src/lib/components/concepts
bun run check
```

Expected: all concept tests pass, including the pre-existing normalization cases.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/concepts/concept-draft.ts web/src/lib/components/concepts/concept-draft.test.ts
git commit -m "fix(web): preserve absent keys through concept normalization"
```

---

### Task 3: Give `ValueSelect` a sentinel for empty values

**Files:**
- Modify: `web/src/lib/components/form/ValueSelect.svelte:56-77`
- Modify: `web/src/lib/components/form/ValueSelect.test.ts`

**Interfaces:**
- When no option matches the current value and no placeholder is supplied, a disabled sentinel is rendered and selected. The browser never visually selects a valid option the application did not choose.

- [ ] **Step 1: Add the empty-value regression test**

Append to `web/src/lib/components/form/ValueSelect.test.ts`:

```ts
it('does not visually select the first option when value is empty and no placeholder exists', () => {
  const options = [
    { value: 'alpha', label: 'Alpha' },
    { value: 'beta', label: 'Beta' },
  ];

  render(ValueSelect, { props: { value: '', options, ariaLabel: 'Choice' } });

  const select = screen.getByLabelText('Choice') as HTMLSelectElement;
  expect(select.selectedOptions[0]?.textContent?.trim()).not.toBe('Alpha');
  expect(select.selectedOptions[0]?.disabled).toBe(true);
});

it('still shows the placeholder when one is supplied', () => {
  const options = [{ value: 'alpha', label: 'Alpha' }];

  render(ValueSelect, {
    props: { value: '', options, placeholder: 'Pick one...', ariaLabel: 'Choice' },
  });

  const select = screen.getByLabelText('Choice') as HTMLSelectElement;
  expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Pick one...');
});
```

- [ ] **Step 2: Run the test and verify the first case fails**

```bash
bun run test -- src/lib/components/form/ValueSelect.test.ts
```

Expected: FAIL — with an empty value and no placeholder, `selectedOptions[0]` is the enabled `Alpha` option.

- [ ] **Step 3: Extend the sentinel to the empty case**

In `web/src/lib/components/form/ValueSelect.svelte`, replace the `isUnknown` and `selectedSelectValue` deriveds with:

```ts
  const hasNoSelection = $derived(selectedIndex === -1);

  const isUnknown = $derived(
    hasNoSelection && value !== undefined && value !== null && value !== ''
  );

  const isEmptyWithoutPlaceholder = $derived(hasNoSelection && !isUnknown && !placeholder);

  const selectedSelectValue = $derived(
    !hasNoSelection
      ? String(selectedIndex)
      : isUnknown || isEmptyWithoutPlaceholder
        ? '__unknown__'
        : ''
  );
```

Then change the sentinel option's guard and label:

```svelte
  {#if isUnknown || isEmptyWithoutPlaceholder}
    <NativeSelectOption value="__unknown__" disabled selected={true}>
      {isUnknown ? `Unknown: ${String(value)}` : 'Select...'}
    </NativeSelectOption>
  {/if}
```

`handleChange` already ignores `__unknown__`, so no change is needed there.

- [ ] **Step 4: Run the tests and verify they pass**

```bash
bun run test -- src/lib/components/form/ValueSelect.test.ts src/lib/components/form/SchemaForm.test.ts src/lib/components/shell/Header.test.ts
bun run check
```

Expected: all pass. `SchemaForm` and `Header` are included because they are the heaviest `ValueSelect` consumers.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/form/ValueSelect.svelte web/src/lib/components/form/ValueSelect.test.ts
git commit -m "fix(web): render a sentinel for unselected select values"
```

---

## Phase 2 — Token and variant foundation

### Task 4: Add semantic status tokens with verified contrast

**Files:**
- Modify: `web/src/app.css`
- Create: `web/src/lib/theme/token-contrast.test.ts`

**Interfaces:**
- `--success`, `--warning`, `--info` each define `-foreground` and `-surface` companions; `--destructive-surface` joins the existing destructive pair.
- Every `<name>-foreground` on `<name>-surface` pair reaches 4.5:1 in both `:root` and `.dark`.

- [ ] **Step 1: Write the failing contrast test**

Create `web/src/lib/theme/token-contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const cssSource = import.meta.glob('/src/app.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_CSS = Object.values(cssSource)[0];

function blockFor(selector: string): string {
  const start = APP_CSS.indexOf(selector + ' {');
  if (start === -1) throw new Error(`No ${selector} block in app.css`);
  const end = APP_CSS.indexOf('\n}', start);
  return APP_CSS.slice(start, end);
}

function readToken(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`));
  if (!match) throw new Error(`Token --${name} is not defined as a hex value`);
  return match[1];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const full = hex.length === 4
    ? '#' + [...hex.slice(1)].map((c) => c + c).join('')
    : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = ['success', 'warning', 'info', 'destructive'];
const THEMES = [':root', '.dark'];

describe('semantic status tokens', () => {
  for (const theme of THEMES) {
    for (const name of PAIRS) {
      // Tinted usage: text is --X on the pale/dark --X-surface.
      it(`${name} reaches AA on its own surface in ${theme}`, () => {
        const block = blockFor(theme);
        expect(
          contrastRatio(readToken(block, name), readToken(block, `${name}-surface`))
        ).toBeGreaterThanOrEqual(4.5);
      });

      // Solid usage: text is --X-foreground on a solid --X fill.
      it(`${name}-foreground reaches AA on solid ${name} in ${theme}`, () => {
        const block = blockFor(theme);
        expect(
          contrastRatio(readToken(block, `${name}-foreground`), readToken(block, name))
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('registers every status token in the @theme inline block', () => {
    const theme = blockFor('@theme inline');
    for (const name of PAIRS) {
      expect(theme).toContain(`--color-${name}-surface: var(--${name}-surface);`);
      expect(theme).toContain(`--color-${name}-foreground: var(--${name}-foreground);`);
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
bun run test -- src/lib/theme/token-contrast.test.ts
```

Expected: FAIL with "Token --success-foreground is not defined as a hex value".

- [ ] **Step 3: Define the tokens**

In `web/src/app.css`, add to the `:root` block after `--ring: #1d4ed8;`:

```css
  --success: #067647;
  --success-foreground: #ffffff;
  --success-surface: #e7f6ee;
  --warning: #b54708;
  --warning-foreground: #ffffff;
  --warning-surface: #fdf1e7;
  --info: #175cd3;
  --info-foreground: #ffffff;
  --info-surface: #e8f0fd;
  --destructive-surface: #fdeaea;
```

In the same `:root` block, **change** the existing destructive value:

```css
  --destructive: #b91c1c;   /* was #dc2626 — 4.18:1 on --destructive-surface, below AA */
```

Add to the `.dark` block after `--ring: #60a5fa;`:

```css
  --success: #4ade80;
  --success-foreground: #0c1118;
  --success-surface: #10241a;
  --warning: #fbbf24;
  --warning-foreground: #0c1118;
  --warning-surface: #2a1d05;
  --info: #60a5fa;
  --info-foreground: #0c1118;
  --info-surface: #0f1e33;
  --destructive-surface: #2a1215;
```

In the same `.dark` block, **change** the existing destructive foreground:

```css
  --destructive-foreground: #0c1118;   /* was #ffffff — 3.76:1 on --destructive, below AA */
```

These two changes are intentional and visible: the light destructive red darkens slightly, and text on a solid destructive fill in dark theme becomes dark rather than white. Both are required to reach AA; the dark theme's bright `#ef4444` cannot carry white text.

Verified ratios for these values — the test recomputes them, so treat this as a starting point rather than an authority:

| Theme | Pair | Ratio |
|---|---|---|
| light | `success` on `success-surface` | 5.11 |
| light | `warning` on `warning-surface` | 4.89 |
| light | `info` on `info-surface` | 5.20 |
| light | `destructive` on `destructive-surface` | 5.65 |
| dark | `success` on `success-surface` | 9.44 |
| dark | `warning` on `warning-surface` | 9.97 |
| dark | `info` on `info-surface` | 6.60 |
| dark | `destructive` on `destructive-surface` | 4.67 |

- [ ] **Step 4: Register the tokens with Tailwind**

In the `@theme inline` block, after `--color-destructive-foreground: var(--destructive-foreground);`, add:

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-success-surface: var(--success-surface);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-warning-surface: var(--warning-surface);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-info-surface: var(--info-surface);
  --color-destructive-surface: var(--destructive-surface);
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
bun run test -- src/lib/theme/token-contrast.test.ts
```

Expected: PASS, 9 tests. If any pair falls short, darken the light foreground or lighten the dark foreground until it clears 4.5 — do not lower the threshold.

- [ ] **Step 6: Commit**

```bash
git add web/src/app.css web/src/lib/theme/token-contrast.test.ts
git commit -m "feat(web): add contrast-verified semantic status tokens"
```

---

### Task 5: Make the phone touch target intrinsic to canonical components

**Files:**
- Modify: `web/src/lib/components/ui/button/button.svelte:6-32`
- Modify: `web/src/lib/components/ui/input/input.svelte`
- Modify: `web/src/lib/components/ui/native-select/native-select.svelte`
- Modify: `web/src/lib/components/ui/textarea/textarea.svelte`
- Modify: `web/src/lib/components/ui/checkbox/checkbox.svelte`
- Modify: `web/src/lib/components/ui/switch/switch.svelte`
- Modify: `web/src/lib/components/ui/sidebar/sidebar.svelte`
- Create: `web/src/lib/components/style-boundary.test.ts`

**Interfaces:**
- Every canonical interactive component renders a ≥44×44 hit area below `768px` without any consumer opting in.
- Small controls (checkbox, switch) expand their hit area with a pseudo-element rather than growing visually, matching the existing slider approach.
- A source-level test forbids the `min-height: 0` pattern that previously defeated the global rule.

- [ ] **Step 1: Write the failing source-lint test**

Create `web/src/lib/components/style-boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const svelteSources = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The one place a :global() escape hatch is legitimate: ANSI spans the
 *  console renderer emits, which the application never authors. */
const ANSI_BOUNDARY = '/src/lib/components/console/ConsoleView.svelte';

export function findMinHeightZero(source: string, filename: string): string[] {
  const violations: string[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    if (/min-height:\s*0\s*(;|$)/.test(line)) {
      violations.push(`${filename}:${i + 1}: min-height: 0 defeats the phone 44px target`);
    }
  });
  return violations;
}

export function findGlobalSelectors(source: string, filename: string): string[] {
  if (filename === ANSI_BOUNDARY) return [];
  const violations: string[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    if (line.includes(':global(')) {
      violations.push(`${filename}:${i + 1}: :global() is a parent-to-child override`);
    }
  });
  return violations;
}

describe('style boundary', () => {
  it('flags min-height: 0 in fixture source', () => {
    const fixture = '  .x :global(.btn) {\n    min-height: 0;\n  }';
    expect(findMinHeightZero(fixture, '/src/x.svelte')).toHaveLength(1);
  });

  it('exempts only the ConsoleView ANSI boundary from the :global() rule', () => {
    const fixture = '  .console-view :global(.fg-red) { color: #ff6b6b; }';
    expect(findGlobalSelectors(fixture, ANSI_BOUNDARY)).toEqual([]);
    expect(findGlobalSelectors(fixture, '/src/other.svelte')).toHaveLength(1);
  });

  it('has no min-height: 0 anywhere in the application', () => {
    const violations = Object.entries(svelteSources).flatMap(([file, source]) =>
      findMinHeightZero(source, file)
    );
    expect(violations).toEqual([]);
  });
});
```

The `:global()` sweep assertion is deliberately omitted here — it is added in Task 11 once the cutover is complete, so the suite stays green between tasks.

- [ ] **Step 2: Run the test and verify the sweep fails**

```bash
bun run test -- src/lib/components/style-boundary.test.ts
```

Expected: the two fixture tests PASS; "has no min-height: 0 anywhere" FAILS listing 27 violations.

- [ ] **Step 3: Bake the target into the Button base**

In `web/src/lib/components/ui/button/button.svelte`, append to the `base` string of `buttonVariants` (before the closing quote):

```
 max-md:min-h-11 max-md:min-w-11
```

- [ ] **Step 4: Repoint the destructive variant at the defined surface**

The `destructive` variant currently composes a tint under token-coloured text — `bg-destructive/10 … text-destructive` — which is the same undefined-contrast composition that fails in `ErrorBanner`. Replace that variant's value in `buttonVariants` with:

```
destructive: "bg-destructive-surface hover:bg-destructive-surface/80 text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 focus-visible:border-destructive/40",
```

Its contrast is now the `destructive` / `destructive-surface` pair that Task 4's test verifies.

- [ ] **Step 5: Bake the target into text controls**

In `input.svelte` (both the `file` and default branches), `native-select.svelte`, and `textarea.svelte`, append to each `cn(` class string:

```
 max-md:min-h-11
```

- [ ] **Step 6: Expand the small-control hit areas**

In `checkbox.svelte` and `switch.svelte`, append to the root element's `cn(` class string:

```
 relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']
```

This mirrors `ui/slider/slider.svelte`, whose `size-3` thumb already reaches 44px through `after:-inset-4`. The visible control does not change size; only the hit area does.

- [ ] **Step 7: Document the sidebar fork**

In `web/src/lib/components/ui/sidebar/sidebar.svelte`, add above the `let { ... } = $props()` declaration:

```svelte
<!--
  LOCAL MODIFICATION: the `mobile` prop below is not part of upstream
  shadcn-svelte. Rail.svelte / RailContent.svelte depend on it to drive the
  off-canvas sheet from the application's own breakpoint state. Re-running
  `shadcn-svelte add sidebar` will revert it and break mobile navigation.
-->
```

- [ ] **Step 8: Run the full suite**

```bash
bun run test
bun run check
bun run build
```

Expected: the `min-height: 0` sweep still fails (27 violations remain until Phase 3); everything else passes, including Task 4's contrast test now that the destructive variant consumes the new token. This is the one intentionally-red gate — it turns green in Task 11.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/components/ui web/src/lib/components/style-boundary.test.ts
git commit -m "feat(web): make phone touch targets intrinsic to canonical UI"
```

---

## Phase 3 — The `:global()` cutover

Every task in this phase follows the same procedure. Read it once; it is not repeated per task.

**Procedure for each file:**

1. Read the `<style>` block and list each `:global()` rule.
2. For each rule, decide:
   - **Purely cosmetic** (padding, radius, background, border on a shadcn component) → delete it and pick the closest stock `variant` / `size`.
   - **Layout** (flex, grid, width, gap on a child) → move to Tailwind utilities in the `class` prop on the component itself.
   - **Semantic colour** (status, success, danger tints) → replace with the Task 4 tokens via Tailwind (`bg-success-surface text-success-foreground`).
   - **Genuinely third-party DOM** → keep, and make the comment name the actual third party. Only `ConsoleView`'s ANSI block qualifies.
3. Delete every `min-height: 0`. Task 5 makes it unnecessary.
4. Delete any rule svelte-check reports as unused.

**Worked example** — `Header.svelte:577-595` before:

```css
  /* Bits UI boundary: style selector header Button component */
  .selectors :global(.header-btn) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    min-height: 0;
    padding: 0 12px;
    background-color: var(--muted, #14191f);
    color: var(--foreground, #e6ebef);
    border: 1px solid var(--border, #2d3741);
  }
```

after — the rule is deleted entirely and the call site becomes:

```svelte
<Button variant="secondary" onclick={handleLoadConfig}>
  <FolderOpen size={15} />
  <span>Load</span>
</Button>
```

**Per-task verification** (run after each task in this phase):

```bash
bun run test -- <the test paths named in that task>
bun run check
rg ":global\(" <the files touched by that task>
```

Expected: named tests pass, no new check warnings, and `rg` returns nothing (except `ConsoleView`'s ANSI block in Task 10).

---

### Task 6: Cut over the shell

**Files:**
- Modify: `web/src/lib/components/shell/Header.svelte` (12 selectors)
- Modify: `web/src/lib/components/shell/RailContent.svelte` (16)
- Modify: `web/src/lib/components/shell/StatusBar.svelte` (13)
- Modify: `web/src/lib/components/shell/ErrorBanner.svelte` (3)
- Modify: `web/src/lib/components/shell/ConsoleDrawer.svelte` (3)
- Modify: `web/src/lib/components/LayoutContent.svelte` (1)
- Test: `web/src/lib/components/shell/*.test.ts`, `web/src/lib/components/LayoutContent.test.ts`

**Interfaces:**
- Status pills and the saved badge use Task 4 tokens; no hex literal remains in shell source.
- Tinted surfaces pair `bg-<name>-surface` with `text-<name>` — never with `text-<name>-foreground`, which is reserved for text on a solid `bg-<name>` fill.

- [ ] **Step 1: Add the status-token regression test**

Append to `web/src/lib/components/shell/Header.test.ts`:

```ts
it('renders status pills with semantic token classes rather than hex colours', async () => {
  trainingStore.setStatus({ state: 'COMPLETED' } as any);
  render(Header, { props: { workspace: null, metaData: {}, presetsData: [] } });

  const pill = await screen.findByTestId('training-status-pill');
  expect(pill.className).toMatch(/success/);
  expect(pill.getAttribute('style') ?? '').not.toMatch(/#[0-9a-fA-F]{6}/);
});
```

Match the import style already used at the top of `Header.test.ts` for `trainingStore`.

- [ ] **Step 2: Run it and verify it fails**

```bash
bun run test -- src/lib/components/shell/Header.test.ts
```

Expected: FAIL — the pill carries `status-completed`, which is defined with `#10b981`.

- [ ] **Step 3: Apply the cutover procedure to all six files**

Follow the procedure above. Specific replacements:

- `Header.svelte:665-712` — replace the seven `.status-*` rules with Tailwind on the pill element:
  - IDLE → `bg-muted text-muted-foreground border-border`
  - STARTING / TRAINING → `bg-info-surface text-info border-info/30`
  - PAUSED → `bg-warning-surface text-warning border-warning/30`
  - STOPPING / FAILED → `bg-destructive-surface text-destructive border-destructive/40`
  - COMPLETED → `bg-success-surface text-success border-success/30`
- `Header.svelte:636-650` — `.saved-icon-badge` colour becomes `text-success`.
- `Header.svelte:557,525-538` — delete the unused `.btn-primary`, `.state-saved`, `.state-unsaved`, `.state-saving` rules.
- `ErrorBanner.svelte:54-88` — delete the whole `<style>` block; the Alert gets `class="bg-destructive-surface text-destructive border-b border-destructive flex items-center justify-between gap-3 px-4 py-2.5 text-sm"` and the dismiss Button becomes `variant="outline" size="sm"`.
- `StatusBar.svelte` / `RailContent.svelte` / `ConsoleDrawer.svelte` / `LayoutContent.svelte` — cosmetic rules deleted in favour of stock variants; layout rules moved to `class` props.

- [ ] **Step 4: Run shell tests and verify**

```bash
bun run test -- src/lib/components/shell src/lib/components/LayoutContent.test.ts
bun run check
rg ":global\(" src/lib/components/shell src/lib/components/LayoutContent.svelte
```

Expected: tests pass, no new warnings, `rg` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/shell web/src/lib/components/LayoutContent.svelte web/src/lib/components/shell/Header.test.ts
git commit -m "refactor(web): cut over shell to component style APIs"
```

---

### Task 7: Cut over form components

**Files:**
- Modify: `web/src/lib/components/form/Field.svelte` (11), `PathInput.svelte` (5), `SchemaForm.svelte` (4), `OptimizerParamsModal.svelte` (4), `DirectoryInput.svelte` (4), `TimeInput.svelte` (2), `SchedulerParamsModal.svelte` (2)
- Test: `web/src/lib/components/form/FormInputs.test.ts`

**Interfaces:**
- The `Field` tooltip trigger is a real `<button>` with an accessible name, not a `role="button"` wrapper around the label.
- The tooltip element is referenced by the trigger's `aria-describedby`, or removed if the visually-hidden help text already covers it.

- [ ] **Step 1: Add the tooltip-semantics test**

Append to `web/src/lib/components/form/FormInputs.test.ts`:

```ts
it('exposes the field tooltip through a real button, not a role-button wrapper', () => {
  render(Field, {
    props: { id: 'demo', label: 'Demo', tooltip: 'Helpful explanation' },
  });

  const wrappers = document.querySelectorAll('div[role="button"]');
  expect(wrappers).toHaveLength(0);

  const trigger = screen.getByRole('button', { name: /more information about demo/i });
  expect(trigger.tagName).toBe('BUTTON');
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
bun run test -- src/lib/components/form/FormInputs.test.ts
```

Expected: FAIL — a `div[role="button"]` is present and no named button exists.

- [ ] **Step 3: Rebuild the Field label row**

In `web/src/lib/components/form/Field.svelte`, replace the `<div role="button" tabindex="0" class="field-label-side has-tooltip …">` wrapper with a plain wrapper plus an explicit trigger:

```svelte
<div class="field-label-side">
  <label for={inputId} class="field-label">{label}</label>
  {#if tooltip}
    <button
      type="button"
      class="text-muted-foreground hover:text-foreground inline-flex items-center"
      aria-label={`More information about ${label}`}
      aria-describedby={helpId}
      onmouseenter={handleMouseEnter}
      onmouseleave={handleMouseLeave}
      onmousemove={handleMouseMove}
      onclick={handleLabelClick}
      onkeydown={handleKeyDown}
    >
      <Info size={14} aria-hidden="true" />
    </button>
    {#if showTooltip}
      <div class="field-tooltip" role="tooltip">{tooltip}</div>
    {/if}
  {/if}
</div>
```

Import `Info` from the project's icon package at the top of the file. Delete the now-unused `tooltipId` derived. Keep the visually-hidden `<span id={helpId} class="sr-only">{tooltip}</span>` and the existing `ariaDescribedBy` derived unchanged — that is what puts help text on the control itself.

- [ ] **Step 4: Apply the cutover procedure to the remaining six form files**

Follow the Phase 3 procedure. `Field.svelte`'s `.field-control-side :global(...)` width-forcing rules become `w-full` utilities on the wrapped controls; `PathInput` / `DirectoryInput` / `TimeInput` action buttons become `<Button variant="outline" size="icon">`.

- [ ] **Step 5: Run form tests and verify**

```bash
bun run test -- src/lib/components/form src/routes/general src/routes/training
bun run check
rg ":global\(" src/lib/components/form
```

Expected: tests pass, no new warnings, `rg` returns nothing.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/components/form
git commit -m "refactor(web): cut over form components to style APIs"
```

---

### Task 8: Cut over sampling

**Files:**
- Modify: `web/src/lib/components/sampling/SamplePromptTable.svelte` (16), `SamplePromptCards.svelte` (13), `SampleDetailModal.svelte` (7)
- Modify: `web/src/routes/sampling/+page.svelte` (7)
- Test: `web/src/lib/components/sampling/*.test.ts`, `web/src/routes/sampling/SamplingPage.test.ts`

- [ ] **Step 1: Apply the cutover procedure**

Follow the Phase 3 procedure across all four files. `SamplePromptCards` carries three of the 27 `min-height: 0` declarations (`:233` `.btn-icon`, `:291` `.dice-btn`, `:321` `.add-btn`) on the phone-only presentation — all three rules are deleted and the buttons become `<Button variant="ghost" size="icon">` / `<Button variant="outline" size="sm">`.

- [ ] **Step 2: Run sampling tests and verify**

```bash
bun run test -- src/lib/components/sampling src/routes/sampling
bun run check
rg ":global\(" src/lib/components/sampling src/routes/sampling
```

Expected: tests pass, no new warnings, `rg` returns nothing.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/components/sampling web/src/routes/sampling
git commit -m "refactor(web): cut over sampling to style APIs"
```

---

### Task 9: Cut over concepts and embeddings

**Files:**
- Modify: `web/src/lib/components/concepts/ConceptsEditor.svelte` (12), `ConceptGeneralFields.svelte` (3), `ConceptImageFields.svelte` (2), `AugmentationPreview.svelte` (2), `ConceptStatsPanel.svelte` (1), `ConceptDetailModal.svelte` (1)
- Modify: `web/src/lib/components/embeddings/EmbeddingCard.svelte` (14)
- Modify: `web/src/routes/embeddings/+page.svelte` (9), `web/src/routes/concepts/+page.svelte` (1)
- Test: `web/src/lib/components/concepts/*.test.ts`, `web/src/routes/concepts/page.test.ts`, `web/src/routes/embeddings/page.test.ts`

- [ ] **Step 1: Apply the cutover procedure**

Follow the Phase 3 procedure. Also delete the `.close-btn` and `.close-btn:hover` rules at `AugmentationPreview.svelte:194,206`, which svelte-check already reports as unused, and remove the non-standard `-webkit-line-clamp` warning at `ConceptsEditor.svelte:592` by adding the standard `line-clamp` property alongside it.

- [ ] **Step 2: Run tests and verify**

```bash
bun run test -- src/lib/components/concepts src/lib/components/embeddings src/routes/concepts src/routes/embeddings
bun run check
rg ":global\(" src/lib/components/concepts src/lib/components/embeddings src/routes/concepts src/routes/embeddings
```

Expected: tests pass; the three named svelte-check warnings are gone; `rg` returns nothing.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/components/concepts web/src/lib/components/embeddings web/src/routes/concepts web/src/routes/embeddings
git commit -m "refactor(web): cut over concepts and embeddings to style APIs"
```

---

### Task 10: Cut over datasets, training, charts, and console

**Files:**
- Modify: `web/src/lib/components/datasets/DatasetPickerModal.svelte` (7), `DatasetFileCard.svelte` (5), `DatasetCollection.svelte` (5)
- Modify: `web/src/lib/components/training/GalleryImageViewer.svelte` (5), `SampleGallery.svelte` (4)
- Modify: `web/src/lib/components/charts/MetricsChart.svelte` (4)
- Modify: `web/src/lib/components/console/ConsoleView.svelte` (33 → ANSI block only)
- Modify: `web/src/routes/datasets/+page.svelte` (1), `web/src/routes/datasets/[id]/+page.svelte` (6), `web/src/routes/gallery/+page.svelte` (1)
- Modify: `web/src/lib/components/datasets/DatasetCollection.test.ts:118-129`

**Interfaces:**
- `ConsoleView` keeps only its ANSI `.fg-*` / `.bg-*` block, with a comment naming ANSI output as the third party.
- The undefined `touch-target-44` marker class is gone from source and from assertions.

- [ ] **Step 1: Tighten the dataset touch-target assertion**

In `web/src/lib/components/datasets/DatasetCollection.test.ts`, replace the `has44pxHitTarget` block with:

```ts
      const firstBtn = deleteButtons[0];
      expect(firstBtn).toBeVisible();
      // jsdom does no layout, so size is asserted in e2e/touch-targets.spec.ts.
      // Here we only assert the marker class is gone and no override remains.
      expect(firstBtn.className).not.toContain('touch-target-44');
```

- [ ] **Step 2: Run it and verify it fails**

```bash
bun run test -- src/lib/components/datasets/DatasetCollection.test.ts
```

Expected: FAIL — `touch-target-44` is still on the button.

- [ ] **Step 3: Apply the cutover procedure**

Follow the Phase 3 procedure across all ten files. Two specifics:

- `DatasetCollection.svelte:120,152` — drop `touch-target-44` from both class strings. The explicit `min-h-[44px] min-w-[44px] h-11 w-11` may also be dropped now that Task 5 makes it intrinsic.
- `ConsoleView.svelte` — delete the 25 component-styling `:global()` rules; keep the ANSI colour block and replace its comment with:

```css
  /* Third-party boundary: spans emitted by the ANSI renderer, not authored here */
```

- `ConsoleView.svelte:198` — remove the `tabindex` from the noninteractive element svelte-check flags, or give it an interactive role if it is genuinely focusable.

- [ ] **Step 4: Run tests and verify**

```bash
bun run test -- src/lib/components/datasets src/lib/components/training src/lib/components/charts src/lib/components/console src/routes/datasets src/routes/gallery src/routes/console
bun run check
rg ":global\(" src/lib/components/datasets src/lib/components/training src/lib/components/charts src/routes/datasets src/routes/gallery
rg -c ":global\(" src/lib/components/console/ConsoleView.svelte
```

Expected: tests pass; the `ConsoleView:198` warning is gone; the first `rg` returns nothing; the second returns only the ANSI block's count.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/datasets web/src/lib/components/training web/src/lib/components/charts web/src/lib/components/console web/src/routes/datasets web/src/routes/gallery
git commit -m "refactor(web): cut over datasets, training, and console to style APIs"
```

---

### Task 11: Cut over remaining routes and close the boundary

**Files:**
- Modify: `web/src/routes/secrets/+page.svelte` (16), `login/+page.svelte` (8), `backup/+page.svelte` (6), `lora/+page.svelte` (5), `live/+page.svelte` (3), `training/+page.svelte` (1), `model/+page.svelte` (1), `general/+page.svelte` (1)
- Modify: `web/src/lib/components/collections/AddItemCard.svelte` (6)
- Modify: `web/src/lib/components/style-boundary.test.ts`

- [ ] **Step 1: Apply the cutover procedure**

Follow the Phase 3 procedure across all nine files. Delete the unused `.warning-icon` rule at `login/+page.svelte:172` that svelte-check reports.

- [ ] **Step 2: Close the boundary test**

Append to `web/src/lib/components/style-boundary.test.ts`, inside the existing `describe('style boundary', ...)` block:

```ts
  it('has no :global() outside the ConsoleView ANSI boundary', () => {
    const violations = Object.entries(svelteSources).flatMap(([file, source]) =>
      findGlobalSelectors(source, file)
    );
    expect(violations).toEqual([]);
  });
```

- [ ] **Step 3: Run the full suite**

```bash
bun run test
bun run check
bun run build
```

Expected: every test passes, including both sweeps from `style-boundary.test.ts`. `check` reports **0 errors and 0 warnings** — this is the first point where the warning count should be clean.

- [ ] **Step 4: Verify the grep gates**

```bash
rg ":global\(" src/lib/components src/routes --glob '*.svelte' | grep -v ConsoleView
rg "min-height:\s*0" src --glob '*.svelte'
rg "touch-target-44" src
```

Expected: all three return nothing.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes web/src/lib/components/collections web/src/lib/components/style-boundary.test.ts
git commit -m "refactor(web): complete the style boundary cutover"
```

---

## Phase 4 — Consolidation and hygiene

### Task 12: Collapse to one mobile source of truth

**Files:**
- Modify: `web/src/lib/components/LayoutContent.svelte:130-146`
- Modify: `web/src/lib/components/datasets/DatasetCollection.svelte:32-43`
- Modify: `web/src/lib/components/shell/StatusBar.svelte:17`
- Modify: `web/src/lib/components/overlays/ResponsiveDialogDrawer.svelte:27`
- Modify: `web/src/lib/components/overlays/ResponsiveDialogSheet.svelte:25`
- Modify: `web/src/lib/components/form/Field.svelte:183`, `charts/MetricsChart.svelte:304`, `training/SampleGallery.svelte:460`
- Test: `web/src/lib/components/datasets/DatasetCollection.test.ts`

**Interfaces:**
- All breakpoint state derives from the shared `isMobile` in `$lib/hooks/is-mobile.svelte`.
- No component reads `window.innerWidth` inside a `$derived`.

- [ ] **Step 1: Add the no-flash test**

Append to `web/src/lib/components/datasets/DatasetCollection.test.ts`:

```ts
it('renders cards on the first paint at phone width, with no desktop-table flash', () => {
  mockIsMobile.current = true;
  render(DatasetCollection, { props: { datasets: mockDatasets } });

  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
```

Add `import { mockIsMobile } from '$lib/hooks/mock-is-mobile.svelte';` and the matching `vi.mock('$lib/hooks/is-mobile.svelte', ...)` block at the top of the file, copying the pattern from `web/src/routes/sampling/SamplingPage.test.ts:6-18`.

- [ ] **Step 2: Run it and verify it fails**

```bash
bun run test -- src/lib/components/datasets/DatasetCollection.test.ts
```

Expected: FAIL — `isDesktop` initialises to `true`, so the table renders before `onMount`.

- [ ] **Step 3: Replace DatasetCollection's local media query**

In `web/src/lib/components/datasets/DatasetCollection.svelte`, delete the `isDesktop` state and the entire `onMount` media-query block, and replace with:

```ts
  import { isMobile } from '$lib/hooks/is-mobile.svelte';

  const isDesktop = $derived(!isMobile.current);
```

Remove the now-unused `onMount` import if nothing else uses it.

- [ ] **Step 4: Replace LayoutContent's local media query**

In `web/src/lib/components/LayoutContent.svelte`, delete the `let isMobile = $state(false)` declaration and the `window.matchMedia` block inside `onMount` (keeping the `eventClient` setup and its cleanup). Add at the top:

```ts
  import { isMobile } from '$lib/hooks/is-mobile.svelte';
```

and replace the `mobile={isMobile}` prop on `<Rail>` with `mobile={isMobile.current}`.

- [ ] **Step 5: Remove the innerWidth hacks**

In `StatusBar.svelte:17`, `ResponsiveDialogDrawer.svelte:27`, and `ResponsiveDialogSheet.svelte:25`, replace each derived with:

```ts
  const mobile = $derived(isMobile.current);
```

`window.innerWidth` is not reactive; reading it inside a `$derived` never re-evaluates on resize.

- [ ] **Step 6: Normalise the three stray breakpoints**

Change `@media (max-width: 768px)` to `@media (max-width: 767px)` in `form/Field.svelte:183`, `charts/MetricsChart.svelte:304`, and `training/SampleGallery.svelte:460`, so phone behaviour ends below 768px as specified everywhere else.

- [ ] **Step 7: Run tests and verify**

```bash
bun run test
bun run check
rg "matchMedia" src/lib src/routes --glob '*.svelte'
rg "innerWidth" src/lib src/routes --glob '*.svelte'
```

Expected: all tests pass; both `rg` calls return nothing.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/components web/src/routes
git commit -m "refactor(web): unify mobile breakpoint state"
```

---

### Task 13: Fix reactivity warnings and package placement

**Files:**
- Modify: `web/src/lib/components/shell/Header.svelte:23-28`
- Modify: `web/src/lib/components/shell/Rail.svelte:19-24`
- Modify: `web/package.json`

- [ ] **Step 1: Silence the non-reactive warnings**

`svelte-check` warns that `sidebar` and `parentSidebar` are updated but not declared with `$state`. Both are assigned exactly once during init inside a `try`/`catch`, so the fix is to make that explicit rather than to add reactivity. In `Header.svelte`:

```ts
  const sidebar = (() => {
    try {
      return useSidebar();
    } catch {
      // Sidebar context is absent in isolated unit tests.
      return null;
    }
  })();
```

Apply the same shape to `parentSidebar` in `Rail.svelte`.

- [ ] **Step 2: Verify check is clean**

```bash
bun run check
```

Expected: `0 ERRORS 0 WARNINGS`.

- [ ] **Step 3: Move runtime dependencies out of devDependencies**

In `web/package.json`, move these from `devDependencies` to `dependencies`: `bits-ui`, `@lucide/svelte`, `svelte-sonner`, `mode-watcher`, `vaul-svelte`, `tailwind-variants`, `clsx`, `tailwind-merge`. They are imported by shipped code, not by tooling.

- [ ] **Step 4: Consolidate on one icon package**

Two icon packages currently ship: `lucide-svelte@0.468` (application code) and `@lucide/svelte@1.27` (`components/ui/`). `@lucide/svelte` is the current package name. Rewrite the application imports to it and drop `lucide-svelte`:

```bash
rg -l "from 'lucide-svelte'" src | xargs sed -i "s|from 'lucide-svelte'|from '@lucide/svelte'|g"
bun remove lucide-svelte
```

Then check for any remaining subpath imports:

```bash
rg "lucide-svelte" src package.json
```

Expected: only `@lucide/svelte` matches.

- [ ] **Step 5: Verify install, tests, and build**

```bash
bun install
bun run test
bun run check
bun run build
```

Expected: all pass. If any icon name differs between the two packages, fix the import at the call site rather than reinstating the old package.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/bun.lock web/src
git commit -m "chore(web): correct dependency placement and icon package"
```

---

## Phase 5 — Make the tests trustworthy

### Task 14: Convert the UI dependency boundary to an allowlist

**Files:**
- Modify: `web/src/lib/components/ui-dependency-boundary.test.ts:23-79`

**Interfaces:**
- `findForbiddenImports` rejects any import that is not explicitly allowed, including bare specifiers.

- [ ] **Step 1: Add the rejected fixtures**

In `web/src/lib/components/ui-dependency-boundary.test.ts`, add to the existing fixture test:

```ts
    const fixture6 = "import { page } from '$app/stores';";
    const fixture7 = "import { goto } from '$app/navigation';";
    const fixture8 = "import { createQuery } from '@tanstack/svelte-query';";

    expect(findForbiddenImports(fixture6, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture7, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture8, targetFile)).not.toEqual([]);
```

- [ ] **Step 2: Run it and verify it fails**

```bash
bun run test -- src/lib/components/ui-dependency-boundary.test.ts
```

Expected: FAIL — all three return `[]`, because bare and `$app/` specifiers are never inspected.

- [ ] **Step 3: Rewrite the check as an allowlist**

Replace the body of `findForbiddenImports` in `web/src/lib/components/ui-dependency-boundary.test.ts` with:

```ts
/** Bare specifiers the canonical components legitimately depend on. */
const ALLOWED_PACKAGES = [
  'svelte',
  'bits-ui',
  '@lucide/svelte',
  'tailwind-variants',
  'vaul-svelte',
  'svelte-sonner',
  'mode-watcher',
];

function isAllowedPackage(importPath: string): boolean {
  return ALLOWED_PACKAGES.some(
    (pkg) => importPath === pkg || importPath.startsWith(pkg + '/')
  );
}

export function findForbiddenImports(source: string, filename: string): string[] {
  const violations: string[] = [];
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  const normFile = filename.startsWith('/') ? filename : '/' + filename;
  const fileDir = normFile.substring(0, normFile.lastIndexOf('/'));

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];

    if (importPath.startsWith('.')) {
      const resolved = resolvePath(fileDir, importPath);
      if (!resolved.startsWith('/src/lib/components/ui/')) {
        violations.push(
          `${filename}: relative import ${importPath} resolves to ${resolved}, outside the UI directory`
        );
      }
      continue;
    }

    if (importPath.startsWith('$lib/')) {
      const allowed =
        importPath === '$lib/utils' ||
        importPath.startsWith('$lib/utils/') ||
        importPath.startsWith('$lib/utils.') ||
        importPath.startsWith('$lib/components/ui/');
      if (!allowed) {
        violations.push(`${filename}: import ${importPath} violates the UI dependency boundary`);
      }
      continue;
    }

    if (importPath.startsWith('/')) {
      if (
        !importPath.startsWith('/src/lib/components/ui/') &&
        !importPath.startsWith('/src/lib/utils')
      ) {
        violations.push(`${filename}: absolute import ${importPath} is outside the UI directory`);
      }
      continue;
    }

    if (!isAllowedPackage(importPath)) {
      violations.push(`${filename}: package import ${importPath} is not on the UI allowlist`);
    }
  }

  return violations;
}
```

- [ ] **Step 4: Run it and verify it passes**

```bash
bun run test -- src/lib/components/ui-dependency-boundary.test.ts
```

Expected: PASS. If the sweep over real sources reports a violation, the correct response is to remove that import from `components/ui/` or add the package to `ALLOWED_PACKAGES` with a comment justifying it — not to loosen the matching.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/components/ui-dependency-boundary.test.ts
git commit -m "test(web): enforce the UI dependency boundary as an allowlist"
```

---

### Task 15: Add the browser-level touch-target test

**Files:**
- Create: `web/e2e/touch-targets.spec.ts`
- Modify: `web/playwright.config.ts:36-46`

**Interfaces:**
- Every visible interactive control on a phone viewport measures at least 44×44 CSS pixels.
- The test runs only in the phone projects.

- [ ] **Step 1: Write the failing browser test**

Create `web/e2e/touch-targets.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const PHONE_ROUTES = ["/live", "/general", "/datasets", "/concepts", "/sampling", "/console"];

const INTERACTIVE =
  'button:visible, a[href]:visible, input:visible, select:visible, textarea:visible, [role="button"]:visible';

test.describe("Phone touch targets", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("phone")) test.skip();
  });

  for (const route of PHONE_ROUTES) {
    test(`every interactive control on ${route} is at least 44x44`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const controls = await page.locator(INTERACTIVE).all();
      expect(controls.length).toBeGreaterThan(0);

      const undersized: string[] = [];
      for (const control of controls) {
        const box = await control.boundingBox();
        if (!box) continue;
        if (box.width < 44 || box.height < 44) {
          const label =
            (await control.getAttribute("aria-label")) ??
            (await control.textContent())?.trim().slice(0, 40) ??
            (await control.evaluate((el) => el.className));
          undersized.push(`${label} -> ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }

      expect(undersized, `Undersized controls on ${route}:\n${undersized.join("\n")}`).toEqual([]);
    });
  }

  test("the mobile navigation sheet has no undersized controls", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Open navigation" }).click();

    const nav = page.getByRole("dialog", { name: "Navigation" });
    await expect(nav).toBeVisible();

    const controls = await nav.locator(INTERACTIVE).all();
    expect(controls.length).toBeGreaterThan(0);

    const undersized: string[] = [];
    for (const control of controls) {
      const box = await control.boundingBox();
      if (!box) continue;
      if (box.width < 44 || box.height < 44) {
        undersized.push(`${(await control.textContent())?.trim()} -> ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }

    expect(undersized, `Undersized nav controls:\n${undersized.join("\n")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Register the spec in the phone projects**

In `web/playwright.config.ts`, add `touch-targets` to the `testMatch` regex of both `webkit-phone` and `chromium-phone`:

```ts
      testMatch: /mobile|responsive-workflows|accessibility|touch-targets/,
```

for `webkit-phone`, and:

```ts
      testMatch: /mobile|responsive-workflows|accessibility|theme|visual|touch-targets/,
```

for `chromium-phone`.

- [ ] **Step 3: Prove the test can fail**

By this phase the defect is already fixed, so the test would pass on its first run — which tells you nothing about whether it works. Temporarily remove the guarantee and confirm the test catches it.

In `web/src/lib/components/ui/button/button.svelte`, delete ` max-md:min-h-11 max-md:min-w-11` from the `buttonVariants` base string, then:

```bash
bun run build
bunx playwright test e2e/touch-targets.spec.ts --project=chromium-phone
```

Expected: FAIL, listing undersized controls by name on several routes and in the navigation sheet.

Restore the class string and rebuild:

```bash
git checkout -- src/lib/components/ui/button/button.svelte
bun run build
```

If the test passed with the class removed, the selector or the route list is wrong — fix the test before continuing.

- [ ] **Step 4: Run it against the current build**

```bash
bun run build
bunx playwright test e2e/touch-targets.spec.ts --project=chromium-phone
```

Expected: PASS on every route.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/touch-targets.spec.ts web/playwright.config.ts
git commit -m "test(web): assert real phone touch targets in the browser"
```

---

### Task 16: Cover the states axe cannot reach

**Files:**
- Modify: `web/e2e/accessibility.spec.ts`

**Interfaces:**
- The light-theme pass is mandatory; a missing theme control fails the test rather than skipping it.
- Destructive confirmation requires `alertdialog` with no ordinary-dialog fallback.
- At least one scan runs with the error banner mounted.

- [ ] **Step 1: Make the theme switch mandatory**

In `web/e2e/accessibility.spec.ts`, replace both `if (await toggle.isVisible())` blocks with an unconditional sequence:

```ts
  async function switchToLightTheme(page: any) {
    const toggle = page.getByRole("button", { name: /switch to light theme/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }
```

and call it directly in `checkAccessibilityInBothThemes` in place of the conditional blocks. A missing toggle now fails the test instead of silently skipping the entire light-theme scan.

- [ ] **Step 2: Remove the ordinary-dialog fallback**

Replace the `overwriteDialog` locator with:

```ts
      const overwriteDialog = page.getByRole("alertdialog");
      await expect(overwriteDialog).toBeVisible();
      await expect(overwriteDialog.getByText("File Already Exists")).toBeVisible();
```

Also remove the `if (await saveDialog.isHidden().catch(() => false))` retry block above it; if the first Save does not surface the conflict, that is a defect the test should report.

- [ ] **Step 3: Add an error-banner scan**

Append a new test to the describe block:

```ts
  test("error banner has no critical/serious violations", async ({ page }) => {
    const showBanner = async () => {
      await page.route("**/api/health**", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Server Error" }),
        })
      );
      await page.goto("/general");
      await expect(page.getByText(/Error:/)).toBeVisible({ timeout: 15000 });
    };
    await checkAccessibilityInBothThemes(page, "persistent error banner", showBanner);
  });
```

- [ ] **Step 4: Run the accessibility suite**

```bash
bun run build
bunx playwright test e2e/accessibility.spec.ts --project=chromium-desktop
bunx playwright test e2e/accessibility.spec.ts --project=chromium-phone
```

Expected: PASS in both projects. Colour-contrast violations are reported at `serious` impact, so the Task 4 tokens are what make the error-banner scan pass.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/accessibility.spec.ts
git commit -m "test(web): scan unreached states and require the light theme pass"
```

---

### Task 17: Fix e2e project boundaries and assertion-free tests

**Files:**
- Modify: `web/e2e/responsive-workflows.spec.ts:4-6,40-42,88-112`
- Modify: `web/e2e/mobile.spec.ts:55-132`

**Interfaces:**
- Viewport is never overridden inside a project; project selection is by `testInfo.project.name`.
- No test body is wrapped in a visibility conditional that allows it to pass having done nothing.

- [ ] **Step 1: Replace viewport overrides with project skipping**

In `web/e2e/responsive-workflows.spec.ts`, delete `test.use({ viewport: { width: 1280, height: 720 } })` from the desktop describe and `test.use({ viewport: { width: 390, height: 844 } })` from the phone describe. Add to each describe instead:

```ts
    test.beforeEach(async ({}, testInfo) => {
      if (!testInfo.project.name.includes("desktop")) test.skip();
    });
```

and, for the phone describe:

```ts
    test.beforeEach(async ({}, testInfo) => {
      if (!testInfo.project.name.includes("phone")) test.skip();
    });
```

This matches the pattern `web/e2e/visual.spec.ts:13-15` already uses.

- [ ] **Step 2: Replace the heading-only smoke test**

Replace the `"concepts, datasets, and sampling editing pages load and function"` test with one that asserts an outcome:

```ts
    test("a dataset created on this page survives a reload", async ({ page }) => {
      await page.goto("/datasets");
      await page.getByRole("button", { name: "Add Dataset" }).click();

      const createModal = page.getByRole("dialog", { name: "Create New Dataset" });
      await expect(createModal).toBeVisible();
      await page.locator("#ds-name-input").fill("Workflow Persistence Check");
      await createModal.getByRole("button", { name: "Create" }).click();
      await expect(createModal).not.toBeVisible();

      await expect(page.getByText("Workflow Persistence Check")).toBeVisible();
      await page.reload();
      await expect(page.getByText("Workflow Persistence Check")).toBeVisible();
    });
```

- [ ] **Step 3: Give the mobile sampling test real assertions**

In `web/e2e/mobile.spec.ts`, replace the entire `"sampling prompt edit workflow on mobile"` test — currently wrapped in nested `if (await …isVisible())` guards with no assertions — with:

```ts
  test("sampling prompt edit workflow on mobile", async ({ page }) => {
    await page.goto("/sampling");
    await expect(page.getByRole("heading", { level: 1, name: /sampling/i })).toBeVisible();

    const addBtn = page.getByRole("button", { name: /add (sample )?prompt/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    const promptInput = modal.locator("textarea, input[type='text']").first();
    await expect(promptInput).toBeVisible();
    await promptInput.fill("a photo of a cat on phone");

    await modal.getByRole("button", { name: /^(save|create|add)$/i }).first().click();
    await expect(modal).not.toBeVisible();

    await expect(page.getByText("a photo of a cat on phone")).toBeVisible();
  });
```

- [ ] **Step 4: Make the mobile concept test assert persistence**

Replace the `if (await saveBtn.isVisible()) { … } else { Escape }` block in `"concept editing and saving flow on mobile"` with:

```ts
    const saveBtn = modal.getByRole("button", { name: /^save/i }).first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByText("Mobile Test Concept")).toBeVisible();
```

- [ ] **Step 5: Run both specs in both projects**

```bash
bun run build
bunx playwright test e2e/responsive-workflows.spec.ts e2e/mobile.spec.ts --project=chromium-desktop
bunx playwright test e2e/responsive-workflows.spec.ts e2e/mobile.spec.ts --project=chromium-phone
```

Expected: PASS. Desktop-only tests skip in the phone project and vice versa, rather than running with a forced viewport.

- [ ] **Step 6: Commit**

```bash
git add web/e2e/responsive-workflows.spec.ts web/e2e/mobile.spec.ts
git commit -m "test(web): assert real outcomes and respect project boundaries"
```

---

### Task 18: Regenerate and inspect the visual baselines

**Files:**
- Replace: `web/e2e/visual.spec.ts-snapshots/*.png` (17 files)

**Interfaces:**
- Every regenerated image visibly contains the state its test name claims.

- [ ] **Step 1: Regenerate the desktop baselines**

```bash
bun run build
bunx playwright test e2e/visual.spec.ts --project=chromium-desktop --update-snapshots
```

- [ ] **Step 2: Regenerate the phone baselines**

```bash
bunx playwright test e2e/visual.spec.ts --project=chromium-phone --update-snapshots
```

- [ ] **Step 3: Inspect every image**

Open each file under `web/e2e/visual.spec.ts-snapshots/` and confirm:

| Image | Must visibly show |
|---|---|
| `dataset-collection-desktop-table` | a table containing "Seeded Dataset 1" |
| `dataset-collection-phone-cards` | cards containing "Seeded Phone Dataset 1", no table |
| `empty-state` | the empty-state message, not a populated list |
| `loading-state` | a skeleton or spinner, not loaded content |
| `persistent-error-state` | the error banner text |
| `ordinary-editor-dialog-desktop` | a centred Dialog |
| `ordinary-editor-drawer-phone` | a bottom Drawer, not a centred Dialog |
| `shell-*-light` / `schema-form-*-light` | light theme, no dark background |

Confirm `dataset-collection-desktop-table` and `empty-state` are visibly different images. Do not accept any image that fails its row — that indicates the test seeds state incorrectly, which is a defect to fix rather than a baseline to record.

- [ ] **Step 4: Verify the suite is stable**

```bash
bunx playwright test e2e/visual.spec.ts --project=chromium-desktop
bunx playwright test e2e/visual.spec.ts --project=chromium-phone
```

Expected: PASS with no diffs on a second run.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/visual.spec.ts-snapshots
git commit -m "test(web): regenerate visual baselines for stock shadcn styling"
```

---

## Phase 6 — Audit

### Task 19: Final verification and status reconciliation

**Files:**
- Modify: `docs/superpowers/plans/2026-07-28-shadcn-svelte-ui-migration.md`
- Modify: `docs/superpowers/plans/2026-07-28-shadcn-svelte-review-fixes.md`
- Modify: `docs/superpowers/plans/2026-07-28-shadcn-migration-completion.md`
- Create: `docs/superpowers/plans/2026-07-28-shadcn-migration-completion-notes.md`

- [ ] **Step 1: Run clean verification from a fresh install**

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
bunx playwright test --project=chromium-desktop
bunx playwright test --project=chromium-phone
```

Expected: `check` reports 0 errors and 0 warnings; every unit test passes; both provisioned browser projects pass. `firefox-smoke` and `webkit-phone` cannot run on this workstation — record that they are deferred to CI rather than reporting them as passing.

- [ ] **Step 2: Verify every grep gate**

```bash
rg ":global\(" src/lib/components src/routes --glob '*.svelte' | grep -v ConsoleView
rg "min-height:\s*0" src --glob '*.svelte'
rg "touch-target-44" src
rg "matchMedia|innerWidth" src/lib src/routes --glob '*.svelte'
rg "#[0-9a-fA-F]{6}" src --glob '*.svelte' | grep -v ConsoleView
```

Expected: all five return nothing.

- [ ] **Step 3: Write the coverage notes**

Create `docs/superpowers/plans/2026-07-28-shadcn-migration-completion-notes.md` mapping each reviewed finding to the test that now covers it:

```markdown
# Coverage Notes

| Finding | Covering test |
|---|---|
| 286 :global() overrides | style-boundary.test.ts "has no :global() outside the ConsoleView ANSI boundary" |
| 27 min-height: 0 | style-boundary.test.ts "has no min-height: 0 anywhere in the application" |
| Sub-44px phone targets | e2e/touch-targets.spec.ts (all routes + navigation sheet) |
| Light-theme contrast | token-contrast.test.ts + accessibility.spec.ts "error banner" |
| Sample stale-index edit | SamplingPage.test.ts "writes the edited prompt by identity after the list reorders" |
| Silent sample delete | SamplingPage.test.ts "reports an error instead of a false success" |
| Missing edit feedback | SamplingPage.test.ts "reports success after an inline row edit commits" |
| Concept key injection | concept-draft.test.ts "does not add numeric keys that were absent" |
| ValueSelect empty value | ValueSelect.test.ts "does not visually select the first option" |
| Boundary not an allowlist | ui-dependency-boundary.test.ts (fixtures 6-8) |
| e2e viewport swapping | responsive-workflows.spec.ts project beforeEach guards |
| Assertion-free e2e | mobile.spec.ts "sampling prompt edit workflow on mobile" |
| alertdialog fallback | accessibility.spec.ts "open Alert Dialog" |
| Silent light-theme skip | accessibility.spec.ts switchToLightTheme |
| Multiple mobile sources | DatasetCollection.test.ts "renders cards on the first paint" |
| Untruthful snapshots | e2e/visual.spec.ts + Task 18 inspection |
```

- [ ] **Step 4: Reconcile plan checkboxes**

Tick the completed `- [ ]` boxes in all three plan documents to reflect actual state. All boxes in the two prior plans are currently unticked despite the work having landed, which is what allowed the incomplete tasks to read as done.

- [ ] **Step 5: Commit the documentation**

```bash
git add docs/superpowers/plans
git commit -m "docs(plan): record migration completion coverage"
```

- [ ] **Step 6: Route any remaining defect back to its owning task**

If verification surfaces a defect, reopen the task that owns that contract, add a failing regression there, make the smallest fix, rerun that task's verification, and use that task's commit message. If verification is clean, create no further commit.
