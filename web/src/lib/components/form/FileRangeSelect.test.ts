import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import FileInput from './FileInput.svelte';
import RangeInput from './RangeInput.svelte';
import Select from './Select.svelte';

it('forwards file metadata, emits FileList, and opens imperatively', async () => {
  const onChange = vi.fn();
  const result = render(FileInput, { id: 'files', accept: 'image/*,.txt', multiple: true, onChange });
  const input = document.querySelector('#files') as HTMLInputElement;
  const file = new File(['x'], 'x.txt');
  const files = { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) } as unknown as FileList;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  const click = vi.spyOn(input, 'click');
  await fireEvent.change(input);
  expect(onChange).toHaveBeenCalledWith(files);
  expect(input).toHaveAttribute('accept', 'image/*,.txt');
  expect(input).toHaveAttribute('multiple');
  result.component.open();
  expect(click).toHaveBeenCalledOnce();
});

it('emits a number from range input', async () => {
  const onInput = vi.fn();
  render(RangeInput, { id: 'ema', value: 0, min: 0, max: 0.99, step: 0.01, 'aria-label': 'EMA Smoothing', onInput });
  await fireEvent.input(screen.getByLabelText('EMA Smoothing'), { target: { value: '.6' } });
  expect(onInput).toHaveBeenCalledWith(0.6);
});

it('keeps Select trigger/options/native select ownership and selection behavior', async () => {
  const onChange = vi.fn();
  const { container } = render(Select, { id: 'kind', value: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], onChange });
  expect(container.querySelector('.select-trigger')).toBeInstanceOf(HTMLButtonElement);
  expect(screen.getByRole('combobox')).toHaveValue('a');
  await fireEvent.click(container.querySelector('.select-trigger')!);
  await fireEvent.click(screen.getAllByRole('option', { name: 'B' })[0]);
  expect(onChange).toHaveBeenCalledWith('b');
});
