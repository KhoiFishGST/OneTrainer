import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import RoutePage from './RoutePage.svelte';

describe('RoutePage', () => {
  it('renders as a single .route-page element', () => {
    const { container } = render(RoutePage);
    const root = container.querySelector('.route-page');
    expect(root).toBeInTheDocument();
    expect(root?.tagName).toBe('DIV');
  });

  it('appends a caller-supplied class alongside .route-page', () => {
    const { container } = render(RoutePage, { class: 'gap-tight' });
    const root = container.querySelector('.route-page');
    expect(root).toHaveClass('route-page');
    expect(root?.className).toContain('gap-tight');
  });

  it('renders nothing but the container when given no children', () => {
    const { container } = render(RoutePage);
    expect(container.querySelector('.route-page')?.children.length).toBe(0);
  });
});
