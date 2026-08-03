import { expect, test } from "@playwright/test";

const RUN_KEY = "fixture-run-1";

test.describe("downloads", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/downloads/runs", (route) =>
      route.fulfill({
        status: 200,
        json: {
          runs: [{
            key: RUN_KEY,
            config_filename: `${RUN_KEY}.json`,
            started_at: "2026-08-02T09:00:00Z",
            checkpoint_count: 1,
            total_size_bytes: 200,
          }],
        },
      })
    );

    await page.route(`**/api/downloads/runs/${RUN_KEY}`, (route) =>
      route.fulfill({
        status: 200,
        json: {
          run: { key: RUN_KEY },
          checkpoints: [{
            id: 1,
            kind: "save",
            filename: "step-1000.safetensors",
            format: "KOHYA_LORA",
            is_directory: false,
            size_bytes: 200,
            created_at: "2026-08-02T09:10:00Z",
            source_path: "/ws/save/step-1000.safetensors",
            linked: true,
            available: true,
          }],
          artifacts: [
            { kind: "config", label: "Config", available: true, is_archive: false,
              size_bytes: 23552, download_name: `${RUN_KEY}.json` },
            { kind: "samples", label: "Samples", available: true, is_archive: true,
              size_bytes: 2411724, download_name: `${RUN_KEY}-samples.zip` },
            { kind: "tensorboard", label: "Tensorboard", available: false, is_archive: true,
              size_bytes: 0, download_name: `${RUN_KEY}-tensorboard.zip` },
          ],
        },
      })
    );
  });

  test("lists a run's checkpoints and offers a download link", async ({ page }) => {
    await page.goto("/downloads");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("cell", { name: "step-1000.safetensors", exact: true })
    ).toBeVisible();

    const link = page.getByRole("link", { name: /download step-1000\.safetensors/i });
    await expect(link).toHaveAttribute(
      "href",
      `/api/downloads/runs/${RUN_KEY}/files/step-1000.safetensors`
    );
  });

  test("lists run artifacts and links each to its own route", async ({ page }) => {
    await page.goto("/downloads");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Run artifacts")).toBeVisible();

    await expect(page.getByRole("link", { name: /download config/i })).toHaveAttribute(
      "href",
      `/api/downloads/runs/${RUN_KEY}/artifacts/config`
    );
    await expect(page.getByRole("link", { name: /download samples/i })).toHaveAttribute(
      "href",
      `/api/downloads/runs/${RUN_KEY}/artifacts/samples`
    );

    // Unavailable artifacts stay visible as a fact rather than disappearing.
    await expect(page.getByText(/not available for this run/i)).toBeVisible();
  });

  test("is reachable from the nav rail", async ({ page }) => {
    await page.goto("/live");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Downloads" }).click();

    await expect(page).toHaveURL(/\/downloads/);
  });
});
