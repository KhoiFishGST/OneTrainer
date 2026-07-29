import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, describe } from 'vitest';
import RailContentTestWrapper from './RailContentTestWrapper.svelte';

describe('RailContent component', () => {
  it('lets mobile nav rows share the drawer height instead of overlaying a target', async () => {
    render(RailContentTestWrapper, { mobile: true });

    const trigger = screen.queryByTestId('open-sidebar');
    if (trigger) {
      await fireEvent.click(trigger);
    }

    const liveLink = screen.getByText('Live').closest('a');
    expect(liveLink?.className).toContain('max-md:h-full');
    expect(liveLink?.className).toContain('max-md:px-2');
    expect(liveLink?.className).toContain('max-md:text-xs');
    // The ::after overlay is gone: adjacent overlays overlapped, and the
    // later sibling won the tap. Rows clear 44px on their own now.
    expect(liveLink?.className).not.toContain('after:-top-1');
    expect(liveLink?.closest('li')?.className).toContain('flex-1');
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
    // has higher specificity. Matching the variant is what wins -- but not by
    // tailwind-merge dropping the loser: the two classes sit in different
    // tailwind-merge groups (`w` vs `data-[side=left]:w`), so both reach the
    // DOM. They tie on specificity, and Tailwind sorts arbitrary values after
    // named ones, so ours lands later in the stylesheet and takes effect. The
    // e2e asserts the rendered width; this only pins the class.
    expect(panel?.className).toContain('data-[side=left]:w-[var(--sidebar-width)]');
  });
});
