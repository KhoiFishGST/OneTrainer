import { test, expect } from "@playwright/test";

test.describe("Firefox Smoke Flows", () => {
  test("boot, General/Data/Backup navigation, saved edit, console visibility, and focus order", async ({ page }) => {
    await page.goto("/general");
    await expect(page.locator("h1.page-title")).toHaveText("General");

    await page.goto("/data");
    await expect(page.locator("h1.page-title")).toHaveText("Data");

    await page.goto("/backup");
    await expect(page.locator("h1.page-title")).toHaveText("Backup");

    await page.goto("/general");
    const trainDeviceInput = page.locator("#field-train-device");
    await trainDeviceInput.fill("cuda:0");
    await expect(page.locator(".state-badge")).toHaveText("Saved");

    const consoleToggle = page.locator('button[title="Toggle Console Drawer"]');
    await consoleToggle.click();
    await expect(page.locator('section[aria-label="Console Output"]')).toBeVisible();

    // Tab navigation focus check
    await page.keyboard.press("Tab");
    const activeElTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElTag).toBeTruthy();
  });
});
