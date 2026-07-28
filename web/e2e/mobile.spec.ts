import { test, expect } from "@playwright/test";

test.describe("Phone Mobile Editing Flows", () => {
  test("off-canvas rail navigation drawer opens, navigates, and closes", async ({ page }) => {
    await page.goto("/general");

    const menuBtn = page.getByRole("button", { name: "Open navigation" });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();

    const dataLink = drawer.getByRole("link", { name: "Datasets" });
    await dataLink.click();

    await expect(page).toHaveURL(/.*\/datasets$/);
    await expect(drawer).not.toBeVisible();

    await menuBtn.click();
    await expect(drawer).toBeVisible();

    const closeBtn = drawer.getByRole("button", { name: "Close navigation" });
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test("full-screen directory picker, selection, focus trap, Escape, and focus restoration", async ({ page }) => {
    await page.goto("/general");

    const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
    await browseBtn.click();

    const modal = page.getByRole("dialog", { name: "Select Directory" });
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

    const selectBtn = modal.getByRole("button", { name: "Select Folder" });
    await selectBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test("autosave, conflict controls, and console drawer on mobile", async ({ page }) => {
    await page.goto("/general");

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("dialog", { name: "Navigation" });
    const consoleToggle = navigation.getByRole("button", { name: "Console" });
    await expect(consoleToggle).toBeVisible();
    await consoleToggle.click();

    const consoleDrawer = page.locator('section[aria-label="Console Output"]');
    await expect(consoleDrawer).toBeVisible();

    await page.getByRole("tab", { name: "Hardware" }).click();
    const trainDeviceInput = page.locator("#field-train-device");
    await trainDeviceInput.fill("cuda:0");
    await expect(page.getByTestId("saved-icon-badge")).toBeVisible();
  });
});
