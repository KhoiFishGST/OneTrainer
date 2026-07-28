import { describe, expect, it } from 'vitest';

const uiSources = import.meta.glob('/src/lib/components/ui/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Tailwind v4 compiles a bare `data-foo:` variant to `[data-foo]` — an attribute
 * PRESENCE selector. Bits UI mostly emits `data-state="..."` values instead, so a
 * bare variant silently never matches (or matches always, when we emit the
 * attribute with a "false" value). Only these are verified real presence
 * attributes and may be used bare.
 */
const PRESENCE_ATTRIBUTES = ['disabled', 'inset', 'selected', 'placeholder'];

export function findBareDataVariants(source: string, filename: string): string[] {
  const violations: string[] = [];
  // Matches `data-foo:` but not `data-[foo=bar]:`
  const bare = /(?<![[\w-])data-([a-z][a-z0-9-]*):/g;
  let m: RegExpExecArray | null;
  while ((m = bare.exec(source)) !== null) {
    const attr = m[1];
    if (PRESENCE_ATTRIBUTES.includes(attr)) continue;
    violations.push(`${filename}: bare variant data-${attr}: matches [data-${attr}] by presence`);
  }
  return violations;
}

describe('UI data-variant boundary', () => {
  it('flags a bare variant in fixture source', () => {
    expect(findBareDataVariants('class="data-checked:bg-primary"', '/x.svelte')).toHaveLength(1);
  });

  it('allows the value-based form', () => {
    expect(findBareDataVariants('class="data-[state=checked]:bg-primary"', '/x.svelte')).toEqual([]);
  });

  it('allows verified presence attributes', () => {
    expect(findBareDataVariants('class="data-disabled:opacity-50"', '/x.svelte')).toEqual([]);
  });

  it('has no bare data variants anywhere in ui/', () => {
    const violations = Object.entries(uiSources).flatMap(([file, source]) =>
      findBareDataVariants(source, file)
    );
    expect(violations).toEqual([]);
  });
});
