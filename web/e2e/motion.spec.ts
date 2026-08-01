import { test, expect } from "@playwright/test";

test.describe("Overlay motion", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("a dialog animates in at the Crisp enter duration", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const duration = await dlg.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0.09s");
  });

  test("the dialog scrim animates too", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    const scrim = page.locator("[data-dialog-overlay]").first();
    const duration = await scrim.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0.09s");
  });

  test("data-motion=off collapses the duration instead of removing the animation", async ({ page }) => {
    await page.goto("/concepts");
    await page.evaluate(() => document.documentElement.setAttribute("data-motion", "off"));
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const style = await dlg.evaluate((el) => {
      const s = getComputedStyle(el);
      return { duration: s.animationDuration, name: s.animationName };
    });
    // Chromium serializes 0.01ms as "1e-05s" rather than "0.00001s".
    expect(style.duration).toBe("1e-05s");
    expect(style.name).not.toBe("none");
  });

  test("a closed dialog is removed from the DOM after its exit animation", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
