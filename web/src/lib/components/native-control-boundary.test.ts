import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const uiRoot = '/src/lib/components/ui/';
const native = new Set(['button', 'input', 'select', 'option', 'textarea']);
const sources = import.meta.glob('/src/**/*.svelte', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function findNative(source: string, filename: string): string[] {
  const ast = parse(source, { filename, modern: true });
  const found: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    const record = node as Record<string, unknown>;
    let name: string | undefined;
    if (record.type === 'RegularElement' && typeof record.name === 'string') {
      name = record.name;
    } else if (record.type === 'SvelteElement' && record.tag && typeof record.tag === 'object') {
      const tag = record.tag as Record<string, unknown>;
      if (tag.type === 'Literal' && typeof tag.value === 'string') name = tag.value;
    }
    if (name && typeof record.start === 'number' && native.has(name)) {
      const line = source.slice(0, record.start).split('\n').length;
      found.push(`${filename}:${line} <${name}>`);
    }
    for (const value of Object.values(record)) visit(value);
  };
  visit(ast.fragment);
  return found;
}

describe('native control ownership', () => {
  it('detects forbidden native markup through the modern fragment AST', () => {
    expect(findNative('<script>const sample="<button>";</script><!-- <input> --><section><button>Save</button></section>', 'fixture.svelte')).toEqual(['fixture.svelte:1 <button>']);
  });
  it('detects a literal native svelte:element without failing closed on dynamic tags', () => {
    const source = '<div>\n<svelte:element this="button">Save</svelte:element>\n<svelte:element this={tag}>Dynamic</svelte:element>\n</div>';
    expect(findNative(source, 'fixture.svelte')).toEqual(['fixture.svelte:2 <button>']);
  });
  it('allows native controls only in canonical UI source', () => {
    const violations = Object.entries(sources).flatMap(([file, source]) =>
      file.startsWith(uiRoot) ? [] : findNative(source, file)
    );
    expect(violations).toEqual([]);
  });
});
