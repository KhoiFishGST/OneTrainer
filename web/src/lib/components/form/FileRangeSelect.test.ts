import { fireEvent, render } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import { FileInput } from '$lib/components/ui/file-input/index.js';
import { Slider } from '$lib/components/ui/slider/index.js';
import ValueSelect from './ValueSelect.svelte';

it('forwards file metadata, emits FileList, and opens imperatively', async () => {
  const onChange = vi.fn();
  const result = render(FileInput, { id: 'files', accept: 'image/*,.txt', multiple: true, onChange });
  const input = document.querySelector('#files') as HTMLInputElement;
  const file = new File(['x'], 'x.txt');
  const files = { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) } as unknown as FileList;
  Object.defineProperty(input, 'files', { configurable: true, writable: true, value: files });
  const click = vi.spyOn(input, 'click');
  await fireEvent.change(input);
  expect(onChange).toHaveBeenCalledWith(files);
  expect(input).toHaveAttribute('accept', 'image/*,.txt');
  expect(input).toHaveAttribute('multiple');
  result.component.open();
  expect(click).toHaveBeenCalledOnce();
});

it('renders slider control', async () => {
  const { container } = render(Slider, { type: 'single', value: [0], min: 0, max: 100, step: 1 } as any);
  expect(container.firstElementChild).toBeInTheDocument();
});

it('keeps ValueSelect options and selection behavior', async () => {
  const onChange = vi.fn();
  render(ValueSelect, { id: 'kind', value: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], onChange });
  const select = document.querySelector('#kind') as HTMLSelectElement;
  expect(select.value).toBe('0');
  await fireEvent.change(select, { target: { value: '1' } });
  expect(onChange).toHaveBeenCalledWith('b');
});
