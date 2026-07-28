import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SamplePromptCards from './SamplePromptCards.svelte';

describe('SamplePromptCards Component', () => {
  const sampleData = [
    {
      webui_id: 'prompt_1',
      enabled: true,
      width: 512,
      height: 768,
      seed: -1,
      prompt: 'A cinematic photo of a mountain',
    },
    {
      webui_id: 'prompt_2',
      enabled: false,
      width: 1024,
      height: 1024,
      seed: 12345,
      prompt: 'An abstract painting',
    },
  ];

  it('renders cards with prompt details and dice toggle button', async () => {
    render(SamplePromptCards, { samples: sampleData });

    expect(screen.getByDisplayValue('A cinematic photo of a mountain')).toBeInTheDocument();
    expect(screen.getByDisplayValue('An abstract painting')).toBeInTheDocument();
    expect(screen.getByDisplayValue('512')).toBeInTheDocument();
    expect(screen.getByDisplayValue('768')).toBeInTheDocument();

    const diceButtons = screen.getAllByRole('button', { name: 'Toggle random seed' });
    expect(diceButtons).toHaveLength(2);
  });

  it('invokes identical callbacks as table for active toggle, inputs, edit, clone, delete, and add', async () => {
    const onUpdate = vi.fn();
    const onEditModal = vi.fn();
    const onClone = vi.fn();
    const onDelete = vi.fn();
    const onAdd = vi.fn();

    render(SamplePromptCards, {
      samples: sampleData,
      onUpdate,
      onEditModal,
      onClone,
      onDelete,
      onAdd,
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.click(checkboxes[0]);
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ enabled: false }));

    const editButtons = screen.getAllByRole('button', { name: 'Edit sample prompt' });
    await fireEvent.click(editButtons[0]);
    expect(onEditModal).toHaveBeenCalledWith(0);

    const cloneButtons = screen.getAllByRole('button', { name: 'Clone sample prompt' });
    await fireEvent.click(cloneButtons[0]);
    expect(onClone).toHaveBeenCalledWith(0);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete sample prompt' });
    await fireEvent.click(deleteButtons[1]);
    expect(onDelete).toHaveBeenCalledWith(1);

    const addBtn = screen.getByRole('button', { name: /add sample prompt/i });
    await fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('normalizes fractional and invalid sampling inputs on change commit', async () => {
    const onUpdate = vi.fn();
    render(SamplePromptCards, { samples: sampleData, onUpdate });

    const widthInput = document.getElementById('card-width-0') as HTMLInputElement;
    const seedInput = document.getElementById('card-seed-0') as HTMLInputElement;

    await fireEvent.change(widthInput, { target: { value: '640.5' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ width: 640 }));

    await fireEvent.change(seedInput, { target: { value: '123.9' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ seed: 123 }));

    await fireEvent.change(widthInput, { target: { value: 'invalid' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ width: 512 }));

    await fireEvent.change(seedInput, { target: { value: 'invalid' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ seed: -1 }));
  });
});
