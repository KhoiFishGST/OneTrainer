import { test, expect } from "@playwright/test";
import { expectNoSaveProblem, expectSaved, pickDifferentDevice } from "./helpers/config-state";

test.describe("Firefox Smoke Flows", () => {
  test("boot, General/Datasets/Backup navigation, saved edit, console visibility, and focus order", async ({ page }) => {
    await page.goto("/general");
    await expect(page.getByRole("heading", { level: 1, name: "General" })).toBeVisible();

    await page.goto("/datasets");
    await expect(page.getByRole("heading", { level: 1, name: "Datasets" })).toBeVisible();

    await page.goto("/backup");
    await expect(page.getByRole("heading", { level: 1, name: "Backup" })).toBeVisible();

    await page.goto("/general");
    await page.getByRole("tab", { name: "Hardware" }).click();
    const trainDeviceInput = page.locator("#field-train-device");
    const device = await pickDifferentDevice(page);
    await trainDeviceInput.fill(device);
    await expectSaved(page, "train_device", device);
    await expectNoSaveProblem(page);

    const consoleToggle = page.getByTitle("Toggle Console Drawer");
    await consoleToggle.click();
    await expect(page.locator('section[aria-label="Console Output"]')).toBeVisible();

    // Tab navigation focus check
    await page.keyboard.press("Tab");
    const isFocused = await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null);
    expect(isFocused).toBe(true);
  });
});
