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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('route transition', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/lib/components/layout/RoutePage.svelte'),
    'utf-8'
  );

  it('animates on mount using the motion tokens', () => {
    expect(source).toContain('animation: route-page-in var(--motion-duration-enter)');
    expect(source).toContain('var(--motion-ease-enter)');
  });

  it('has no exit animation, which would delay navigation', () => {
    expect(source).not.toContain('--motion-duration-exit');
  });

  it('moves by the travel token rather than a literal distance', () => {
    expect(source).toContain('translateY(var(--motion-travel))');
  });
});
