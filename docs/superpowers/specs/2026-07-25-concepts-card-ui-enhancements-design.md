# Concepts Card UI Enhancements Design Spec

## Executive Summary

This design specification details the UI enhancements for the Concepts route (`web/src/lib/components/concepts/ConceptsEditor.svelte`), introducing a **`+ Add Concept`** grid card alongside interactive, clickable concept cards for seamless modal editing.

---

## 1. User Interface & Component Changes (`ConceptsEditor.svelte`)

### 1.1 "+ Add Concept" Grid Card

- Render a **`+ Add Concept`** button card at index 0 inside `.concepts-grid`.
- **Markup**:
  ```html
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
  ```
- **CSS Styling**:
  ```css
  .add-card {
    min-height: 220px;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    border: 2px dashed var(--line, #2d3741);
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
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
  ```

### 1.2 Interactive Clickable Concept Cards

- Convert each `.concept-card` into a clickable container with keyboard accessibility (`role="button"`, `tabindex="0"`, `onclick={() => handleEditConcept(originalIndex)}`).
- Add `e.stopPropagation()` to child control event handlers:
  - Toggle switch checkbox: `onclick={(e) => e.stopPropagation()}`
  - Edit button: `onclick={(e) => { e.stopPropagation(); handleEditConcept(originalIndex); }}`
  - Clone button: `onclick={(e) => { e.stopPropagation(); handleCloneConcept(originalIndex); }}`
  - Delete button: `onclick={(e) => { e.stopPropagation(); handleRemoveConcept(originalIndex); }}`

---

## 2. Verification Strategy

1. **Vitest Unit Tests**:
   - Update `ConceptsEditor.test.ts` to assert that clicking the card triggers concept editing and `+ Add Concept` card renders in grid.
   - Run: `cd web && bun run test src/lib/components/concepts/ConceptsEditor.test.ts`.
2. **Full Test Suite**:
   - Run: `cd web && bun run test`.
3. **Production Static Build**:
   - Run: `cd web && bun run build`.
