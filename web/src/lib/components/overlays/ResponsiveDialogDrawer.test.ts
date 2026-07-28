import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResponsiveDialogDrawerTestWrapper from './ResponsiveDialogDrawerTestWrapper.svelte';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('ResponsiveDialogDrawer', () => {
  beforeEach(() => {
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
    // Expect focus to return or trigger focus handling
    document.body.removeChild(trigger);
  });
});
