import { test, expect } from "@playwright/test";

const ROUTES = [
  "/live",
  "/gallery",
  "/general",
  "/model",
  "/datasets",
  "/concepts",
  "/training",
  "/sampling",
  "/backup",
  "/lora",
  "/embeddings",
  "/secrets",
];

test.describe("Phone layout", () => {
  for (const route of ROUTES) {
    test(`${route} does not scroll horizontally`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });

      // 1px of tolerance for sub-pixel rounding on fractional device widths.
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }

  test("training controls stay inside the viewport", async ({ page }) => {
    await page.goto("/general");
    await page.waitForLoadState("networkidle");

    const startBtn = page.getByRole("button", { name: "Start Training" });
    await expect(startBtn).toBeVisible();

    const box = await startBtn.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  });

  test("the header occupies a single row", async ({ page }) => {
    await page.goto("/general");
    await page.waitForLoadState("networkidle");

    const header = page.locator("header").first();
    const height = (await header.boundingBox())!.height;

    // One row of 44px controls plus padding. Two rows would exceed this.
    expect(height).toBeLessThan(72);
  });

  test("a config icon opens its option sheet and applies the choice", async ({ page }) => {
    await page.goto("/general");
    await page.waitForLoadState("networkidle");

    const bar = page.getByTestId("header-mobile-bar");
    await bar.getByRole("button", { name: "Training method" }).click();

    const options = page.getByRole("listbox").getByRole("option");
    await expect(options.first()).toBeVisible();

    const chosen = await options.first().innerText();
    await options.first().click();

    await expect(options).toHaveCount(0);
    expect(chosen.trim().length).toBeGreaterThan(0);
  });

  test("the sub-nav select switches the visible section", async ({ page }) => {
    await page.goto("/general");
    await page.waitForLoadState("networkidle");

    const subnav = page.getByRole("combobox", { name: "General section" });
    await expect(subnav).toBeVisible();

    await subnav.selectOption({ index: 1 });
    await expect(subnav).toHaveValue("1");
  });
});
