import { test, expect } from "@playwright/test";

test.describe("Visual Regression Baselines", () => {
  const screenshotOpts = { animations: "disabled" as const, maxDiffPixelRatio: 0.02, timeout: 15000 };

  async function switchToLightTheme(page: any) {
    const toggle = page.getByRole("button", { name: /switch to light theme/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }

  test.describe("Desktop Viewport", () => {
    test.beforeEach(async ({}, testInfo) => {
      if (!testInfo.project.name.includes("desktop")) test.skip();
    });

    test("shell desktop dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-desktop-dark.png", screenshotOpts);

      await switchToLightTheme(page);
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-desktop-light.png", screenshotOpts);
    });

    test("schema form desktop dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-desktop-dark.png", screenshotOpts);

      await switchToLightTheme(page);
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-desktop-light.png", screenshotOpts);
    });

    test("dataset collection desktop cards", async ({ page }) => {
      await page.route("**/api/datasets", (route) =>
        route.fulfill({
          status: 200,
          json: {
            datasets: [
              {
                name: "Seeded Dataset 1",
                path: "/training/datasets/seeded_1",
                image_count: 42,
                caption_count: 42,
                thumbnail_url: "",
              },
            ],
            base_dir: "training_datasets",
          },
        })
      );
      await page.goto("/datasets");
      await expect(page.locator(".datasets-grid")).toBeVisible();
      await expect(page.getByText("Seeded Dataset 1")).toBeVisible();
      await expect(page.locator("main.main-content")).toHaveScreenshot("dataset-collection-desktop-cards.png", screenshotOpts);
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

  test.describe("Phone Viewport", () => {
    test.beforeEach(async ({}, testInfo) => {
      if (!testInfo.project.name.includes("phone")) test.skip();
    });

    test("shell phone dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-phone-dark.png", screenshotOpts);

      await switchToLightTheme(page);
      await expect(page.locator(".app-shell")).toHaveScreenshot("shell-phone-light.png", screenshotOpts);
    });

    test("schema form phone dark and light", async ({ page }) => {
      await page.goto("/general");
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-phone-dark.png", screenshotOpts);

      await switchToLightTheme(page);
      await expect(page.locator("main.main-content")).toHaveScreenshot("schema-form-phone-light.png", screenshotOpts);
    });

    test("dataset collection phone cards", async ({ page }) => {
      await page.route("**/api/datasets", (route) =>
        route.fulfill({
          status: 200,
          json: {
            datasets: [
              {
                name: "Seeded Phone Dataset 1",
                path: "/training/datasets/seeded_phone_1",
                image_count: 15,
                caption_count: 15,
                thumbnail_url: "",
              },
            ],
            base_dir: "training_datasets",
          },
        })
      );
      await page.goto("/datasets");
      await expect(page.locator(".datasets-grid")).toBeVisible();
      await expect(page.getByText("Seeded Phone Dataset 1")).toBeVisible();
      await expect(page.locator("main.main-content")).toHaveScreenshot("dataset-collection-phone-cards.png", screenshotOpts);
    });

    test("ordinary editor Drawer phone", async ({ page }) => {
      await page.goto("/general");
      await page.getByTestId("header-mobile-bar").getByRole("button", { name: "Save" }).click();
      const drawer = page.getByRole("dialog", { name: "Save Configuration" });
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveScreenshot("ordinary-editor-drawer-phone.png", screenshotOpts);
    });

    test("directory picker Drawer phone", async ({ page }) => {
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();
      const drawer = page.getByRole("dialog", { name: "Select Directory" });
      await expect(drawer).toBeVisible();
      await page.evaluate(async () => {
        await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
      });
      await expect(drawer).toHaveScreenshot("directory-picker-drawer-phone.png", screenshotOpts);
    });
  });

  test.describe("States: Loading, Empty, and Error", () => {
    test.beforeEach(async ({}, testInfo) => {
      if (!testInfo.project.name.includes("desktop")) test.skip();
    });

    test("empty state rendering", async ({ page }) => {
      await page.route("**/api/datasets", (route) =>
        route.fulfill({
          status: 200,
          json: {
            datasets: [],
            base_dir: "training_datasets",
          },
        })
      );
      await page.goto("/datasets");
      await expect(page.locator("main.main-content")).toHaveScreenshot("empty-state.png", screenshotOpts);
    });

    test("loading state rendering", async ({ page }) => {
      await page.route("**/api/concepts**", () => {});
      await page.goto("/concepts");
      await expect(page.getByRole("status")).toBeVisible();
      await expect(page.locator("main.main-content")).toHaveScreenshot("loading-state.png", screenshotOpts);
    });

    test("persistent error state rendering", async ({ page }) => {
      await page.route("**/api/health**", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Server Error" }),
        })
      );
      await page.goto("/general");
      const banner = page.locator(".error-banner");
      await expect(banner).toBeVisible({ timeout: 15000 });
      await expect(banner).toHaveScreenshot("persistent-error-state.png", screenshotOpts);
    });
  });
});
