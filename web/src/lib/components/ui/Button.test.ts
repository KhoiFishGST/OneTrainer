import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import Button from './Button.svelte';

it('defaults to type button and forwards presentation, attributes, and clicks', async () => {
  const onclick = vi.fn();
  render(Button, {
    variant: 'danger',
    size: 'icon',
    class: 'feature-button',
    'aria-label': 'Delete item',
    title: 'Delete',
    onclick,
  });
  const button = screen.getByRole('button', { name: 'Delete item' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveClass('button', 'button--danger', 'button--icon', 'feature-button');
  expect(button).toHaveAttribute('title', 'Delete');
  await fireEvent.click(button);
  expect(onclick).toHaveBeenCalledOnce();
});

it('preserves explicit submit type and native disabled behavior', async () => {
  const onclick = vi.fn();
  render(Button, { type: 'submit', disabled: true, 'aria-label': 'Sign in', onclick });
  const button = screen.getByRole('button', { name: 'Sign in' });
  expect(button).toHaveAttribute('type', 'submit');
  expect(button).toBeDisabled();
  await fireEvent.click(button);
  expect(onclick).not.toHaveBeenCalled();
});
