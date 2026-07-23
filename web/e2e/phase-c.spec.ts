import { test, expect } from '@playwright/test';

test.describe('Phase C Live Training Dashboard', () => {
  test('navigates to /live and displays progress, metrics charts, and controls', async ({ page }) => {
    await page.goto('/');

    // Expand rail if collapsed to ensure links are visible
    const rail = page.locator('.rail');
    if (await rail.isVisible()) {
      const isExpanded = await rail.evaluate((el) => el.classList.contains('expanded'));
      if (!isExpanded) {
        await page.click('button[aria-label="Expand navigation"]');
      }
    }

    await page.click('a[href="/live"]');
    await expect(page).toHaveURL(/.*\/live$/);
    await expect(page.locator('h1, h2')).toContainText(/live/i);
    await expect(page.locator('button:has-text("Start Training")')).toBeVisible();

    // Verify key live components are present
    await expect(page.locator('[data-testid="progress-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="gpu-monitor"]')).toBeVisible();
    await expect(page.locator('[data-testid="sample-gallery"]')).toBeVisible();
  });
});
