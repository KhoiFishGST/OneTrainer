import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ModalDialog from './ModalDialog.svelte';

describe('ModalDialog', () => {
  it('renders when open is true and responds to close', async () => {
    const onClose = vi.fn();
    render(ModalDialog, { props: { open: true, title: 'Test Modal', onClose } });
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render content when open is false', () => {
    render(ModalDialog, { props: { open: false, title: 'Test Modal', onClose: vi.fn() } });
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders accessibility attributes role="dialog" and aria-modal="true"', () => {
    render(ModalDialog, { props: { open: true, title: 'Accessible Dialog', onClose: vi.fn() } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('triggers onClose when Cancel button is clicked', async () => {
    const onClose = vi.fn();
    render(ModalDialog, { props: { open: true, title: 'Test Modal', onClose } });
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onApply when Apply button is clicked', async () => {
    const onApply = vi.fn();
    render(ModalDialog, { props: { open: true, title: 'Test Modal', onClose: vi.fn(), onApply } });
    const applyBtn = screen.getByRole('button', { name: /apply/i });
    await fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    render(ModalDialog, { props: { open: true, title: 'Test Modal', onClose } });
    const dialog = screen.getByRole('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when backdrop overlay is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(ModalDialog, { props: { open: true, title: 'Test Modal', onClose } });
    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      await fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });
});
