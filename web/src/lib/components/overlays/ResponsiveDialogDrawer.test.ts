import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockIsMobile } from '$lib/hooks/mock-is-mobile.svelte';
import ResponsiveDialogDrawerTestWrapper from './ResponsiveDialogDrawerTestWrapper.svelte';

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

describe('ResponsiveDialogDrawer', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    mockMatchMedia(false);
  });

  it('renders role="dialog" in desktop mode', () => {
    mockMatchMedia(false);
    render(ResponsiveDialogDrawerTestWrapper, { props: { open: true } });
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBe(1);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders role="dialog" in mobile mode', () => {
    mockMatchMedia(true);
    render(ResponsiveDialogDrawerTestWrapper, { props: { open: true } });
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBe(1);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders only one branch at a time', () => {
    mockMatchMedia(false);
    const { container } = render(ResponsiveDialogDrawerTestWrapper, { props: { open: true } });
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBe(1);
  });

  it('calls onOpenChange(false) once on Escape key press', async () => {
    mockMatchMedia(false);
    const onOpenChange = vi.fn();
    render(ResponsiveDialogDrawerTestWrapper, { props: { open: true, onOpenChange } });
    const dialog = screen.getByRole('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps supplied child draft state across parent rerenders', async () => {
    mockMatchMedia(false);
    const { rerender } = render(ResponsiveDialogDrawerTestWrapper, { props: { open: true, parentCount: 1 } });
    const input = screen.getByTestId('draft-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'edited draft' } });
    expect(input.value).toBe('edited draft');

    await rerender({ open: true, parentCount: 2 });
    expect(screen.getByTestId('draft-input')).toHaveValue('edited draft');
  });

  it('restores trigger focus when dialog closes', async () => {
    mockMatchMedia(false);
    const trigger = document.createElement('button');
    trigger.id = 'external-trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(ResponsiveDialogDrawerTestWrapper, { props: { open: true } });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await rerender({ open: false });
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('locks body scroll when open and applies safe-area-overlay class in mobile mode', () => {
    mockMatchMedia(true);
    render(ResponsiveDialogDrawerTestWrapper, { props: { open: true } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();

    expect(
      document.body.style.overflow === 'hidden' ||
      document.body.hasAttribute('data-scroll-locked') ||
      document.body.classList.contains('scroll-locked')
    ).toBe(true);

    expect(dialog.classList.contains('safe-area-overlay') || dialog.querySelector('.safe-area-overlay') !== null).toBe(true);
    expect(dialog.classList.contains('p-safe')).toBe(false);
  });

  it('pads the drawer body so content clears the card edge', () => {
    mockMatchMedia(true);
    render(ResponsiveDialogDrawerTestWrapper, {});

    const body = screen.getByTestId('content').parentElement!;
    expect(body.className).toContain('px-4');
  });

  it('leaves the desktop dialog body unpadded, since Dialog.Content already pads it', () => {
    mockMatchMedia(false);
    render(ResponsiveDialogDrawerTestWrapper, {});

    const body = screen.getByTestId('content').parentElement!;
    // Doubling p-4 from Dialog.Content with another px-4 would inset desktop
    // content twice.
    expect(body.className).not.toContain('px-4');
  });

  it('drops body padding entirely when flush is set', () => {
    mockMatchMedia(true);
    render(ResponsiveDialogDrawerTestWrapper, { flush: true });

    const body = screen.getByTestId('content').parentElement!;
    expect(body.className).not.toContain('px-4');
    expect(body.className).not.toContain('pt-4');
    expect(body.className).not.toContain('pb-4');
  });

  it('adds top padding only when there is no header to supply it', () => {
    mockMatchMedia(true);
    const { unmount } = render(ResponsiveDialogDrawerTestWrapper, {});
    expect(screen.getByTestId('content').parentElement!.className).not.toContain('pt-4');
    unmount();
    cleanup();

    // Svelte's default-parameter semantics mean an explicit `undefined` prop is
    // indistinguishable from an omitted one, so the wrapper's own `title =
    // 'Test Title'` default would still apply; an empty string sentinel bypasses
    // that default while still failing the `title || description` truthiness
    // check in ResponsiveDialogDrawer.
    render(ResponsiveDialogDrawerTestWrapper, { title: '', description: '' });
    expect(screen.getByTestId('content').parentElement!.className).toContain('pt-4');
  });

  it('adds bottom padding only when there is no footer to supply it', () => {
    mockMatchMedia(true);
    const { unmount } = render(ResponsiveDialogDrawerTestWrapper, {});
    expect(screen.getByTestId('content').parentElement!.className).not.toContain('pb-4');
    unmount();
    cleanup();

    render(ResponsiveDialogDrawerTestWrapper, { withFooter: false });
    expect(screen.getByTestId('content').parentElement!.className).toContain('pb-4');
  });
});
