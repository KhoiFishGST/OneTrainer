import { expect, test } from "@playwright/test";

test.describe("typography", () => {
  test("never asks a third party for a font", async ({ page }) => {
    // The whole point of fetching at build time is that the user's browser
    // talks only to this server. A stray CDN link would pass every local
    // check and silently phone home for every user.
    const external: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
        external.push(url);
      }
    });

    await page.goto("/live");
    await page.waitForLoadState("networkidle");

    expect(external).toEqual([]);
  });

  test("serves its own font stylesheet", async ({ page, request }) => {
    await page.goto("/live");
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator('link[rel="stylesheet"][href="/fonts/fonts.css"]')
    ).toHaveCount(1);

    const response = await request.get("/fonts/fonts.css");
    expect(
      response.status(),
      "fonts.css is missing — run `node scripts/fetch-fonts.mjs` in web/ with a network connection"
    ).toBe(200);

    const body = await response.text();
    expect(body).toContain("@font-face");
    expect(body).not.toContain("gstatic");
  });
});
