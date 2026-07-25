import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ConceptsEditor from './ConceptsEditor.svelte';

describe('ConceptsEditor', () => {
  it('renders toolbar search, filter, and add button', () => {
    render(ConceptsEditor, { props: { concepts: [] } });
    expect(screen.getByRole('button', { name: /add concept/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search concepts/i)).toBeInTheDocument();
  });

  it('adds a new concept when add button is clicked', async () => {
    const onChange = vi.fn();
    render(ConceptsEditor, { props: { concepts: [], onChange } });

    const addBtn = screen.getByRole('button', { name: /add concept/i });
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
        type: 'STANDARD',
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
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].length).toBe(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('Dog');
  });

  it('filters concepts using search input', async () => {
    const initialConcepts = [
      { name: 'Character_Alpha', path: '/datasets/alpha', enabled: true },
      { name: 'Style_Beta', path: '/datasets/beta', enabled: true },
    ];

    render(ConceptsEditor, { props: { concepts: initialConcepts } });

    const searchInput = screen.getByPlaceholderText(/search concepts/i);
    await fireEvent.input(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Character_Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Style_Beta')).not.toBeInTheDocument();
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
});
