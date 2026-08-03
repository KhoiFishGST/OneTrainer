// @ts-nocheck
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const FONTS_DIR = path.resolve(HERE, '..', 'static', 'fonts');
export const CSS_FILENAME = 'fonts.css';

export const DEFAULT_CSS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Bricolage+Grotesque:opsz,wght@12..96,800' +
  '&family=Inter:wght@400;500;600' +
  '&family=JetBrains+Mono:wght@400' +
  '&family=Outfit:wght@500;600' +
  '&display=swap';

// Google serves woff2 only to user agents it recognises. With Node's default
// it answers with ttf, which is roughly twice the bytes for the same glyphs.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TIMEOUT_MS = 15000;

export function parseFontUrls(css) {
  const found = css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+\.woff2/g) ?? [];
  return [...new Set(found)];
}

export function localName(url) {
  // The gstatic basename is already unique in practice; the digest makes that
  // a guarantee rather than an assumption.
  const base = path.basename(new URL(url).pathname);
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 8);
  return `${digest}-${base}`;
}

export function rewriteCss(css, urls) {
  return urls.reduce(
    (acc, url) => acc.split(url).join(`/fonts/${localName(url)}`),
    css
  );
}

export async function isCacheComplete(dir = FONTS_DIR) {
  try {
    const css = await fs.readFile(path.join(dir, CSS_FILENAME), 'utf-8');
    const names = [
      ...new Set(css.match(/\/fonts\/[^)'"\s]+\.woff2/g) ?? []),
    ].map((reference) => reference.replace('/fonts/', ''));

    if (names.length === 0) return false;
    await Promise.all(names.map((name) => fs.access(path.join(dir, name))));
    return true;
  } catch {
    return false;
  }
}

async function fetchOrThrow(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
    } catch (err) {
      throw new Error(`fetch to ${url} failed: ${err.message}`, { cause: err });
    }
    if (!response.ok) throw new Error(`${url} responded ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function main({ dir = FONTS_DIR, cssUrl } = {}) {
  const url = cssUrl || process.env.ONETRAINER_FONTS_CSS_URL || DEFAULT_CSS_URL;

  if (await isCacheComplete(dir)) {
    console.log('[fonts] already downloaded, skipping');
    return;
  }

  await fs.mkdir(dir, { recursive: true });

  const css = await (await fetchOrThrow(url)).text();
  const urls = parseFontUrls(css);
  if (urls.length === 0) {
    throw new Error('the stylesheet named no woff2 files');
  }

  await Promise.all(
    urls.map(async (fontUrl) => {
      const target = path.join(dir, localName(fontUrl));
      const temporary = `${target}.tmp`;
      const body = Buffer.from(await (await fetchOrThrow(fontUrl)).arrayBuffer());
      // Write then rename: an interrupted download must not leave a truncated
      // file that the next run's cache check would accept as complete.
      await fs.writeFile(temporary, body);
      await fs.rename(temporary, target);
    })
  );

  // Written last, deliberately. isCacheComplete keys off this file, so a crash
  // partway through the loop above leaves no stylesheet and the next build
  // retries instead of serving a half-populated directory.
  await fs.writeFile(path.join(dir, CSS_FILENAME), rewriteCss(css, urls), 'utf-8');
  console.log(`[fonts] downloaded ${urls.length} files`);
}

export async function runCli(options = {}) {
  try {
    await main(options);
  } catch (error) {
    console.warn(
      `[fonts] skipped: ${error.message}. The UI will fall back to system fonts.`
    );
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
