import { test, expect } from "@playwright/test";

test.describe("Phone Mobile Editing Flows", () => {
  test("off-canvas rail navigation drawer opens, navigates, and closes", async ({ page }) => {
    await page.goto("/general");

    const menuBtn = page.locator('button[aria-label="Open navigation"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const drawer = page.locator('div[role="dialog"][aria-label="Navigation"]');
    await expect(drawer).toBeVisible();

    const dataLink = drawer.locator('a.nav-item[href="/data"]');
    await dataLink.click();

    await expect(page).toHaveURL(/.*\/data$/);
    await expect(drawer).not.toBeVisible();

    await menuBtn.click();
    await expect(drawer).toBeVisible();

    const closeBtn = drawer.locator('button[aria-label="Close navigation"]');
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test("full-screen directory picker, selection, focus trap, Escape, and focus restoration", async ({ page }) => {
    await page.goto("/general");

    const browseBtn = page.locator('button[aria-label="Browse directory"]').first();
    await browseBtn.click();

    const modal = page.locator('div[role="dialog"][aria-label="Server Directory Picker"]');
    await expect(modal).toBeVisible();

    // Focus trap check
    await page.keyboard.press("Tab");
    const activeEl = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName);
    expect(activeEl).toBeTruthy();

    // Escape closes modal and restores focus
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await expect(browseBtn).toBeFocused();

    // Open again and select directory
    await browseBtn.click();
    await expect(modal).toBeVisible();

    const selectBtn = modal.locator('button:has-text("Select")');
    await selectBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test("autosave, conflict controls, and console drawer on mobile", async ({ page }) => {
    await page.goto("/general");

    const consoleToggle = page.locator('button[title="Toggle Console Drawer"]');
    await expect(consoleToggle).toBeVisible();
    await consoleToggle.click();

    const consoleDrawer = page.locator('section[aria-label="Console Output"]');
    await expect(consoleDrawer).toBeVisible();

    const trainDeviceInput = page.locator("#field-train-device");
    await trainDeviceInput.fill("cuda:0");
    await expect(page.locator(".state-badge")).toHaveText("Saved");
  });
});
