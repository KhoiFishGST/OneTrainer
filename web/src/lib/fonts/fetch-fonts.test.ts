import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_CSS_URL,
  isCacheComplete,
  localName,
  parseFontUrls,
  rewriteCss,
  runCli,
} from '../../../scripts/fetch-fonts.mjs';

const SAMPLE_CSS = `
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v13/aaaa.woff2) format('woff2');
}
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/outfit/v11/bbbb.woff2) format('woff2');
}
`;

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fonts-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('the pinned stylesheet URL', () => {
  it('requests every face and weight the design calls for', () => {
    expect(DEFAULT_CSS_URL).toContain('Bricolage+Grotesque');
    expect(DEFAULT_CSS_URL).toContain('Inter:wght@400;500;600');
    expect(DEFAULT_CSS_URL).toContain('JetBrains+Mono');
    expect(DEFAULT_CSS_URL).toContain('Outfit:wght@500;600');
    // Without this the browser hides text until the font arrives.
    expect(DEFAULT_CSS_URL).toContain('display=swap');
  });
});

describe('parseFontUrls', () => {
  it('finds every woff2 source', () => {
    expect(parseFontUrls(SAMPLE_CSS)).toEqual([
      'https://fonts.gstatic.com/s/inter/v13/aaaa.woff2',
      'https://fonts.gstatic.com/s/outfit/v11/bbbb.woff2',
    ]);
  });

  it('deduplicates a URL used by several rules', () => {
    expect(parseFontUrls(SAMPLE_CSS + SAMPLE_CSS)).toHaveLength(2);
  });

  it('returns nothing when the response is not a font stylesheet', () => {
    expect(parseFontUrls('<html>404</html>')).toEqual([]);
  });
});

describe('rewriteCss', () => {
  it('points every source at our own origin', () => {
    const rewritten = rewriteCss(SAMPLE_CSS, parseFontUrls(SAMPLE_CSS));

    expect(rewritten).not.toContain('fonts.gstatic.com');
    expect(rewritten).toContain('/fonts/');
    // The rest of the stylesheet survives untouched.
    expect(rewritten).toContain("font-family: 'Inter'");
    expect(rewritten).toContain('font-display: swap');
  });
});

describe('localName', () => {
  it('keeps the original basename and prefixes a digest of the URL', () => {
    const name = localName('https://fonts.gstatic.com/s/inter/v13/aaaa.woff2');

    expect(name).toMatch(/^[0-9a-f]{8}-aaaa\.woff2$/);
  });

  it('gives two different URLs different names even when the basename matches', () => {
    expect(localName('https://fonts.gstatic.com/s/a/v1/x.woff2')).not.toEqual(
      localName('https://fonts.gstatic.com/s/b/v1/x.woff2')
    );
  });
});

describe('isCacheComplete', () => {
  it('is false when nothing has been downloaded', async () => {
    expect(await isCacheComplete(dir)).toBe(false);
  });

  it('is false when the stylesheet names a file that is not on disk', async () => {
    await fs.writeFile(
      path.join(dir, 'fonts.css'),
      "src: url(/fonts/abcd1234-aaaa.woff2) format('woff2');",
      'utf-8'
    );

    expect(await isCacheComplete(dir)).toBe(false);
  });

  it('is true once every named file exists', async () => {
    await fs.writeFile(
      path.join(dir, 'fonts.css'),
      "src: url(/fonts/abcd1234-aaaa.woff2) format('woff2');",
      'utf-8'
    );
    await fs.writeFile(path.join(dir, 'abcd1234-aaaa.woff2'), 'x', 'utf-8');

    expect(await isCacheComplete(dir)).toBe(true);
  });
});

describe('runCli', () => {
  it('never fails the build when the network is unreachable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const code = await runCli({
      dir,
      cssUrl: 'http://127.0.0.1:1/never-listens.css',
    });

    expect(code).toBe(0);
    expect(warn).toHaveBeenCalled();
    // Nothing half-written was left behind.
    expect(await isCacheComplete(dir)).toBe(false);
  });

  it('honours the URL override from the environment', async () => {
    // The override exists so this failure path is reachable in a test without
    // pointing the real build at a fake host.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('ONETRAINER_FONTS_CSS_URL', 'http://127.0.0.1:1/never-listens.css');

    const code = await runCli({ dir });

    expect(code).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:1'));

    vi.unstubAllEnvs();
  });

  it('makes no request when the cache is already complete', async () => {
    await fs.writeFile(
      path.join(dir, 'fonts.css'),
      "src: url(/fonts/abcd1234-aaaa.woff2) format('woff2');",
      'utf-8'
    );
    await fs.writeFile(path.join(dir, 'abcd1234-aaaa.woff2'), 'x', 'utf-8');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const code = await runCli({ dir, cssUrl: 'http://127.0.0.1:1/never-listens.css' });

    expect(code).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
