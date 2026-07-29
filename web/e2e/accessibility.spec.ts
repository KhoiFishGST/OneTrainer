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

  async function switchToLightTheme(page: any) {
    const toggle = page.getByRole("button", { name: /switch to light theme/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
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
      await switchToLightTheme(page);
      await page.waitForTimeout(300);
      await openModalFn();
      await checkAccessibility(page, `${contextName} (light)`);
    } else {
      await checkAccessibility(page, `${contextName} (dark)`);

      await switchToLightTheme(page);
      await page.waitForTimeout(300);
      await checkAccessibility(page, `${contextName} (light)`);
    }
  }

  test("login page has no critical/serious violations", async ({ page }) => {
    await page.goto("/login");
    await checkAccessibility(page, "login page (dark)");
    await page.evaluate(() => localStorage.setItem("webui.theme", "light"));
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await checkAccessibility(page, "login page (light)");
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
      const isMobile = page.viewportSize() && page.viewportSize()!.width <= 767;
      const bar = isMobile ? page.getByTestId("header-mobile-bar") : page.getByTestId("header-desktop-bar");
      await bar.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog", { name: "Save Configuration" })).toBeVisible();
    };
    await checkAccessibilityInBothThemes(page, "open Save Configuration Dialog", openDialog);
  });

  test("open Drawer has no critical/serious violations", async ({ page }) => {
    const openDrawer = async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/general");
      await page.getByTestId("header-mobile-bar").getByRole("button", { name: "Save" }).click();
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
      const isMobile = page.viewportSize() && page.viewportSize()!.width <= 767;
      const bar = isMobile ? page.getByTestId("header-mobile-bar") : page.getByTestId("header-desktop-bar");
      await bar.getByRole("button", { name: "Save" }).click();
      const saveDialog = page.getByRole("dialog", { name: "Save Configuration" });
      await expect(saveDialog).toBeVisible();
      await page.getByLabel("Preset Name").fill("existing_preset");
      await saveDialog.getByRole("button", { name: "Save" }).click();

      const overwriteDialog = page.getByRole("alertdialog");
      await expect(overwriteDialog).toBeVisible();
      await expect(overwriteDialog.getByText("File Already Exists")).toBeVisible();
    };
    await checkAccessibilityInBothThemes(page, "open Overwrite Alert Dialog", openAlertDialog);
  });

  test("error banner has no critical/serious violations", async ({ page }) => {
    const showBanner = async () => {
      await page.route("**/api/health**", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Server Error" }),
        })
      );
      await page.goto("/general");
      await expect(page.getByText(/Error:/)).toBeVisible({ timeout: 15000 });
    };
    await checkAccessibilityInBothThemes(page, "persistent error banner", showBanner);
  });
});
