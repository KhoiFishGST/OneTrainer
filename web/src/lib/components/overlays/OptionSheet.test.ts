import { fireEvent, render, screen, cleanup } from '@testing-library/svelte';
import { expect, it, describe, vi, beforeEach } from 'vitest';
import OptionSheet from './OptionSheet.svelte';

const OPTIONS = [
  { value: 'FINE_TUNE', label: 'Fine Tune' },
  { value: 'LORA', label: 'LoRA' },
  { value: 'EMBEDDING', label: 'Embedding' },
];

describe('OptionSheet', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('lists every option and marks the current one as selected', async () => {
    render(OptionSheet, {
      open: true,
      title: 'Training Method',
      options: OPTIONS,
      value: 'LORA',
      onSelect: vi.fn(),
      onOpenChange: vi.fn(),
    });

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.textContent?.trim())).toEqual([
      'Fine Tune',
      'LoRA',
      'Embedding',
    ]);

    const selected = await screen.findByRole('option', { selected: true });
    expect(selected).toHaveTextContent('LoRA');
  });

  it('reports the chosen value and closes itself', async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(OptionSheet, {
      open: true,
      title: 'Training Method',
      options: OPTIONS,
      value: 'LORA',
      onSelect,
      onOpenChange,
    });

    await fireEvent.click(await screen.findByRole('option', { name: 'Fine Tune' }));

    expect(onSelect).toHaveBeenCalledWith('FINE_TUNE');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders nothing while closed', () => {
    render(OptionSheet, {
      open: false,
      title: 'Training Method',
      options: OPTIONS,
      value: '',
      onSelect: vi.fn(),
      onOpenChange: vi.fn(),
    });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
