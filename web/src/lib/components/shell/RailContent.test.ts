import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, describe } from 'vitest';
import RailContentTestWrapper from './RailContentTestWrapper.svelte';

describe('RailContent component', () => {
  it('uses 36px min height with touch target overlay on mobile nav items', async () => {
    render(RailContentTestWrapper, { mobile: true });

    const trigger = screen.queryByTestId('open-sidebar');
    if (trigger) {
      await fireEvent.click(trigger);
    }

    const liveLink = screen.getByText('Live').closest('a');
    expect(liveLink?.className).toContain('max-md:min-h-[36px]');
    expect(liveLink?.className).toContain('max-md:px-2');
    expect(liveLink?.className).toContain('max-md:text-xs');
  });

  it('overrides the sheet width at the same variant so the sidebar width wins', async () => {
    render(RailContentTestWrapper, { mobile: true });

    const trigger = screen.queryByTestId('open-sidebar');
    if (trigger) {
      await fireEvent.click(trigger);
    }

    const panel = screen.getByText('Live').closest('[role="dialog"]');
    // `w-(--sidebar-width)` alone loses to sheet-content's
    // `data-[side=left]:w-3/4`, which carries an attribute qualifier and so
    // has higher specificity. Matching the variant lets tailwind-merge drop
    // the loser instead.
    expect(panel?.className).toContain('data-[side=left]:w-[var(--sidebar-width)]');
  });
});
