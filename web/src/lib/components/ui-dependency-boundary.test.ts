import { describe, expect, it } from 'vitest';

const uiSources = import.meta.glob('/src/lib/components/ui/**/*.{svelte,ts}', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

function resolvePath(dir: string, relative: string): string {
  const stack = dir.split('/').filter(Boolean);
  const parts = relative.split('/');
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return '/' + stack.join('/');
}

export function findForbiddenImports(source: string, filename: string): string[] {
  const violations: string[] = [];
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  const normFile = filename.startsWith('/') ? filename : '/' + filename;
  const fileDir = normFile.substring(0, normFile.lastIndexOf('/'));

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];

    if (importPath.startsWith('$lib/')) {
      const isAllowedUtils = importPath === '$lib/utils' || importPath.startsWith('$lib/utils/') || importPath.startsWith('$lib/utils.');
      const isAllowedUI = importPath.startsWith('$lib/components/ui/');
      if (!isAllowedUtils && !isAllowedUI) {
        violations.push(`${filename}: import ${importPath} violates UI dependency boundary`);
      }
    } else if (importPath.startsWith('.')) {
      const resolved = resolvePath(fileDir, importPath);
      if (!resolved.startsWith('/src/lib/components/ui/') && !resolved.startsWith('src/lib/components/ui/')) {
        violations.push(`${filename}: relative import ${importPath} resolved to ${resolved} outside UI directory`);
      }
    } else if (importPath.startsWith('/')) {
      if (!importPath.startsWith('/src/lib/components/ui/') && !importPath.startsWith('/src/lib/utils')) {
        violations.push(`${filename}: absolute import ${importPath} outside UI directory`);
      }
    }
  }

  return violations;
}

describe('UI component dependency boundary', () => {
  it('rejects domain and relative application imports in fixture code', () => {
    const fixture1 = "import { getRouteContext } from '$lib/config/context';";
    const fixture2 = "import { trainingStore } from '$lib/events/training-store';";
    const fixture3 = "import { api } from '$lib/api/client';";
    const fixture4 = "import Header from '../../shell/Header.svelte';";
    const fixture5 = "import { useHook } from '$lib/hooks/use-hook';";

    const targetFile = '/src/lib/components/ui/button/button.svelte';

    expect(findForbiddenImports(fixture1, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture2, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture3, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture4, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture5, targetFile)).not.toEqual([]);
  });


  it('ensures no UI components import domain modules', () => {
    const violations = Object.entries(uiSources).flatMap(([file, source]) =>
      findForbiddenImports(source, file)
    );
    expect(violations).toEqual([]);
  });
});
