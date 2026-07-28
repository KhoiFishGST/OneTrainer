import { fireEvent, render, screen, waitFor, act } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        huggingface_token: 'hf_existing',
        huggingface_token_set: true,
        webui_password_set: true,
      }),
    })
  );
});

describe('Secrets Page', () => {
  it('keeps password visibility names and saves exact secret payloads for token and password', async () => {
    render(Page);
    expect(await screen.findByLabelText('API Token')).toHaveAttribute('type', 'password');
    await fireEvent.click(screen.getByRole('button', { name: 'Show token' }));
    expect(screen.getByLabelText('API Token')).toHaveAttribute('type', 'text');
    await fireEvent.input(screen.getByLabelText('API Token'), { target: { value: 'hf_new_token' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save Token' }));
    expect(fetch).toHaveBeenLastCalledWith('/api/secrets', expect.objectContaining({ method: 'POST', body: JSON.stringify({ huggingface_token: 'hf_new_token' }) }));

    await fireEvent.input(screen.getByLabelText('New Web Portal Password'), { target: { value: 'secretpass' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(fetch).toHaveBeenLastCalledWith('/api/secrets', expect.objectContaining({ method: 'POST', body: JSON.stringify({ webui_password: 'secretpass' }) }));
  });

  it('dismisses the success toast after exactly 3000ms', async () => {
    render(Page);
    await screen.findByLabelText('API Token');
    vi.useFakeTimers();

    try {
      await fireEvent.click(screen.getByRole('button', { name: 'Save Token' }));
      await Promise.resolve();
      await tick();

      expect(screen.getByRole('status')).toHaveTextContent('Secrets saved successfully!');
      await vi.advanceTimersByTimeAsync(2999);
      expect(screen.getByRole('status')).toHaveTextContent('Secrets saved successfully!');
      await vi.advanceTimersByTimeAsync(1);
      await tick();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('triggers Alert Dialog confirmation prompt before clearing password, handles pending state, prevents duplicate calls, retains error on failure, and closes on resolution', async () => {
    let resolveFetch: (v?: any) => void = () => {};
    let rejectFetch: (e: any) => void = () => {};

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: any) => {
        if (init?.method === 'POST') {
          return new Promise((res, rej) => {
            resolveFetch = res;
            rejectFetch = rej;
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            huggingface_token: 'hf_existing',
            huggingface_token_set: true,
            webui_password_set: true,
          }),
        });
      })
    );

    render(Page);
    await screen.findByLabelText('New Web Portal Password');

    const clearBtn = screen.getByRole('button', { name: 'Clear Password' });
    await fireEvent.click(clearBtn);

    // Should open confirmation Alert Dialog
    const alertDialog = screen.getByRole('alertdialog');
    expect(alertDialog).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear password protection/i)).toBeInTheDocument();

    // Confirm action
    const confirmBtn = screen.getByRole('button', { name: /Confirm Clear/i });
    await fireEvent.click(confirmBtn);

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/secrets',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ webui_password: '' }) })
    );

    // Dialog remains open and confirm button is disabled while pending
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(confirmBtn).toBeDisabled();

    // Second click while pending does not duplicate fetch
    const fetchCallCount = vi.mocked(fetch).mock.calls.length;
    await fireEvent.click(confirmBtn);
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCallCount);

    // Reject fetch call -> error alert shown, dialog remains open
    await act(async () => {
      resolveFetch({
        ok: false,
        json: async () => ({ message: 'Failed to clear password' }),
      });
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Click confirm clear again to retry
    await fireEvent.click(confirmBtn);

    // Resolve fetch call successfully
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          huggingface_token_set: true,
          webui_password_set: false,
        }),
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });
});
