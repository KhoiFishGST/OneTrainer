# Concepts Card UI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `+ Add Concept` card at index 0 in the concepts grid, and make concept cards clickable to open the edit modal (`handleEditConcept`), preserving explicit action button event handlers with event propagation stops.

**Architecture:** Update `web/src/lib/components/concepts/ConceptsEditor.svelte` to render an `add-card` button as the first item in `.concepts-grid`, and wrap each concept card with an `onclick` handler to open the edit modal while calling `e.stopPropagation()` on nested buttons/toggles.

**Tech Stack:** Svelte 5, TypeScript, Vitest.

## Global Constraints

- Preserve all existing concept fields, search filters, and `ConceptsEditor` component props (`concepts`, `onChange`, `disabled`, `openDirectory`).
- Use standard CSS variables (`var(--panel)`, `var(--line)`, `var(--accent)`, `var(--text)`).

---

### Task 1: Implement "+ Add Concept" Card & Clickable Concept Cards

**Files:**
- Modify: `web/src/lib/components/concepts/ConceptsEditor.svelte`
- Modify: `web/src/lib/components/concepts/ConceptsEditor.test.ts`

**Interfaces:**
- Consumes: `handleAddConcept()`, `handleEditConcept()`, `handleCloneConcept()`, `handleRemoveConcept()`, `notifyChange()`
- Produces: Enhanced `ConceptsEditor.svelte` grid layout

- [ ] **Step 1: Write failing test in `web/src/lib/components/concepts/ConceptsEditor.test.ts`**

Update `web/src/lib/components/concepts/ConceptsEditor.test.ts`:
```ts
test('renders Add Concept card in grid and opens edit modal on card click', async () => {
  const concepts = [
    { name: 'Concept Alpha', path: '/path/a', enabled: true, type: 'STANDARD' as const },
  ];
  render(ConceptsEditor, { concepts });

  // Grid should contain the + Add Concept card
  const addCards = screen.getAllByRole('button', { name: /add concept/i });
  expect(addCards.length).toBeGreaterThanOrEqual(1);

  // Clicking concept card should open edit modal
  const conceptName = screen.getByText('Concept Alpha');
  await fireEvent.click(conceptName);
  expect(screen.getByText('Edit Concept')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd web && bun test src/lib/components/concepts/ConceptsEditor.test.ts`
Expected: FAIL (Grid does not yet contain `+ Add Concept` card or card click does not trigger modal).

- [ ] **Step 3: Update `ConceptsEditor.svelte`**

Update `web/src/lib/components/concepts/ConceptsEditor.svelte`:
1. Add `add-card` at index 0 of `.concepts-grid`:
```svelte
    <div class="concepts-grid">
      <button
        type="button"
        class="concept-card add-card"
        {disabled}
        onclick={handleAddConcept}
      >
        <div class="add-icon-wrapper">
          <Plus size={32} />
        </div>
        <span class="add-label">Add Concept</span>
      </button>

      {#each filteredConcepts as { concept, originalIndex } (originalIndex)}
        <div
          class="concept-card"
          class:disabled={concept.enabled === false}
          role="button"
          tabindex="0"
          onclick={() => handleEditConcept(originalIndex)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEditConcept(originalIndex);
            }
          }}
        >
          ...
```

2. Add `e.stopPropagation()` to toggle switch and action buttons:
```svelte
          <!-- Toggle switch -->
          <label class="toggle-switch" onclick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={concept.enabled !== false}
              onchange={(e) => {
                e.stopPropagation();
                const updated = concepts.map((c, i) =>
                  i === originalIndex ? { ...c, enabled: (e.target as HTMLInputElement).checked } : c
                );
                notifyChange(updated);
              }}
            />
            <span class="switch-slider"></span>
          </label>
...
          <!-- Action Buttons -->
          <button
            type="button"
            class="btn-action edit"
            title="Edit Concept Settings"
            onclick={(e) => {
              e.stopPropagation();
              handleEditConcept(originalIndex);
            }}
          >
            <Edit2 size={15} />
            <span>Edit</span>
          </button>

          <button
            type="button"
            class="btn-action clone"
            title="Duplicate Concept"
            onclick={(e) => {
              e.stopPropagation();
              handleCloneConcept(originalIndex);
            }}
          >
            <Copy size={15} />
            <span>Clone</span>
          </button>

          <button
            type="button"
            class="btn-action delete"
            title="Delete Concept"
            onclick={(e) => {
              e.stopPropagation();
              handleRemoveConcept(originalIndex);
            }}
          >
            <Trash2 size={15} />
          </button>
```

3. Add `.add-card` CSS styles to `ConceptsEditor.svelte`:
```css
  .add-card {
    min-height: 220px;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: 2px dashed var(--line, #2d3741);
    background: transparent;
    cursor: pointer;
  }

  .add-card:hover:not(:disabled) {
    border-color: var(--accent, #3b82f6);
    background: rgba(59, 130, 246, 0.05);
    transform: translateY(-2px);
  }

  .add-icon-wrapper {
    color: var(--accent, #3b82f6);
  }

  .add-label {
    font-weight: 600;
    color: var(--text, #f8fafc);
  }

  .concept-card {
    cursor: pointer;
  }
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd web && bun test src/lib/components/concepts/ConceptsEditor.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite & production build**

Run: `cd web && bun run test`
Expected: 110/110 PASS

Run: `cd web && bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/components/concepts/ConceptsEditor.svelte web/src/lib/components/concepts/ConceptsEditor.test.ts
git commit -m "feat(webui): add Add Concept grid card and make concept cards clickable to edit"
```
