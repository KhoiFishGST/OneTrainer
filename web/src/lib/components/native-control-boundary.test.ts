import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const allowed = new Set([
  '/src/lib/components/ui/Button.svelte',
  '/src/lib/components/form/TextInput.svelte',
  '/src/lib/components/form/NumberInput.svelte',
  '/src/lib/components/form/Checkbox.svelte',
  '/src/lib/components/form/Toggle.svelte',
  '/src/lib/components/form/TextArea.svelte',
  '/src/lib/components/form/FileInput.svelte',
  '/src/lib/components/form/RangeInput.svelte',
  '/src/lib/components/form/Select.svelte',
]);
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
    if (
      record.type === 'RegularElement' &&
      typeof record.name === 'string' &&
      typeof record.start === 'number' &&
      native.has(record.name)
    ) {
      const line = source.slice(0, record.start).split('\n').length;
      found.push(`${filename}:${line} <${record.name}>`);
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
  it('allows native controls only in explicit leaves', () => {
    const violations = Object.entries(sources).flatMap(([file, source]) => allowed.has(file) ? [] : findNative(source, file));
    expect(violations).toEqual([]);
  });
});
