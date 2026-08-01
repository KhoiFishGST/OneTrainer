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
  test.beforeEach(async ({ page }) => {
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
        json: { config: { workspace_dir: "workspace" }, revision: "rev-2" },
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

  test("learning rate values are not rendered as zero", async ({ page }) => {
    // The y-axis ticks are drawn onto the canvas with fillText, so they are not
    // reachable from the DOM. The legend is real DOM and runs through the same
    // formatMetricValue, so it is the assertable end of the same wiring: before
    // the fix, uPlot's default Intl.NumberFormat rendered 1e-4 here as "0".
    await page.goto(`/live?run=${RUN_KEY}`);
    await page.waitForLoadState("networkidle");

    const lrCard = page.locator(".bg-card", { hasText: "Learning Rate" });
    await expect(lrCard).toBeVisible();

    const container = lrCard.locator('[data-testid="metrics-chart-canvas-container"]');
    await expect(container).toBeVisible();

    // The live legend reads "--" until the cursor is over the plot.
    const over = container.locator(".u-over");
    await expect(over).toBeVisible();
    await over.hover();

    const values = container.locator(".u-legend .u-value");
    await expect(values).not.toHaveCount(0);

    await expect
      .poll(async () => {
        const texts = await values.allInnerTexts();
        // Drop the x-axis (Step) cell; we care about the learning rate series.
        return texts.slice(1).some((t) => {
          const token = t.trim();
          return token !== "" && token !== "--" && Number(token) !== 0;
        });
      })
      .toBe(true);
  });
});
