import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockIsMobile } from '$lib/hooks/mock-is-mobile.svelte';
import ResponsiveDialogSheetTestWrapper from './ResponsiveDialogSheetTestWrapper.svelte';

vi.mock('$lib/hooks/is-mobile.svelte', () => ({
  get isMobile() {
    return mockIsMobile;
  },
}));

const mediaListeners = new Set<(e: MediaQueryListEvent) => void>();

function mockMatchMedia(matches: boolean) {
  mockIsMobile.current = matches;
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: matches ? 500 : 1024 });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn((cb) => mediaListeners.add(cb)),
      removeListener: vi.fn((cb) => mediaListeners.delete(cb)),
      addEventListener: vi.fn((type, cb) => {
        if (type === 'change' || !type) mediaListeners.add(cb);
      }),
      removeEventListener: vi.fn((type, cb) => {
        if (type === 'change' || !type) mediaListeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    })),
  });
  mediaListeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
}

describe('ResponsiveDialogSheet', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    mockMatchMedia(false);
  });

  it('renders role="dialog" in desktop mode', () => {
    mockMatchMedia(false);
    render(ResponsiveDialogSheetTestWrapper, { props: { open: true } });
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBe(1);
    expect(screen.getByText('Test Sheet Title')).toBeInTheDocument();
  });

  it('renders role="dialog" and phone content carries full-screen class in mobile mode', () => {
    mockMatchMedia(true);
    const { container } = render(ResponsiveDialogSheetTestWrapper, { props: { open: true } });
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBe(1);
    expect(screen.getByText('Test Sheet Title')).toBeInTheDocument();

    const fullScreenEl = container.querySelector('.full-screen') || screen.getByRole('dialog');
    expect(
      fullScreenEl.classList.contains('full-screen') ||
      fullScreenEl.classList.contains('inset-0') ||
      fullScreenEl.classList.contains('h-dvh') ||
      fullScreenEl.classList.contains('w-full')
    ).toBe(true);
  });

  it('renders only one branch at a time', () => {
    mockMatchMedia(false);
    render(ResponsiveDialogSheetTestWrapper, { props: { open: true } });
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBe(1);
  });

  it('calls onOpenChange(false) once on Escape key press', async () => {
    mockMatchMedia(false);
    const onOpenChange = vi.fn();
    render(ResponsiveDialogSheetTestWrapper, { props: { open: true, onOpenChange } });
    const dialog = screen.getByRole('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps supplied child draft state across parent rerenders', async () => {
    mockMatchMedia(false);
    const { rerender } = render(ResponsiveDialogSheetTestWrapper, { props: { open: true, parentCount: 1 } });
    const input = screen.getByTestId('draft-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'edited sheet draft' } });
    expect(input.value).toBe('edited sheet draft');

    await rerender({ open: true, parentCount: 2 });
    expect(screen.getByTestId('draft-input')).toHaveValue('edited sheet draft');
  });

  it('locks body scroll when open and applies safe-area-overlay class instead of undefined p-safe', () => {
    mockMatchMedia(true);
    render(ResponsiveDialogSheetTestWrapper, { props: { open: true } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();

    expect(
      document.body.style.overflow === 'hidden' ||
      document.body.hasAttribute('data-scroll-locked') ||
      document.body.classList.contains('scroll-locked')
    ).toBe(true);

    const overlayEl = dialog.classList.contains('safe-area-overlay') ? dialog : dialog.querySelector('.safe-area-overlay');
    expect(overlayEl).not.toBeNull();
    expect(dialog.classList.contains('p-safe')).toBe(false);
  });
});
