import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ConceptsEditor from './ConceptsEditor.svelte';

describe('ConceptsEditor', () => {
  it('renders toolbar search, filter, and add button', () => {
    render(ConceptsEditor, { props: { concepts: [] } });
    expect(screen.getByRole('button', { name: /add first concept/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search concepts/i)).toBeInTheDocument();
  });

  it('adds a new concept when add button is clicked', async () => {
    const onChange = vi.fn();
    render(ConceptsEditor, { props: { concepts: [], onChange } });

    const addBtn = screen.getByRole('button', { name: /add first concept/i });
    await fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders initial concept cards with thumbnail and details', async () => {
    const onChange = vi.fn();
    const initialConcepts = [
      {
        name: 'MyDogConcept',
        path: '/tmp/dogs',
        enabled: true,
        type: 'STANDARD' as const,
      },
    ];

    render(ConceptsEditor, { props: { concepts: initialConcepts, onChange } });

    expect(screen.getByText('MyDogConcept')).toBeInTheDocument();
    expect(screen.getByText('/tmp/dogs')).toBeInTheDocument();
  });

  it('removes a concept when delete button is clicked', async () => {
    const onChange = vi.fn();
    const initialConcepts = [
      { name: 'Cat', path: '/tmp/cats', enabled: true },
      { name: 'Dog', path: '/tmp/dogs', enabled: true },
    ];

    render(ConceptsEditor, { props: { concepts: initialConcepts, onChange } });

    const deleteBtns = screen.getAllByTitle(/delete concept/i);
    expect(deleteBtns.length).toBe(2);

    await fireEvent.click(deleteBtns[0]);
    const confirmBtn = screen.getByRole('button', { name: /^delete$/i });
    await fireEvent.click(confirmBtn);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].length).toBe(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('Dog');
  });

  it('filters concepts using search input and retains original index mapping on clone/remove', async () => {
    const onChange = vi.fn();
    const initialConcepts = [
      { name: 'Character_Alpha', path: '/datasets/alpha', enabled: true, type: 'STANDARD' as const },
      { name: 'Style_Beta', path: '/datasets/beta', enabled: true, type: 'VALIDATION' as const },
      { name: 'Character_Gamma', path: '/datasets/gamma', enabled: true, type: 'STANDARD' as const },
    ];

    render(ConceptsEditor, { props: { concepts: initialConcepts, onChange } });

    const searchInput = screen.getByPlaceholderText(/search concepts/i);
    await fireEvent.input(searchInput, { target: { value: 'Beta' } });

    expect(screen.queryByText('Character_Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Style_Beta')).toBeInTheDocument();

    // Clone filtered item (original index 1)
    const cloneBtn = screen.getByTitle('Duplicate Concept');
    await fireEvent.click(cloneBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0];
    expect(updated.length).toBe(4);
    expect(updated[3].name).toBe('Style_Beta (Copy)');
  });

  it('renders Add Concept card in grid and opens edit modal on card click', async () => {
    const concepts = [
      { name: 'Concept Alpha', path: '/path/a', enabled: true, type: 'STANDARD' as const },
    ];
    render(ConceptsEditor, { props: { concepts } });

    const addCards = screen.getAllByRole('button', { name: /add concept/i });
    expect(addCards.length).toBeGreaterThanOrEqual(1);

    const conceptName = screen.getByText('Concept Alpha');
    await fireEvent.click(conceptName);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stops clone and delete actions from opening the card modal', async () => {
    const onChange = vi.fn();
    render(ConceptsEditor, { props: { concepts: [{ name: 'A', path: '/a', enabled: true }], onChange } });
    await fireEvent.click(screen.getByTitle('Duplicate Concept'));
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'A (Copy)' })]));
    expect(screen.queryByText(/Concept Configuration/i)).not.toBeInTheDocument();
    await fireEvent.click(screen.getAllByTitle('Delete Concept')[0]);
    expect(screen.queryByText(/Concept Configuration/i)).not.toBeInTheDocument();
  });
});
