import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ValueSelect from './ValueSelect.svelte';

describe('ValueSelect', () => {
  it('renders primitive string options using index mapping and emits typed value on change', async () => {
    const onChange = vi.fn();
    render(ValueSelect, {
      id: 'fruit',
      value: 'banana',
      options: ['apple', 'banana', 'cherry'],
      onChange
    });
    const select = document.querySelector('#fruit') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('banana');

    await fireEvent.change(select, { target: { value: 'cherry' } });
    expect(onChange).toHaveBeenCalledWith('cherry');
  });

  it('renders primitive numeric options using index mapping and emits typed number on change', async () => {
    const onChange = vi.fn();
    render(ValueSelect, {
      id: 'numeric-select',
      value: 200,
      options: [100, 200, 300],
      onChange
    });
    const select = document.querySelector('#numeric-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('200');

    await fireEvent.change(select, { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('renders object options and maps serialized option index back to original typed value', async () => {
    const onChange = vi.fn();
    const options = [
      { value: 10, label: 'Ten' },
      { value: 20, label: 'Twenty' }
    ];
    render(ValueSelect, {
      id: 'num-select',
      value: 20,
      options,
      onChange
    });
    const select = document.querySelector('#num-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('20');

    await fireEvent.change(select, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('supports loose string equality comparison for selection index matching', () => {
    const options = [
      { value: 100, label: 'One Hundred' },
      { value: 200, label: 'Two Hundred' }
    ];
    render(ValueSelect, {
      id: 'loose-select',
      value: '200' as unknown as number,
      options
    });
    const select = document.querySelector('#loose-select') as HTMLSelectElement;
    expect(select.value).toBe('200');
  });

  it('renders placeholder as disabled option and marks it selected when value is unselected/empty', () => {
    render(ValueSelect, {
      id: 'placeholder-select',
      value: '',
      options: ['a', 'b'],
      placeholder: 'Choose an option...'
    });
    const select = document.querySelector('#placeholder-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.getAttribute('placeholder')).toBeNull();

    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
    const placeholderOpt = options[0];
    expect(placeholderOpt.value).toBe('');
    expect(placeholderOpt.textContent?.trim()).toBe('Choose an option...');
    expect(placeholderOpt.disabled).toBe(true);
    expect(placeholderOpt.selected).toBe(true);
    expect(select.value).toBe('');
  });

  it('renders placeholder as unselected when value matches a valid option', () => {
    render(ValueSelect, {
      id: 'placeholder-selected',
      value: 'b',
      options: ['a', 'b'],
      placeholder: 'Choose an option...'
    });
    const select = document.querySelector('#placeholder-selected') as HTMLSelectElement;
    const options = select.querySelectorAll('option');
    const placeholderOpt = options[0];
    expect(placeholderOpt.selected).toBe(false);
    expect(select.value).toBe('b');
  });

  it('forwards disabled, required, aria-describedby, blur and keydown events', async () => {
    const onBlur = vi.fn(), onKeyDown = vi.fn();
    render(ValueSelect, {
      id: 'full-select',
      value: '',
      options: ['a', 'b'],
      placeholder: 'Choose one...',
      disabled: false,
      required: true,
      'aria-describedby': 'help-text',
      onblur: onBlur,
      onkeydown: onKeyDown
    });
    const select = document.querySelector('#full-select') as HTMLSelectElement;
    expect(select).toBeRequired();
    expect(select).toHaveAttribute('aria-describedby', 'help-text');

    await fireEvent.blur(select);
    expect(onBlur).toHaveBeenCalled();

    await fireEvent.keyDown(select, { key: 'ArrowDown' });
    expect(onKeyDown).toHaveBeenCalled();
  });
});
