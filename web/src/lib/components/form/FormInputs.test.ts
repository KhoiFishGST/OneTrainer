import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { expect, it, vi } from 'vitest';
import TextInput from './TextInput.svelte';
import NumberInput from './NumberInput.svelte';
import Checkbox from './Checkbox.svelte';
import Toggle from './Toggle.svelte';
import TextArea from './TextArea.svelte';

it('supports password metadata, input/change/keydown, and imperative focus', async () => {
  const onInput = vi.fn(), onChange = vi.fn(), onKeyDown = vi.fn();
  const result = render(TextInput, { id:'password', type:'password', value:'secret', autocomplete:'current-password', required:true, autofocus:true, onInput, onChange, onKeyDown });
  const input = document.querySelector('#password') as HTMLInputElement;
  expect(input).toHaveAttribute('type','password');
  expect(input).toHaveAttribute('autocomplete','current-password');
  expect(input).toBeRequired();
  await fireEvent.input(input, { target:{ value:'new' } });
  await fireEvent.change(input, { target:{ value:'new' } });
  await fireEvent.keyDown(input, { key:'Enter' });
  expect(onInput).toHaveBeenCalledWith('new');
  expect(onChange).toHaveBeenCalledWith('new');
  expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key:'Enter' }));
  result.component.focus();
  expect(input).toHaveFocus();
});

it('renders optional input adornments without changing the native input',()=>{
  const startAdornment=createRawSnippet(()=>({render:()=>'<span>Search icon</span>'}));
  const endAdornment=createRawSnippet(()=>({render:()=>'<span>Clear</span>'}));
  render(TextInput,{id:'search',type:'search',startAdornment,endAdornment});
  expect(screen.getByText('Search icon')).toBeVisible();
  expect(screen.getByText('Clear')).toBeVisible();
  expect(document.querySelector('#search')).toHaveAttribute('type','search');
});

it('emits incomplete numeric edits as strings without NaN conversion', async () => {
  const onInput = vi.fn(), onChange = vi.fn();
  render(NumberInput, { id:'amount', value:'1', min:0, max:10, step:0.1, onInput, onChange });
  const input = document.querySelector('#amount') as HTMLInputElement;
  expect(input).toHaveAttribute('inputmode','decimal');
  expect(input).toHaveAttribute('min','0');
  await fireEvent.input(input, { target:{ value:'-' } });
  await fireEvent.change(input, { target:{ value:'1.' } });
  expect(onInput).toHaveBeenCalledWith('-');
  expect(onChange).toHaveBeenCalledWith('1.');
});

it('emits booleans from checkbox and toggle', async () => {
  const checkboxChange = vi.fn(), toggleChange = vi.fn();
  render(Checkbox, { id:'compact', value:false, onChange:checkboxChange });
  render(Toggle, { id:'setting', value:true, onChange:toggleChange });
  await fireEvent.click(document.querySelector('#compact')!);
  await fireEvent.click(document.querySelector('#setting')!);
  expect(checkboxChange).toHaveBeenCalledWith(true);
  expect(toggleChange).toHaveBeenCalledWith(false);
});

it('emits textarea input/change values and the blur event', async () => {
  const onInput = vi.fn(), onChange = vi.fn(), onBlur = vi.fn();
  render(TextArea, { id:'caption', value:'old', rows:3, onInput, onChange, onBlur });
  const area = document.querySelector('#caption')!;
  await fireEvent.input(area, { target:{ value:'draft' } });
  await fireEvent.change(area, { target:{ value:'saved' } });
  await fireEvent.blur(area);
  expect(onInput).toHaveBeenCalledWith('draft');
  expect(onChange).toHaveBeenCalledWith('saved');
  expect(onBlur).toHaveBeenCalledWith('saved', expect.any(FocusEvent));
});
