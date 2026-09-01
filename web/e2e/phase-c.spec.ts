import { test, expect } from "@playwright/test";

test.describe("Phase C Live Training Dashboard", () => {
  test("navigates to /live and displays progress, metrics charts, and controls", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/.*\/live$/);
    await expect(page.getByRole("heading", { name: /live/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Training" })).toBeVisible();

    // Verify key live components are present
    await expect(page.locator('[data-testid="progress-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="gpu-monitor"]')).toBeVisible();
    await expect(page.locator('[data-testid="sample-gallery"]')).toBeVisible();
  });
});
