import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ConceptsEditor from './ConceptsEditor.svelte';

describe('ConceptsEditor', () => {
  it('renders concept list and add button', () => {
    render(ConceptsEditor, { props: { concepts: [] } });
    expect(screen.getByRole('button', { name: /add concept/i })).toBeInTheDocument();
  });

  it('adds a new concept when add button is clicked', async () => {
    const onChange = vi.fn();
    render(ConceptsEditor, { props: { concepts: [], onChange } });
    
    const addBtn = screen.getByRole('button', { name: /add concept/i });
    await fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalled();
    const newConcepts = onChange.mock.calls[0][0];
    expect(newConcepts.length).toBe(1);
    expect(newConcepts[0]).toMatchObject({
      instance_prompt: '',
      class_prompt: '',
      dataset_directory: '',
    });
  });

  it('renders initial concepts and allows updating fields', async () => {
    const onChange = vi.fn();
    const initialConcepts = [
      {
        instance_prompt: 'photo of a dog',
        class_prompt: 'dog',
        dataset_directory: '/tmp/dogs',
        class_dataset_directory: '/tmp/class_dogs',
      },
    ];

    render(ConceptsEditor, { props: { concepts: initialConcepts, onChange } });

    const instanceInput = screen.getByDisplayValue('photo of a dog');
    expect(instanceInput).toBeInTheDocument();

    await fireEvent.input(instanceInput, { target: { value: 'photo of a happy dog' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0][0].instance_prompt).toBe('photo of a happy dog');
  });

  it('removes a concept when delete button is clicked', async () => {
    const onChange = vi.fn();
    const initialConcepts = [
      { instance_prompt: 'cat', class_prompt: 'cat', dataset_directory: '/tmp/cats' },
      { instance_prompt: 'dog', class_prompt: 'dog', dataset_directory: '/tmp/dogs' },
    ];

    render(ConceptsEditor, { props: { concepts: initialConcepts, onChange } });

    const deleteBtns = screen.getAllByRole('button', { name: /remove concept|delete concept/i });
    expect(deleteBtns.length).toBe(2);

    await fireEvent.click(deleteBtns[0]);
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].length).toBe(1);
    expect(onChange.mock.calls[0][0][0].instance_prompt).toBe('dog');
  });

  it('reorders concepts when move up / move down buttons are clicked', async () => {
    const onChange = vi.fn();
    const initialConcepts = [
      { instance_prompt: 'concept 1', dataset_directory: '/tmp/c1' },
      { instance_prompt: 'concept 2', dataset_directory: '/tmp/c2' },
    ];

    render(ConceptsEditor, { props: { concepts: initialConcepts, onChange } });

    const moveDownBtns = screen.getAllByRole('button', { name: /move down/i });
    await fireEvent.click(moveDownBtns[0]);

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0][0].instance_prompt).toBe('concept 2');
    expect(onChange.mock.calls[0][0][1].instance_prompt).toBe('concept 1');
  });
});
