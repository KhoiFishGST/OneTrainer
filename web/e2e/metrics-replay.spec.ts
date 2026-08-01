import { test, expect } from "@playwright/test";

const RUN_KEY = "fixture-run-1";
const GALLERY_RUN = {
  active: false,
  run: {
    key: RUN_KEY,
    config_filename: "config.json",
    started_at: "2026-07-28T00:00:00Z",
  },
  revisions: {},
  batches: [],
};

const MOCK_METRICS = [
  { step: 100, epoch: 1, elapsed_seconds: 10, lr_0: 0.0001, loss_0: 0.5 },
  { step: 200, epoch: 2, elapsed_seconds: 20, lr_0: 0.00005, loss_0: 0.25 },
];

test.describe("metrics replay", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();

    await page.route("**/api/gallery/runs", (route) =>
      route.fulfill({
        status: 200,
        json: {
          runs: [
            {
              key: RUN_KEY,
              config_filename: "config.json",
              started_at: "2026-07-28T00:00:00Z",
              batch_count: 0,
              active: false,
            },
          ],
        },
      })
    );
    await page.route("**/api/gallery/current", (route) =>
      route.fulfill({ status: 200, json: GALLERY_RUN })
    );
    await page.route(`**/api/gallery/runs/${RUN_KEY}`, (route) =>
      route.fulfill({ status: 200, json: GALLERY_RUN })
    );
    await page.route(`**/api/gallery/runs/${RUN_KEY}/load`, (route) =>
      route.fulfill({
        status: 200,
        json: { revision: "rev-2", draft: {} },
      })
    );
    await page.route(`**/api/gallery/runs/${RUN_KEY}/metrics`, (route) =>
      route.fulfill({
        status: 200,
        json: { metrics: MOCK_METRICS },
      })
    );
    await page.route("**/api/training/status", (route) =>
      route.fulfill({
        status: 200,
        json: {
          state: "IDLE",
          step: 0,
          max_steps: 1000,
          epoch: 0,
          max_epochs: 10,
          speed_its: 0,
          elapsed_seconds: 0,
          eta_seconds: 0,
        },
      })
    );
    await page.route("**/api/training/metrics", (route) =>
      route.fulfill({ status: 200, json: [] })
    );
    await page.route("**/api/training/gpu", (route) =>
      route.fulfill({ status: 200, json: { devices: [] } })
    );
  });

  test("Load Run opens the live dashboard scoped to that run", async ({ page }) => {
    await page.goto("/gallery");
    await page.waitForLoadState("networkidle");

    const loadBtn = page.getByRole("button", { name: "Load Run" });
    await expect(loadBtn).toBeEnabled();
    await loadBtn.click();

    const dialogBtn = page.getByRole("dialog").getByRole("button", { name: "Load Run" });
    if (await dialogBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dialogBtn.click();
    }

    await expect(page).toHaveURL(new RegExp(`/live\\?run=${RUN_KEY}`));

    const banner = page.locator('[data-testid="historical-run-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(RUN_KEY);

    const lrChartTitle = page.getByRole("heading", { name: "Learning Rate" });
    await expect(lrChartTitle).toBeVisible();
  });

  test("the run selector returns to live", async ({ page }) => {
    await page.goto(`/live?run=${RUN_KEY}`);
    await page.waitForLoadState("networkidle");

    const banner = page.locator('[data-testid="historical-run-banner"]');
    await expect(banner).toBeVisible();

    const selector = page.getByLabel("Viewing run");
    await expect(selector).toBeVisible();
    await selector.selectOption({ value: "" });

    await expect(banner).not.toBeVisible();
  });

  test("learning rate axis labels are not all zeros", async ({ page }) => {
    await page.goto(`/live?run=${RUN_KEY}`);
    await page.waitForLoadState("networkidle");

    const lrCard = page.locator(".bg-card", { hasText: "Learning Rate" });
    await expect(lrCard).toBeVisible();

    const container = lrCard.locator('[data-testid="metrics-chart-canvas-container"]');
    await expect(container).toBeVisible();

    await expect(container.locator(".u-axis")).not.toHaveCount(0);

    const axisText = await container.locator(".u-axis").allInnerTexts();
    const textCombined = axisText.join(" ");

    const tokens = textCombined.split(/\s+/).filter(Boolean);
    const hasNonZero = tokens.some((token) => token !== "0" && token !== "0.00" && token !== "0.000");
    expect(hasNonZero).toBe(true);
  });
});
