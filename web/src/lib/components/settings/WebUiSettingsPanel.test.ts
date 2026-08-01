import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebUiSettingsPanel from './WebUiSettingsPanel.svelte';
import { appearance } from '$lib/stores/appearance.svelte';

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced-motion') ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('WebUiSettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    setReducedMotion(false);
    appearance.setTheme('dark');
    appearance.setAnimations(true);
  });

  it('explains that these settings are not training config', () => {
    render(WebUiSettingsPanel);
    expect(screen.getByText(/not part of your training configuration/i)).toBeInTheDocument();
  });

  it('renders a theme control and an animations switch', () => {
    render(WebUiSettingsPanel);
    expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/animations/i)).toBeInTheDocument();
  });

  it('offers light, dark and system', () => {
    render(WebUiSettingsPanel);
    const select = screen.getByLabelText(/theme/i) as HTMLSelectElement;
    // ValueSelect maps option values to DOM-safe indices ('0', '1', ...) and
    // carries the real value through its label/onChange contract instead, so
    // the offered choices are asserted by label rather than by DOM value.
    const labels = [...select.options].map((o) => o.textContent?.trim());
    expect(labels).toEqual(expect.arrayContaining(['Light', 'Dark', 'System']));
  });

  it('notes that the OS is overriding when reduced motion is requested', () => {
    setReducedMotion(true);
    render(WebUiSettingsPanel);
    expect(screen.getByText(/system is set to reduce motion/i)).toBeInTheDocument();
  });

  it('shows no override note when the OS is not asking for reduced motion', () => {
    render(WebUiSettingsPanel);
    expect(screen.queryByText(/system is set to reduce motion/i)).toBeNull();
  });

  it('leaves the switch settable while the OS override is active', () => {
    setReducedMotion(true);
    render(WebUiSettingsPanel);
    expect(screen.getByLabelText(/animations/i)).not.toBeDisabled();
  });
});
