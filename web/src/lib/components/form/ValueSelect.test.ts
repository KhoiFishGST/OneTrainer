import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ValueSelect from './ValueSelect.svelte';

describe('ValueSelect', () => {
  it('renders primitive options and emits typed value on change', async () => {
    const onChange = vi.fn();
    render(ValueSelect, {
      id: 'fruit',
      value: 'banana',
      options: ['apple', 'banana', 'cherry'],
      onChange
    });
    const select = document.querySelector('#fruit') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    await fireEvent.change(select, { target: { value: 'cherry' } });
    expect(onChange).toHaveBeenCalledWith('cherry');
  });

  it('renders object options and maps serialized option ID back to original typed value', async () => {
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

    await fireEvent.change(select, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('supports loose string equality comparison for selection', () => {
    const options = [
      { value: 100, label: 'One Hundred' },
      { value: 200, label: 'Two Hundred' }
    ];
    // string '200' should match numeric 200
    render(ValueSelect, {
      id: 'loose-select',
      value: '200' as unknown as number,
      options
    });
    const select = document.querySelector('#loose-select') as HTMLSelectElement;
    expect(select.value).toBe('200');
  });

  it('forwards placeholder, disabled, required, aria-describedby, blur and keydown', async () => {
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
