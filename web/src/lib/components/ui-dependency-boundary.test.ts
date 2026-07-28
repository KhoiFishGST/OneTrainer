import { describe, expect, it } from 'vitest';

const uiSources = import.meta.glob('/src/lib/components/ui/**/*.{svelte,ts}', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const forbiddenDomains = [
  '/api/',
  '/routes/',
  '/stores/',
  '/shell/',
  '/form/',
  '/directory/',
  '/concepts/',
  '/datasets/',
  '/sampling/',
  '/training/',
  '/embeddings/',
  '/console/',
  '/charts/'
];

export function findForbiddenImports(source: string, filename: string): string[] {
  const violations: string[] = [];
  // Match static import/export statements: import ... from '...'; import '...'; export ... from '...';
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];
    for (const domain of forbiddenDomains) {
      if (importPath.includes(domain)) {
        violations.push(`${filename}: import ${importPath} contains forbidden domain import ${domain}`);
      }
    }
  }

  return violations;
}

describe('UI component dependency boundary', () => {
  it('rejects domain imports in fixture code', () => {
    const fixtureSource = "import { client } from '$lib/api/client';";
    expect(findForbiddenImports(fixtureSource, 'fixture.ts')).toEqual([
      'fixture.ts: import $lib/api/client contains forbidden domain import /api/'
    ]);
  });

  it('ensures no UI components import domain modules', () => {
    const violations = Object.entries(uiSources).flatMap(([file, source]) =>
      findForbiddenImports(source, file)
    );
    expect(violations).toEqual([]);
  });
});
