import { expect, test } from "@playwright/test";

/**
 * These budgets exist because the shadcn-svelte migration silently grew the
 * first-paint bundle from 259 KB to 720 KB, which doubled cold-load LCP.
 * If a change trips these, move the new dependency behind a dynamic import
 * rather than raising the numbers.
 */
const LOGIN_FILE_BUDGET = 26; // measured 23 files
const LIVE_BYTE_BUDGET = 860 * 1024; // measured 786,180 bytes (~768 KB)

test.describe("bundle budgets", () => {
  test("the login page does not download the application shell", async ({ page }) => {
    const appAssets = new Set<string>();
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/_app/")) appAssets.add(path);
    });

    await page.goto("/login");
    await page.waitForSelector("input[type=password]");

    console.log(`login /_app/ files: ${appAssets.size}`);
    expect(appAssets.size).toBeLessThanOrEqual(LOGIN_FILE_BUDGET);
  });

  test("hashed assets are cached immutably", async ({ page }) => {
    const cacheHeaders: (string | undefined)[] = [];
    page.on("response", async (response) => {
      const path = new URL(response.url()).pathname;
      if (!path.startsWith("/_app/immutable/") || !path.endsWith(".js")) return;
      cacheHeaders.push((await response.allHeaders())["cache-control"]);
    });

    await page.goto("/live");
    await page.waitForSelector(".main-content");

    expect(cacheHeaders.length).toBeGreaterThan(0);
    expect(cacheHeaders.every((value) => value === "public, max-age=31536000, immutable")).toBe(true);
  });

  test("javascript is served compressed", async ({ page }) => {
    await page.goto("/live");
    await page.waitForSelector(".main-content");

    // transferSize < decodedBodySize is the observable proof of compression:
    // Chromium does not always surface content-encoding to the DevTools protocol,
    // but the size pair is always populated for a fresh (uncached) fetch.
    const scripts = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry as PerformanceResourceTiming)
        .filter((entry) => new URL(entry.name).pathname.startsWith("/_app/immutable/"))
        .filter((entry) => entry.decodedBodySize > 4096 && entry.transferSize > 0)
        .map((entry) => ({ transfer: entry.transferSize, decoded: entry.decodedBodySize }))
    );

    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.every((entry) => entry.transfer < entry.decoded * 0.6)).toBe(true);
  });

  test("the live route stays within its transfer budget", async ({ page }) => {
    await page.goto("/live");
    await page.waitForSelector(".main-content");

    const decoded = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry as PerformanceResourceTiming)
        .filter((entry) => new URL(entry.name).pathname.startsWith("/_app/"))
        .reduce((total, entry) => total + entry.decodedBodySize, 0)
    );

    console.log(`live /_app/ decoded bytes: ${decoded}`);
    expect(decoded).toBeLessThanOrEqual(LIVE_BYTE_BUDGET);
  });
});
