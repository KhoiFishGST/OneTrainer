import { test, expect } from "@playwright/test";

const RUN_KEY = "fixture-run";
const GALLERY = {
  active: true,
  run: {
    key: RUN_KEY,
    config_filename: "config.json",
    started_at: "2026-07-28T00:00:00Z",
  },
  revisions: {
    rev1: {
      captured_at: "2026-07-28T00:00:00Z",
      prompts: [
        {
          webui_id: "p1",
          source_index: 0,
          enabled: true,
          prompt: "a fixture prompt",
          negative_prompt: "",
          width: 512,
          height: 512,
          diffusion_steps: 30,
          cfg_scale: 7.5,
          noise_scheduler: "EULER_A",
          seed: 1234,
        },
      ],
    },
  },
  batches: [
    {
      id: 1,
      sampled_at: "2026-07-28T00:00:00Z",
      epoch: 1,
      epoch_step: 100,
      global_step: 100,
      prompt_revision_id: "rev1",
      expected_prompt_ids: ["p1"],
      expected_variants: ["base"],
      samples: [
        {
          webui_prompt_id: "p1",
          source_index: 0,
          variant: "base",
          status: "ready",
          filename: "a.png",
        },
      ],
      unassigned_errors: [],
    },
    {
      id: 2,
      sampled_at: "2026-07-28T00:00:01Z",
      epoch: 2,
      epoch_step: 200,
      global_step: 200,
      prompt_revision_id: "rev1",
      expected_prompt_ids: ["p1"],
      expected_variants: ["base"],
      samples: [
        {
          webui_prompt_id: "p1",
          source_index: 0,
          variant: "base",
          status: "ready",
          filename: "b.png",
        },
      ],
      unassigned_errors: [],
    },
  ],
};

// A 512x512 red PNG, so image requests resolve with realistic image dimensions
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAIXElEQVR4nO3WoQEAIADDsP3/NHwBohHxld3ZDgDQst8BAMB7BgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABAkAEAgCADAABBBgAAggwAAAQZAAAIMgAAEGQAACDIAABA0AWc8XeJpBefBQAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("Gallery image viewer", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("opening an image shows the image and both nav controls", async ({ page }) => {
    await page.route("**/api/gallery/runs", (route) =>
      route.fulfill({
        status: 200,
        json: {
          runs: [
            {
              key: RUN_KEY,
              config_filename: "config.json",
              started_at: "2026-07-28T00:00:00Z",
              batch_count: 2,
              active: true,
            },
          ],
        },
      })
    );
    await page.route("**/api/gallery/current", (route) =>
      route.fulfill({ status: 200, json: GALLERY })
    );
    await page.route(`**/api/gallery/runs/${RUN_KEY}`, (route) =>
      route.fulfill({ status: 200, json: GALLERY })
    );
    await page.route("**/api/gallery/runs/*/images/*", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG })
    );

    await page.goto("/gallery");
    await page.waitForLoadState("networkidle");

    const thumb = page.locator("main img").first();
    await expect(thumb).toBeVisible();
    await thumb.click();

    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();

    const full = dlg.locator("img").first();
    await expect(full).toBeVisible();
    const imgBox = await full.boundingBox();
    expect(imgBox!.width).toBeGreaterThan(200);
    expect(imgBox!.height).toBeGreaterThan(200);

    await expect(dlg.getByRole("button", { name: /previous checkpoint/i })).toBeVisible();
    await expect(dlg.getByRole("button", { name: /next checkpoint/i })).toBeVisible();
  });
});
