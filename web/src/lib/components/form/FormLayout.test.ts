import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('/src/lib/components/form/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const formPanel = sources['/src/lib/components/form/FormPanel.svelte'];
const schemaForm = sources['/src/lib/components/form/SchemaForm.svelte'];
const field = sources['/src/lib/components/form/Field.svelte'];

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

  it('SchemaForm lays fields out as a grid that doubles on a wide container', () => {
    expect(schemaForm).toMatch(/\.group-fields\s*\{[^}]*display:\s*grid/);
    expect(schemaForm).toContain('@container (min-width: 900px)');
    expect(schemaForm).toContain('repeat(2, minmax(0, 1fr))');
  });

  it('SchemaForm uses a container query, never a viewport query, for field columns', () => {
    const fieldColumnRules = schemaForm.slice(schemaForm.indexOf('.group-fields'));
    expect(fieldColumnRules).not.toMatch(/@media[^{]*\)\s*\{\s*\.group-fields/);
  });

  it('Field control side is flexible and driven by the shared token', () => {
    expect(field).toContain('var(--width-field-control)');
    expect(field).not.toMatch(/flex:\s*0\s+0\s+\d+px/);
    expect(field).toMatch(/\.field-control-side\s*\{[^}]*min-width:\s*0/);
  });

  it('full-width fields span every grid column', () => {
    expect(field).toMatch(/\.form-field\.is-full-width\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  });
});
