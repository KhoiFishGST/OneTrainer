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

/** Bare specifiers the canonical components legitimately depend on. */
const ALLOWED_PACKAGES = [
  'svelte',
  'bits-ui',
  '@lucide/svelte',
  'tailwind-variants',
  'vaul-svelte',
  'svelte-sonner',
  'mode-watcher',
];

function isAllowedPackage(importPath: string): boolean {
  return ALLOWED_PACKAGES.some(
    (pkg) => importPath === pkg || importPath.startsWith(pkg + '/')
  );
}

export function findForbiddenImports(source: string, filename: string): string[] {
  const violations: string[] = [];
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  const normFile = filename.startsWith('/') ? filename : '/' + filename;
  const fileDir = normFile.substring(0, normFile.lastIndexOf('/'));

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];

    if (importPath.startsWith('.')) {
      const resolved = resolvePath(fileDir, importPath);
      if (!resolved.startsWith('/src/lib/components/ui/')) {
        violations.push(
          `${filename}: relative import ${importPath} resolves to ${resolved}, outside the UI directory`
        );
      }
      continue;
    }

    if (importPath.startsWith('$lib/')) {
      const allowed =
        importPath === '$lib/utils' ||
        importPath.startsWith('$lib/utils/') ||
        importPath.startsWith('$lib/utils.') ||
        importPath.startsWith('$lib/components/ui/');
      if (!allowed) {
        violations.push(`${filename}: import ${importPath} violates the UI dependency boundary`);
      }
      continue;
    }

    if (importPath.startsWith('/')) {
      if (
        !importPath.startsWith('/src/lib/components/ui/') &&
        !importPath.startsWith('/src/lib/utils')
      ) {
        violations.push(`${filename}: absolute import ${importPath} is outside the UI directory`);
      }
      continue;
    }

    if (!isAllowedPackage(importPath)) {
      violations.push(`${filename}: package import ${importPath} is not on the UI allowlist`);
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
    const fixture6 = "import { page } from '$app/stores';";
    const fixture7 = "import { goto } from '$app/navigation';";
    const fixture8 = "import { createQuery } from '@tanstack/svelte-query';";

    const targetFile = '/src/lib/components/ui/button/button.svelte';

    expect(findForbiddenImports(fixture1, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture2, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture3, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture4, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture5, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture6, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture7, targetFile)).not.toEqual([]);
    expect(findForbiddenImports(fixture8, targetFile)).not.toEqual([]);
  });


  it('ensures no UI components import domain modules', () => {
    const violations = Object.entries(uiSources).flatMap(([file, source]) =>
      findForbiddenImports(source, file)
    );
    expect(violations).toEqual([]);
  });
});
