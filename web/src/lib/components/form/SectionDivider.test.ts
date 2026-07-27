import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import SectionDivider from './SectionDivider.svelte';

describe('SectionDivider.svelte', () => {
  it('renders section title and separator role', () => {
    render(SectionDivider, { title: 'Multi GPU' });
    const separator = screen.getByRole('separator');
    expect(separator).toBeDefined();
    expect(screen.getByText('Multi GPU')).toBeDefined();
  });
});
