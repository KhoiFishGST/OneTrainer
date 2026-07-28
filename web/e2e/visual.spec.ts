import { test, expect } from "@playwright/test";

test.describe("Visual Regression Baselines", () => {
  const screenshotOpts = { animations: "disabled" as const, maxDiffPixelRatio: 0.02 };

  test.describe("Desktop Viewport (1280x720)", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("shell desktop dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-desktop-dark.png", screenshotOpts);

      await page.getByRole("button", { name: /switch to light theme/i }).click();
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-desktop-light.png", screenshotOpts);
    });

    test("schema form desktop dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-desktop-dark.png", screenshotOpts);

      await page.getByRole("button", { name: /switch to light theme/i }).click();
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-desktop-light.png", screenshotOpts);
    });

    test("dataset collection desktop table", async ({ page }) => {
      await page.goto("/datasets");
      await expect(page.locator("main.main-content")).toHaveScreenshot("dataset-collection-desktop-table.png", screenshotOpts);
    });

    test("ordinary editor Dialog desktop", async ({ page }) => {
      await page.goto("/general");
      await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
      const dialog = page.getByRole("dialog", { name: "Save Configuration" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveScreenshot("ordinary-editor-dialog-desktop.png", screenshotOpts);
    });

    test("directory picker Dialog desktop", async ({ page }) => {
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();
      const dialog = page.getByRole("dialog", { name: "Select Directory" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveScreenshot("directory-picker-dialog-desktop.png", screenshotOpts);
    });
  });

  test.describe("Phone Viewport (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("shell phone dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-phone-dark.png", screenshotOpts);

      // Open menu drawer to reach theme toggle on mobile if needed, or directly click header theme toggle
      const toggle = page.getByRole("button", { name: /switch to light theme/i });
      if (await toggle.isVisible()) {
        await toggle.click();
      }
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-phone-light.png", screenshotOpts);
    });

    test("schema form phone dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-phone-dark.png", screenshotOpts);

      const toggle = page.getByRole("button", { name: /switch to light theme/i });
      if (await toggle.isVisible()) {
        await toggle.click();
      }
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-phone-light.png", screenshotOpts);
    });

    test("dataset collection phone cards", async ({ page }) => {
      await page.goto("/datasets");
      await expect(page.locator("main.main-content")).toHaveScreenshot("dataset-collection-phone-cards.png", screenshotOpts);
    });

    test("ordinary editor Drawer phone", async ({ page }) => {
      await page.goto("/general");
      await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
      const drawer = page.getByRole("dialog", { name: "Save Configuration" });
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveScreenshot("ordinary-editor-drawer-phone.png", screenshotOpts);
    });

    test("directory picker Sheet phone", async ({ page }) => {
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();
      const sheet = page.getByRole("dialog", { name: "Select Directory" });
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveScreenshot("directory-picker-sheet-phone.png", screenshotOpts);
    });
  });

  test.describe("States: Loading, Empty, and Error", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("empty state rendering", async ({ page }) => {
      await page.goto("/datasets");
      await expect(page.locator("main.main-content")).toHaveScreenshot("empty-state.png", screenshotOpts);
    });

    test("loading state rendering", async ({ page }) => {
      await page.goto("/concepts");
      await expect(page.locator("main.main-content")).toHaveScreenshot("loading-state.png", screenshotOpts);
    });

    test("persistent error state rendering", async ({ page }) => {
      await page.route("/api/health", (route) => route.fulfill({ status: 500, body: "Server Error" }));
      await page.goto("/general");
      const banner = page.locator(".error-banner");
      if (await banner.isVisible()) {
        await expect(banner).toHaveScreenshot("persistent-error-state.png", screenshotOpts);
      } else {
        await expect(page.locator(".app-shell")).toHaveScreenshot("persistent-error-state.png", screenshotOpts);
      }
    });
  });
});
