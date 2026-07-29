import { describe, expect, it } from 'vitest';

const configSource = Object.values(
  import.meta.glob('/playwright.config.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0];

/**
 * The e2e server serves the static `build/` directory. If the suite does not
 * rebuild first it silently tests whatever was built last -- a run can go
 * green against code that no longer exists. That is not hypothetical: three
 * commits once shipped unverified because `build/` was two hours stale while
 * the suite reported success.
 */
export function findStaleBuildRisk(source: string): string[] {
  const webServer = source.match(/webServer\s*:\s*\{[\s\S]*?\}/)?.[0];
  if (!webServer) return ['playwright.config.ts: no webServer block found'];

  const command = webServer.match(/command\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
  if (!command) return ['playwright.config.ts: webServer has no command'];

  if (!/\bbuild\b/.test(command)) {
    return [
      `playwright.config.ts: webServer command must build before serving, got "${command}"`,
    ];
  }
  return [];
}

describe('e2e boundaries', () => {
  it('rebuilds the app before serving it to the browser', () => {
    expect(findStaleBuildRisk(configSource)).toEqual([]);
  });
});
