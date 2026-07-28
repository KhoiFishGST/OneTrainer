import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import { Input } from '$lib/components/ui/input/index.js';
import { Textarea } from '$lib/components/ui/textarea/index.js';
import { Checkbox } from '$lib/components/ui/checkbox/index.js';
import { Switch } from '$lib/components/ui/switch/index.js';
import NumericDraftInput from './NumericDraftInput.svelte';
import SchemaForm from './SchemaForm.svelte';


it('supports password metadata, input/change/keydown in Input', async () => {
  const oninput = vi.fn(), onchange = vi.fn(), onkeydown = vi.fn();
  render(Input, { id:'password', type:'password', value:'secret', autocomplete:'current-password', required:true, autofocus:true, oninput, onchange, onkeydown });
  const input = document.querySelector('#password') as HTMLInputElement;
  expect(input).toHaveAttribute('type','password');
  expect(input).toHaveAttribute('autocomplete','current-password');
  expect(input).toBeRequired();
  await fireEvent.input(input, { target:{ value:'new' } });
  await fireEvent.change(input, { target:{ value:'new' } });
  await fireEvent.keyDown(input, { key:'Enter' });
  expect(oninput).toHaveBeenCalled();
  expect(onchange).toHaveBeenCalled();
  expect(onkeydown).toHaveBeenCalledWith(expect.objectContaining({ key:'Enter' }));
});

it('emits incomplete numeric edits as strings via NumericDraftInput', async () => {
  const onInput = vi.fn();
  render(NumericDraftInput, { id:'amount', value:'1', type:'text', min:0, max:10, step:0.1, onInput });
  const input = document.querySelector('#amount') as HTMLInputElement;
  expect(input).toHaveAttribute('min','0');
  await fireEvent.input(input, { target:{ value:'-' } });
  expect(onInput).toHaveBeenCalledWith('-');
});

it('supports checkbox and switch primitives', async () => {
  const { container } = render(Checkbox, { id:'compact', checked:false });
  render(Switch, { id:'setting', checked:true });
  const cb = container.querySelector('#compact');
  expect(cb).toBeInTheDocument();
});

it('emits textarea input/change values', async () => {
  const oninput = vi.fn(), onchange = vi.fn();
  render(Textarea, { id:'caption', value:'old', rows:3, oninput, onchange });
  const area = document.querySelector('#caption')!;
  await fireEvent.input(area, { target:{ value:'draft' } });
  await fireEvent.change(area, { target:{ value:'saved' } });
  expect(oninput).toHaveBeenCalled();
  expect(onchange).toHaveBeenCalled();
});

it('always includes help text in input aria-describedby and accessibility tree even when tooltip is closed', () => {
  render(SchemaForm, {
    tab: {
      id: "help_test",
      label: "Help Test",
      groups: [
        {
          id: "g",
          fields: [
            {
              id: "username",
              keys: ["username"],
              label: "Username",
              tooltip: "Enter your handle",
              control: "text",
            },
          ],
        },
      ],
    },
    values: { username: "" },
    issues: [],
    setRaw: vi.fn(),
  });

  const input = screen.getByLabelText("Username");
  const describedBy = input.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();

  const helpEl = document.getElementById(describedBy!);
  expect(helpEl).toBeInTheDocument();
  expect(helpEl).toHaveTextContent("Enter your handle");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
