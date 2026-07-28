import { test, expect } from "@playwright/test";

test.describe("Interactive state paint", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("active and inactive nav items paint differently", async ({ page }) => {
    await page.goto("/general");
    const active = await page
      .locator('a[href="/general"]')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    const inactive = await page
      .locator('a[href="/datasets"]')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(active).not.toBe(inactive);
  });

  test("nav item changes colour on hover in dark theme", async ({ page }) => {
    await page.goto("/general");
    const el = page.locator('a[href="/datasets"]');
    const rest = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    await el.hover();
    await page.waitForTimeout(250);
    const hover = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(hover).not.toBe(rest);
  });

  test("nav item changes colour on hover in light theme", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: /switch to light theme/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const el = page.locator('a[href="/datasets"]');
    const rest = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    await el.hover();
    await page.waitForTimeout(250);
    const hover = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(hover).not.toBe(rest);
  });

  test("switch paints differently when toggled", async ({ page }) => {
    await page.goto("/general");
    const sw = page.locator('[data-slot="switch"]').first();
    await expect(sw).toBeVisible();
    const before = await sw.evaluate((e) => getComputedStyle(e).backgroundColor);
    await sw.click();
    await page.waitForTimeout(300);
    const after = await sw.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(after).not.toBe(before);
  });
});
