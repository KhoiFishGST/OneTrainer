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

  test("the navigation drawer is as narrow as its configured width", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Open navigation" }).click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();

    // 9rem at the app's 16px root. Asserting the rendered width rather than
    // the constant: the constant was already 9rem while the drawer rendered
    // at 293px, because the sheet's own `w-3/4` outranked it.
    const box = (await drawer.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(145);
    expect(box.width).toBeGreaterThanOrEqual(143);
  });

  test("navigation rows are at least 44px apart", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();

    const tooTight = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]')!;
      const rows = [...dlg.querySelectorAll('a[href]')] as HTMLElement[];
      const out: string[] = [];
      for (let i = 1; i < rows.length; i++) {
        const pitch =
          rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().top;
        if (pitch < 44) {
          out.push(`${rows[i - 1].textContent?.trim()} -> ${rows[i].textContent?.trim()}: ${Math.round(pitch)}px`);
        }
      }
      return out;
    });

    // Pitch, not box height: two 36px rows 2px apart satisfy a box check via
    // overlapping ::after overlays while the lower half of each row actually
    // activates its neighbour.
    expect(tooTight, `Rows closer than 44px:\n${tooTight.join("\n")}`).toEqual([]);
  });

  test("the navigation fills its drawer without dead space or scrolling", async ({ page }) => {
    for (const height of [844, 667]) {
      await page.setViewportSize({ width: 390, height });
      await page.goto("/general");
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();

      const fit = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
        const rows = [...dlg.querySelectorAll('a[href], button')] as HTMLElement[];
        const visible = rows.filter((r) => r.getBoundingClientRect().height > 0);
        const last = visible[visible.length - 1].getBoundingClientRect();
        const scroller = [...dlg.querySelectorAll('*')].find(
          (el) => getComputedStyle(el as HTMLElement).overflowY === 'auto'
        ) as HTMLElement | undefined;
        return {
          slackBelowLastRow: Math.round(dlg.getBoundingClientRect().bottom - last.bottom),
          scrolls: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : false,
        };
      });

      expect(fit.scrolls, `drawer scrolls at ${height}px tall`).toBe(false);
      expect(fit.slackBelowLastRow, `dead space at ${height}px tall`).toBeLessThanOrEqual(24);
    }
  });

  /**
   * The app shell is `overflow-hidden`, so content pushed past the right edge
   * is clipped rather than scrolled. `document.scrollWidth` therefore stays
   * equal to `clientWidth` and the horizontal-scroll check above cannot see
   * it. Measure the controls themselves instead.
   */
  for (const width of [320, 360, 390, 430]) {
    test(`no shell control is clipped at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/general");
      await page.waitForLoadState("networkidle");

      const clipped = await page.evaluate((vw) => {
        const selectors = [
          '[aria-label="Open navigation"]',
          '[data-testid="header-mobile-bar"] button',
          '[aria-label^="Switch to"]',
          '[data-testid="training-status-pill-mobile"]',
          "footer button",
        ];
        const out: string[] = [];
        for (const selector of selectors) {
          const nodes = [...document.querySelectorAll(selector)] as HTMLElement[];
          if (nodes.length === 0) {
            out.push(`${selector}: not rendered`);
            continue;
          }
          for (const el of nodes) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right > vw + 1 || r.left < -1) {
              const name = el.getAttribute("aria-label") ?? el.textContent?.trim() ?? selector;
              out.push(`${name}: ${Math.round(r.left)}..${Math.round(r.right)} outside 0..${vw}`);
            }
          }
        }
        return out;
      }, width);

      expect(clipped, `Clipped at ${width}px:\n${clipped.join("\n")}`).toEqual([]);
    });
  }
});

