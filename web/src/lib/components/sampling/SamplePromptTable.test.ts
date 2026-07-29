import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SamplePromptTable from './SamplePromptTable.svelte';

describe('SamplePromptTable Component', () => {
  let sampleData: any[];

  beforeEach(() => {
    sampleData = [
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
  });

  it('renders table rows with tailored widths and dice toggle button', async () => {
    render(SamplePromptTable, { samples: sampleData });

    expect(screen.getByDisplayValue('A cinematic photo of a mountain')).toBeInTheDocument();
    expect(screen.getByDisplayValue('An abstract painting')).toBeInTheDocument();

    expect(screen.getByDisplayValue('512')).toBeInTheDocument();
    expect(screen.getByDisplayValue('768')).toBeInTheDocument();

    const diceButtons = screen.getAllByRole('button', { name: 'Toggle random seed' });
    expect(diceButtons).toHaveLength(2);
    expect(diceButtons[0]).toHaveClass('active');
    expect(diceButtons[1]).not.toHaveClass('active');
  });

  it('triggers onUpdate when checkbox is toggled', async () => {
    const onUpdate = vi.fn();
    render(SamplePromptTable, { samples: sampleData, onUpdate });

    const checkboxes = screen.getAllByRole('checkbox');
    await fireEvent.click(checkboxes[0]);

    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      enabled: false,
    }));
  });

  it('triggers onUpdate when width, height, seed, or prompt inputs change', async () => {
    const onUpdate = vi.fn();
    render(SamplePromptTable, { samples: sampleData, onUpdate });

    const widthInput = document.getElementById('sample-width-0') as HTMLInputElement;
    const heightInput = document.getElementById('sample-height-0') as HTMLInputElement;
    const seedInput = document.getElementById('sample-seed-0') as HTMLInputElement;

    await fireEvent.input(widthInput, { target: { value: '640' } });
    expect(onUpdate).not.toHaveBeenCalled();

    await fireEvent.change(widthInput, { target: { value: '640' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ width: 640 }));

    await fireEvent.change(heightInput, { target: { value: '896' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ height: 896 }));

    await fireEvent.change(seedInput, { target: { value: '999' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ seed: 999 }));

    const promptInput = screen.getByDisplayValue('A cinematic photo of a mountain');
    await fireEvent.change(promptInput, { target: { value: 'Updated prompt' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ prompt: 'Updated prompt' }));
  });

  it('normalizes fractional and invalid sampling inputs on change commit', async () => {
    const onUpdate = vi.fn();
    render(SamplePromptTable, { samples: sampleData, onUpdate });

    const widthInput = document.getElementById('sample-width-0') as HTMLInputElement;
    const seedInput = document.getElementById('sample-seed-0') as HTMLInputElement;

    await fireEvent.change(widthInput, { target: { value: '640.5' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ width: 640 }));

    await fireEvent.change(seedInput, { target: { value: '123.9' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ seed: 123 }));

    await fireEvent.change(widthInput, { target: { value: 'invalid' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ width: 512 }));

    await fireEvent.change(seedInput, { target: { value: 'invalid' } });
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ seed: -1 }));
  });

  it('toggles random seed when dice button is clicked', async () => {
    const onUpdate = vi.fn();
    render(SamplePromptTable, { samples: sampleData, onUpdate });

    const diceButtons = screen.getAllByRole('button', { name: 'Toggle random seed' });
    
    // Clicking on seed -1 sets it to 42
    await fireEvent.click(diceButtons[0]);
    expect(onUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ seed: 42 }));

    // Clicking on non-random seed (12345) sets it to -1
    await fireEvent.click(diceButtons[1]);
    expect(onUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ seed: -1 }));
  });

  it('calls action callbacks when Edit, Clone, and Delete buttons are clicked', async () => {
    const onEditModal = vi.fn();
    const onClone = vi.fn();
    const onDelete = vi.fn();

    render(SamplePromptTable, {
      samples: sampleData,
      onEditModal,
      onClone,
      onDelete,
    });

    const editButtons = screen.getAllByRole('button', { name: 'Edit sample prompt' });
    const cloneButtons = screen.getAllByRole('button', { name: 'Clone sample prompt' });
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete sample prompt' });

    await fireEvent.click(editButtons[0]);
    expect(onEditModal).toHaveBeenCalledWith(0);

    await fireEvent.click(cloneButtons[0]);
    expect(onClone).toHaveBeenCalledWith(0);

    await fireEvent.click(deleteButtons[1]);
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('calls onAdd callback when Add Sample Prompt button is clicked', async () => {
    const onAdd = vi.fn();
    render(SamplePromptTable, { samples: sampleData, onAdd });

    const addBtn = screen.getByRole('button', { name: /add sample prompt/i });
    await fireEvent.click(addBtn);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders each prompt only once, as an editable input', () => {
    render(SamplePromptTable, { samples: sampleData });

    const prompt = 'A cinematic photo of a mountain';
    expect(screen.getByDisplayValue(prompt)).toBeInTheDocument();
    expect(screen.queryByText(prompt)).not.toBeInTheDocument();
  });
});

