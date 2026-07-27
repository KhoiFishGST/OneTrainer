import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ huggingface_token: '', huggingface_token_set: false, webui_password_set: false }) })));

it('keeps password visibility names and saves exact secret payloads', async () => {
  render(Page);
  expect(await screen.findByLabelText('API Token')).toHaveAttribute('type', 'password');
  await fireEvent.click(screen.getByRole('button', { name: 'Show token' }));
  expect(screen.getByLabelText('API Token')).toHaveAttribute('type', 'text');
  await fireEvent.input(screen.getByLabelText('API Token'), { target: { value: 'hf_x' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Save Token' }));
  expect(fetch).toHaveBeenLastCalledWith('/api/secrets', expect.objectContaining({ method: 'POST', body: JSON.stringify({ huggingface_token: 'hf_x' }) }));
});
