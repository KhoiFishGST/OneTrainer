import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Invalid password' }) }));
});

describe('Login Page', () => {
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

  it('renders theme-aware portal card container and branding', () => {
    const { container } = render(Page);
    expect(container.querySelector('.login-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.login-container')).toBeInTheDocument();
    expect(screen.getByText('OneTrainer Portal')).toBeInTheDocument();
    expect(screen.getByText('Protected Instance Access')).toBeInTheDocument();
  });

  it('displays insecure HTTP warning when accessed over non-localhost HTTP', () => {
    const originalLocation = window.location;
    const mockLocation = new URL('http://remote-server:8080/login') as unknown as Location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: mockLocation,
    });

    try {
      render(Page);
      expect(screen.getByText('Insecure HTTP Connection')).toBeInTheDocument();
      expect(screen.getByText(/Your password will be transmitted in plain text/i)).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    }
  });
});
