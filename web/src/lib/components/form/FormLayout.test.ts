import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('/src/lib/components/form/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const formPanel = sources['/src/lib/components/form/FormPanel.svelte'];
const schemaForm = sources['/src/lib/components/form/SchemaForm.svelte'];
const field = sources['/src/lib/components/form/Field.svelte'];

/**
 * The label/control tracks are declared on `.group-fields` in SchemaForm and
 * adopted by each field via `subgrid` in Field. Both files must switch to the
 * side-by-side layout at the same container width or labels and controls fall
 * out of step, so the breakpoint is asserted in both places.
 */
const PAIR_BREAKPOINT = '@container (min-width: 560px)';
const TWO_COLUMN_BREAKPOINT = '@container (min-width: 1200px)';

describe('form layout', () => {
  it('FormPanel no longer pins its own width', () => {
    expect(formPanel).not.toMatch(/max-w-\[\d+px\]/);
  });

  it('FormPanel establishes a query container for its fields', () => {
    expect(formPanel).toContain('@container');
  });

  it('SchemaForm fills its container instead of hardcoding 740px', () => {
    expect(schemaForm).not.toContain('740px');
    expect(schemaForm).toMatch(/\.schema-form\s*\{[^}]*width:\s*100%/);
  });

  it('SchemaForm owns the shared label and control tracks', () => {
    expect(schemaForm).toMatch(/\.group-fields\s*\{[^}]*display:\s*grid/);
    expect(schemaForm).toContain('fit-content(var(--width-field-label))');
    expect(schemaForm).toContain('fit-content(var(--width-field-control))');
  });

  it('control columns size to their content rather than a fixed width', () => {
    // A short select must not leave dead space before the next pair, but a
    // path input still claims the full control width and sizes its column.
    expect(schemaForm).not.toContain('minmax(0, var(--width-field-control))');
    expect(schemaForm).toContain('wide={wantsRoom}');
    expect(field).toMatch(/\.field-control-side\.is-wide\s*\{[^}]*min-width:\s*var\(--width-field-control\)/);
  });

  it('SchemaForm content-sizes its tracks so slack collects on the right', () => {
    expect(schemaForm).toMatch(/\.group-fields\s*\{[^}]*justify-content:\s*start/);
    // Scoped to the field grid: `.schema-form.is-training-tab` legitimately
    // uses 1fr tracks to lay whole panels out in columns.
    const fieldGrid = schemaForm.slice(schemaForm.indexOf('.group-fields {'));
    expect(fieldGrid).not.toContain('minmax(0, 1fr)');
  });

  it('SchemaForm pairs label with control, then doubles on a wide container', () => {
    expect(schemaForm).toContain(PAIR_BREAKPOINT);
    expect(schemaForm).toContain(TWO_COLUMN_BREAKPOINT);
    expect(schemaForm.indexOf(PAIR_BREAKPOINT)).toBeLessThan(
      schemaForm.indexOf(TWO_COLUMN_BREAKPOINT)
    );
  });

  it('SchemaForm uses a container query, never a viewport query, for field columns', () => {
    const fieldColumnRules = schemaForm.slice(schemaForm.indexOf('.group-fields'));
    expect(fieldColumnRules).not.toMatch(/@media[^{]*\)\s*\{\s*\.group-fields/);
  });

  it('Field adopts the group tracks rather than defining its own', () => {
    expect(field).toContain('grid-template-columns: subgrid');
    expect(field).toMatch(/\.field-row\s*\{\s*display:\s*contents/);
    expect(field).not.toMatch(/flex:\s*0\s+0\s+\d+px/);
    expect(field).toMatch(/\.field-control-side\s*\{[^}]*min-width:\s*0/);
  });

  it('Field switches to the paired layout at the same width as the group', () => {
    expect(field).toContain(PAIR_BREAKPOINT);
  });

  it('Field no longer sets a viewport breakpoint that fights the container query', () => {
    expect(field).not.toMatch(/@media\s*\(max-width:\s*767px\)/);
  });

  it('full-width fields span every grid column', () => {
    expect(field).toMatch(/\.form-field\.is-full-width\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  });

  it('field errors sit below on their own full-width row', () => {
    expect(field).toMatch(/\.field-error\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  });
});
