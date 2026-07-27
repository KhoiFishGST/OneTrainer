import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Invalid password' }) })));

it('keeps required autofocus password and explicit submit behavior', async () => {
  render(Page);
  const input = screen.getByLabelText('Password');
  expect(input).toBeRequired();
  expect(input).toHaveAttribute('autofocus');
  await fireEvent.input(input, { target: { value: 'bad' } });
  const submit = screen.getByRole('button', { name: 'Sign In' });
  expect(submit).toHaveAttribute('type', 'submit');
  await fireEvent.click(submit);
  expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'bad' }) }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid password');
});
