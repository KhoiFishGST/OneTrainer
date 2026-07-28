import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import NumericDraftInput from './NumericDraftInput.svelte';

describe('NumericDraftInput', () => {
  it('forwards numeric constraints and ARIA attributes', () => {
    render(NumericDraftInput, {
      id: 'weight',
      value: 1,
      min: 0,
      max: 10,
      step: 0.1,
      'aria-label': 'Weight input',
      'aria-describedby': 'weight-desc'
    });
    const input = document.querySelector('#weight') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '10');
    expect(input).toHaveAttribute('step', '0.1');
    expect(input).toHaveAttribute('aria-label', 'Weight input');
    expect(input).toHaveAttribute('aria-describedby', 'weight-desc');
  });

  it('emits incomplete numeric draft values directly without parsing', async () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(NumericDraftInput, {
      id: 'draft',
      value: '',
      onInput,
      onChange
    });
    const input = document.querySelector('#draft') as HTMLInputElement;

    const testDrafts = ['', '-', '1.', '1e'];
    for (const draft of testDrafts) {
      await fireEvent.input(input, { target: { value: draft } });
      expect(onInput).toHaveBeenLastCalledWith(draft);
      await fireEvent.change(input, { target: { value: draft } });
      expect(onChange).toHaveBeenLastCalledWith(draft);
    }
  });
});
