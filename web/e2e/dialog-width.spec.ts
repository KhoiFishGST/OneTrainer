import { test, expect } from "@playwright/test";

test.describe("Dialog width", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("a dialog honours a consumer max-w override", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(box!.width).toBeGreaterThan(600);
  });

  test("a dialog still fits inside a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
  });
});
