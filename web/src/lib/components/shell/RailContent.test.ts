import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, describe } from 'vitest';
import RailContentTestWrapper from './RailContentTestWrapper.svelte';

describe('RailContent component', () => {
  it('uses compact 32px height and tight padding for mobile nav items', async () => {
    render(RailContentTestWrapper, { mobile: true });

    const trigger = screen.queryByTestId('open-sidebar');
    if (trigger) {
      await fireEvent.click(trigger);
    }

    const liveLink = screen.getByText('Live').closest('a');
    expect(liveLink?.className).toContain('max-md:min-h-[32px]');
    expect(liveLink?.className).toContain('max-md:px-2');
    expect(liveLink?.className).toContain('max-md:text-xs');
  });
});
