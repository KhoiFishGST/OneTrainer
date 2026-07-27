import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import Button from './Button.svelte';
import buttonSource from './Button.svelte?raw';

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

it('keeps the shared 44px mobile touch target above feature overrides', () => {
  expect(buttonSource).toMatch(
    /@media \(max-width: 768px\)[\s\S]*?:where\(\.button\)[\s\S]*?min-height: 44px !important;/,
  );
});
