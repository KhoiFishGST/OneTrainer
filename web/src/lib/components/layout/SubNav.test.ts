import { fireEvent, render, screen, cleanup } from '@testing-library/svelte';
import { expect, it, describe, vi, beforeEach } from 'vitest';
import SubNav from './SubNav.svelte';

const ITEMS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'debug', label: 'Debug' },
  { id: 'tensors', label: 'Tensors' },
];

describe('SubNav', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('renders a tab per item for wide viewports', () => {
    render(SubNav, {
      items: ITEMS,
      value: 'debug',
      onChange: vi.fn(),
      label: 'General section',
    });

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Workspace', 'Debug', 'Tensors']);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Debug');
  });

  it('renders an equivalent labelled select for narrow viewports', () => {
    render(SubNav, {
      items: ITEMS,
      value: 'debug',
      onChange: vi.fn(),
      label: 'General section',
    });

    const select = screen.getByRole('combobox', { name: 'General section' });
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll('option')).toHaveLength(3);
  });

  it('reports the chosen section from the select', async () => {
    const onChange = vi.fn();

    render(SubNav, {
      items: ITEMS,
      value: 'workspace',
      onChange,
      label: 'General section',
    });

    const select = screen.getByRole('combobox', { name: 'General section' });
    // ValueSelect addresses options by index.
    await fireEvent.change(select, { target: { value: '2' } });

    expect(onChange).toHaveBeenCalledWith('tensors');
  });

  it('reports the chosen section from a tab', async () => {
    const onChange = vi.fn();

    render(SubNav, {
      items: ITEMS,
      value: 'workspace',
      onChange,
      label: 'General section',
    });

    await fireEvent.click(screen.getByRole('tab', { name: 'Debug' }));

    expect(onChange).toHaveBeenCalledWith('debug');
  });
});
