import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Audit (axe-core)", () => {
  async function checkAccessibility(page: any, contextName: string) {
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(violations, `Accessibility violations found in ${contextName}: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  }

  test("login page has no critical/serious violations", async ({ page }) => {
    await page.goto("/login");
    await checkAccessibility(page, "login page");
  });

  test("general schema form page has no critical/serious violations", async ({ page }) => {
    await page.goto("/general");
    await checkAccessibility(page, "general schema form");
  });

  test("datasets page has no critical/serious violations", async ({ page }) => {
    await page.goto("/datasets");
    await checkAccessibility(page, "datasets page");
  });

  test("concepts page has no critical/serious violations", async ({ page }) => {
    await page.goto("/concepts");
    await checkAccessibility(page, "concepts page");
  });

  test("live dashboard has no critical/serious violations", async ({ page }) => {
    await page.goto("/live");
    await checkAccessibility(page, "live dashboard");
  });

  test("open Dialog has no critical/serious violations", async ({ page }) => {
    await page.goto("/general");
    await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog", { name: "Save Configuration" })).toBeVisible();
    await checkAccessibility(page, "open Save Configuration Dialog");
  });

  test("open Drawer has no critical/serious violations", async ({ page }) => {
    await page.goto("/general");
    const viewport = page.viewportSize();
    if (viewport && viewport.width <= 767) {
      const mobileMenu = page.getByRole("button", { name: "Open navigation" });
      await expect(mobileMenu).toBeVisible();
      await mobileMenu.click();
      const nav = page.getByRole("dialog", { name: "Navigation" });
      await nav.getByRole("button", { name: "Console" }).click();
    } else {
      const consoleToggle = page.getByTitle("Toggle Console Drawer");
      await consoleToggle.click();
    }
    await expect(page.locator('section[aria-label="Console Output"]')).toBeVisible();
    await checkAccessibility(page, "open Console Drawer");
  });

  test("open Sheet on phone viewport has no critical/serious violations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/general");
    const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
    await browseBtn.click();
    await expect(page.getByRole("dialog", { name: "Select Directory" })).toBeVisible();
    await checkAccessibility(page, "open Directory Picker Sheet");
  });

  test("open Alert Dialog has no critical/serious violations", async ({ page }) => {
    await page.goto("/general");
    await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
    const saveDialog = page.getByRole("dialog", { name: "Save Configuration" });
    await expect(saveDialog).toBeVisible();
    await page.getByLabel("Preset Name").fill("existing_preset");
    await saveDialog.getByRole("button", { name: "Save" }).click();

    const overwriteDialog = page.getByRole("dialog", { name: "File Already Exists" });
    if (await overwriteDialog.isVisible()) {
      await checkAccessibility(page, "open Overwrite Alert Dialog");
    } else {
      await checkAccessibility(page, "Save dialog fallback");
    }
  });
});
