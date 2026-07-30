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

  test("the navigation drawer slides in from the edge", async ({ page }) => {
    await page.goto("/general");
    await page.waitForLoadState("networkidle");

    // Arm before opening. The animation is 200ms and does not persist after it
    // finishes, so sampling after the click is a race. The observer catches the
    // drawer the moment bits-ui inserts it, pauses its animation, and reads the
    // box at both ends of the timeline -- deterministic, no timing assumptions.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__sheetSample = null;
      const observer = new MutationObserver(() => {
        const el = document.querySelector("[data-dialog-content][data-side]") as HTMLElement | null;
        if (!el) return;
        observer.disconnect();
        const anims = el.getAnimations();
        const sample: Record<string, unknown> = {
          animationCount: anims.length,
          animationName: getComputedStyle(el).animationName,
          width: el.getBoundingClientRect().width,
        };
        if (anims.length > 0) {
          const anim = anims[0];
          anim.pause();
          anim.currentTime = 0;
          sample.startX = el.getBoundingClientRect().x;
          anim.currentTime = Number(anim.effect!.getComputedTiming().duration) || 200;
          sample.endX = el.getBoundingClientRect().x;
          anim.play();
        }
        (window as unknown as Record<string, unknown>).__sheetSample = sample;
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.waitForFunction(() => (window as unknown as Record<string, unknown>).__sheetSample !== null);

    const sample = (await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__sheetSample
    )) as { animationCount: number; animationName: string; width: number; startX?: number; endX?: number };

    expect(
      sample.animationCount,
      `The drawer has no running animation (animation-name: ${sample.animationName}). ` +
        `The sheet keyframes in src/app.css are the only thing that animates it; ` +
        `Tailwind's animate-in/slide-in-from-* utilities compile to nothing in this project.`
    ).toBeGreaterThan(0);
    expect(sample.animationName).not.toBe("none");

    // It must travel by its own width, from fully off the left edge to rest.
    expect(sample.startX!, "drawer does not start off-screen").toBeLessThanOrEqual(
      -sample.width + 1
    );
    expect(sample.endX!, "drawer does not come to rest at the left edge").toBeGreaterThanOrEqual(-1);
    expect(sample.endX! - sample.startX!, "drawer barely moves").toBeGreaterThanOrEqual(
      sample.width - 1
    );

    // The animation must not have cost the drawer its overlay or its focus trap.
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    await expect(page.locator("[data-dialog-overlay]")).toBeVisible();
  });

  test("navigation rows are at least 44px apart and 44px tall", async ({ page }) => {
    // 844 is the suite's default phone, 667 an iPhone SE, 640 a common short
    // Android. Rows are `flex-1` inside the drawer, so their height falls out
    // of the viewport height -- a single tall-phone run cannot see the floor.
    for (const height of [844, 667, 640]) {
      await page.setViewportSize({ width: 390, height });
      await page.goto("/general");
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();

      const problems = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]')!;
        // `a[href], button` rather than anchors alone: the last nav anchor and
        // the console button are adjacent, so anchors-only leaves that pair
        // unchecked.
        const rows = ([...dlg.querySelectorAll('a[href], button')] as HTMLElement[]).filter(
          (r) => r.getBoundingClientRect().height > 0
        );
        const out: string[] = [];
        for (let i = 0; i < rows.length; i++) {
          const box = rows[i].getBoundingClientRect();
          const label = rows[i].textContent?.trim();
          // Pitch alone is not enough: two 36px rows 8px apart have a 44px
          // pitch while each tap target is 36px. Box height alone is not
          // enough either -- overlapping ::after overlays satisfied it while
          // the lower half of each row activated its neighbour. Assert both.
          if (box.height < 44) {
            out.push(`${label}: ${Math.round(box.height)}px tall`);
          }
          if (i > 0) {
            const pitch = box.top - rows[i - 1].getBoundingClientRect().top;
            if (pitch < 44) {
              out.push(`${rows[i - 1].textContent?.trim()} -> ${label}: ${Math.round(pitch)}px apart`);
            }
          }
        }
        return out;
      });

      expect(problems, `Undersized rows at ${height}px tall:\n${problems.join("\n")}`).toEqual([]);
    }
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

  test("the file dialog slides up from the bottom", async ({ page }) => {
    await page.goto("/general");

    // Arm the observer BEFORE the click, so the panel is caught the instant it
    // mounts and the animation can still be sampled from its first frame.
    await page.evaluate(() => {
      (window as any).__panel = new Promise<HTMLElement>((resolve) => {
        const obs = new MutationObserver(() => {
          const el = document.querySelector("[data-slot='drawer-content']") as HTMLElement | null;
          if (el) {
            obs.disconnect();
            resolve(el);
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
      });
    });

    await page.getByRole("button", { name: "Browse directory" }).first().click();

    const travel = await page.evaluate(async () => {
      const el = (await (window as any).__panel) as HTMLElement;

      const anims = el.getAnimations();
      if (anims.length === 0) {
        return { animated: false, startY: 0, startHeight: 0, endY: 0, viewportH: 0 };
      }
      const a = anims[0];
      a.pause();
      const duration = Number(a.effect?.getComputedTiming().activeDuration ?? 0);
      a.currentTime = 0;
      const startRect = el.getBoundingClientRect();
      a.currentTime = duration;
      const endY = el.getBoundingClientRect().y;
      a.play();
      return {
        animated: true,
        startY: startRect.y,
        startHeight: startRect.height,
        endY,
        viewportH: window.innerHeight,
      };
    });

    expect(travel.animated, "the file dialog has no running animation").toBe(true);
    // The floating-card bottom drawer sits inset 12px (bottom-3) from the true
    // edge (see the LOCAL MODIFICATION note in drawer-content.svelte), so its
    // closed transform (100% of its own height) lands its top edge 12px short
    // of the viewport height rather than exactly at it. Assert the invariant
    // that actually matters -- fully hidden below the fold -- rather than the
    // top edge landing exactly at viewportH.
    expect(
      travel.startY + travel.startHeight,
      "the file dialog is visible before it starts sliding"
    ).toBeGreaterThanOrEqual(travel.viewportH);
    expect(travel.endY).toBeLessThan(travel.startY);
  });

  test("the file dialog is a wide inset card, not a side panel", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Browse directory" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Select Directory" });
    await expect(dialog).toBeVisible();
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
    });

    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;

    // 12px inset each side -- not the 293px (w-3/4) side panel it used to be.
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 25);
    expect(box.width).toBeLessThanOrEqual(viewport.width - 23);
    expect(box.height).toBeLessThanOrEqual(viewport.height * 0.9 + 1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  });
});

