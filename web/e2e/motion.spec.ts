import { test, expect } from "@playwright/test";

test.describe("Overlay motion", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  test("a dialog animates in at the Material-aligned enter duration", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    const dlg = page.getByRole("dialog").first();
    await expect(dlg).toBeVisible();
    const duration = await dlg.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0.2s");
  });

  test("the dialog scrim animates too", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    const scrim = page.locator("[data-dialog-overlay]").first();
    const duration = await scrim.evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe("0.2s");
  });

  test("data-motion=off collapses the duration instead of removing the animation", async ({ page }) => {
    // Drive this through the real settings UI rather than poking the DOM
    // behind the appearance store's back: the store persists the change to
    // the server and the store itself sets data-motion, so this exercises the
    // actual path a user takes instead of state the appearance query would
    // immediately overwrite on its next resolve.
    await page.goto("/general");
    await page.getByRole("tab", { name: "Web UI" }).click();
    const animationsSwitch = page.getByRole("switch", { name: "Animations" });
    await expect(animationsSwitch).toBeChecked();
    await animationsSwitch.click();
    await expect(animationsSwitch).not.toBeChecked();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-motion")))
      .toBe("off");

    try {
      await page.goto("/concepts");
      // The appearance query still resolves once this page mounts; give it a
      // moment to settle so this asserts against the reconciled state, not a
      // race with the initial fetch.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-motion")))
        .toBe("off");
      await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
      const dlg = page.getByRole("dialog").first();
      await expect(dlg).toBeVisible();
      const style = await dlg.evaluate((el) => {
        const s = getComputedStyle(el);
        return { duration: s.animationDuration, name: s.animationName };
      });
      // Chromium serializes 0.01ms as "1e-05s" rather than "0.00001s".
      expect(style.duration).toBe("1e-05s");
      expect(style.name).not.toBe("none");
    } finally {
      // The server-side appearance setting outlives this test (the e2e
      // server keeps one webui.json for the whole suite run), so restore it
      // for tests that assume animations are on.
      await page.goto("/general");
      await page.getByRole("tab", { name: "Web UI" }).click();
      const restoreSwitch = page.getByRole("switch", { name: "Animations" });
      if (!(await restoreSwitch.isChecked())) {
        await restoreSwitch.click();
        await expect(restoreSwitch).toBeChecked();
      }
    }
  });

  test("a closed dialog is removed from the DOM after its exit animation", async ({ page }) => {
    await page.goto("/concepts");
    await page.getByRole("button", { name: /Add (First )?Concept/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the rail transitions its width at the layout duration", async ({ page }) => {
    await page.goto("/model");
    const rail = page.locator(".rail").first();
    await expect(rail).toBeAttached();
    const duration = await rail.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe("0.3s");
  });
});
