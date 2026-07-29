import { render, screen, cleanup } from '@testing-library/svelte';
import { expect, it, describe, beforeEach } from 'vitest';
import TrainingStatusPill from './TrainingStatusPill.svelte';
import { trainingStore } from '../../events/training-store';

describe('TrainingStatusPill', () => {
  beforeEach(() => {
    cleanup();
    trainingStore.reset();
  });

  it('renders the current training state under the requested test id', () => {
    render(TrainingStatusPill, { testId: 'pill-under-test' });

    const pill = screen.getByTestId('pill-under-test');
    expect(pill).toHaveTextContent('IDLE');
    expect(pill.className).toContain('text-muted-foreground');
  });

  it('uses semantic token classes rather than hex colours', () => {
    trainingStore.setStatus({ state: 'COMPLETED' } as any);
    render(TrainingStatusPill, { testId: 'pill-under-test' });

    const pill = screen.getByTestId('pill-under-test');
    expect(pill.className).toMatch(/success/);
    expect(pill.getAttribute('style') ?? '').not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('takes its display from the caller so CSS gating is not overridden', () => {
    render(TrainingStatusPill, { testId: 'pill-under-test', class: 'hidden md:inline-flex' });

    const pill = screen.getByTestId('pill-under-test');
    expect(pill.className).toContain('hidden');
    // A scoped `display` would beat the utility, since Svelte's styles are
    // unlayered and Tailwind's are in @layer utilities.
    expect(pill.className).toContain('md:inline-flex');
  });
});
