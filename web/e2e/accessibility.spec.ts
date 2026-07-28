import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Audit (axe-core)", () => {
  async function checkAccessibility(page: any, contextName: string) {
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(violations, `Accessibility violations found in ${contextName}: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  }

  async function checkAccessibilityInBothThemes(
    page: any,
    contextName: string,
    openModalFn?: () => Promise<void>
  ) {
    if (openModalFn) {
      // Dark Theme Pass
      await openModalFn();
      await checkAccessibility(page, `${contextName} (dark)`);

      // Switch to Light Theme before opening modal
      await page.reload();
      const toggle = page.getByRole("button", { name: /switch to light theme/i });
      if (await toggle.isVisible()) {
        await toggle.click();
        await expect(page.locator("html")).not.toHaveClass(/dark/);
        await page.waitForTimeout(300);
      }
      await openModalFn();
      await checkAccessibility(page, `${contextName} (light)`);
    } else {
      await checkAccessibility(page, `${contextName} (dark)`);

      const toggle = page.getByRole("button", { name: /switch to light theme/i });
      if (await toggle.isVisible()) {
        await toggle.click();
        await expect(page.locator("html")).not.toHaveClass(/dark/);
        await page.waitForTimeout(300);
        await checkAccessibility(page, `${contextName} (light)`);
      }
    }
  }

  test("login page has no critical/serious violations", async ({ page }) => {
    await page.goto("/login");
    await checkAccessibilityInBothThemes(page, "login page");
  });

  test("general schema form page has no critical/serious violations", async ({ page }) => {
    await page.goto("/general");
    await checkAccessibilityInBothThemes(page, "general schema form");
  });

  test("datasets page has no critical/serious violations", async ({ page }) => {
    await page.goto("/datasets");
    await checkAccessibilityInBothThemes(page, "datasets page");
  });

  test("concepts page has no critical/serious violations", async ({ page }) => {
    await page.goto("/concepts");
    await checkAccessibilityInBothThemes(page, "concepts page");
  });

  test("live dashboard has no critical/serious violations", async ({ page }) => {
    await page.goto("/live");
    await checkAccessibilityInBothThemes(page, "live dashboard");
  });

  test("open Dialog has no critical/serious violations", async ({ page }) => {
    const openDialog = async () => {
      await page.goto("/general");
      await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog", { name: "Save Configuration" })).toBeVisible();
    };
    await checkAccessibilityInBothThemes(page, "open Save Configuration Dialog", openDialog);
  });

  test("open Drawer has no critical/serious violations", async ({ page }) => {
    const openDrawer = async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/general");
      await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog", { name: "Save Configuration" })).toBeVisible();
    };
    await checkAccessibilityInBothThemes(page, "open Save Configuration Drawer at phone width", openDrawer);
  });

  test("open Sheet on phone viewport has no critical/serious violations", async ({ page }) => {
    const openSheet = async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();
      await expect(page.getByRole("dialog", { name: "Select Directory" })).toBeVisible();
    };
    await checkAccessibilityInBothThemes(page, "open Directory Picker Sheet", openSheet);
  });

  test("open Alert Dialog has no critical/serious violations", async ({ page }) => {
    const openAlertDialog = async () => {
      await page.goto("/general");
      await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
      const saveDialog = page.getByRole("dialog", { name: "Save Configuration" });
      await expect(saveDialog).toBeVisible();
      await page.getByLabel("Preset Name").fill("existing_preset");
      await saveDialog.getByRole("button", { name: "Save" }).click();

      if (await saveDialog.isHidden().catch(() => false)) {
        await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
        await expect(saveDialog).toBeVisible();
        await page.getByLabel("Preset Name").fill("existing_preset");
        await saveDialog.getByRole("button", { name: "Save" }).click();
      }

      const overwriteDialog = page.getByRole("alertdialog").or(page.getByRole("dialog", { name: "File Already Exists" }));
      await expect(overwriteDialog).toBeVisible();
    };
    await checkAccessibilityInBothThemes(page, "open Overwrite Alert Dialog", openAlertDialog);
  });
});
