import { test, expect, type Page } from "@playwright/test";

const PHONE_ROUTES = ["/live", "/general", "/datasets", "/concepts", "/sampling", "/console"];

/** Elements that must offer a 44x44 pointer target. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"]';

const REQUIRED = 44;

/**
 * Reports controls whose effective pointer target is smaller than `required`.
 *
 * A control passes if EITHER its own border box is big enough, OR a
 * `required` x `required` region centred on it actually hit-tests back to the
 * control.
 *
 * The second case is the important one. Small controls -- switch, checkbox,
 * slider thumb -- are meant to stay visually small and widen their target with a
 * transparent `::after` overlay. Growing the border box instead turns a pill
 * switch into a circle and a 14px checkbox into a 44px slab. Because
 * `getBoundingClientRect` cannot see `::after`, measuring the box alone would
 * either fail those controls or force them to be square, so we hit-test instead.
 */
async function measureTargets(
  page: Page,
  rootSelector: string
): Promise<{ count: number; undersized: string[] }> {
  return page.evaluate(
    ({ rootSelector, selector, required }) => {
      const root = document.querySelector(rootSelector);
      if (!root) return { count: 0, undersized: [`root ${rootSelector} matched nothing`] };

      const undersized: string[] = [];
      let count = 0;

      for (const el of Array.from(root.querySelectorAll(selector)) as HTMLElement[]) {
        let r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        count++;

        if (r.width >= required && r.height >= required) continue;

        // elementFromPoint only resolves coordinates inside the viewport, so a
        // control below the fold would report a false negative. Bring it into
        // view and re-read its box before hit-testing.
        el.scrollIntoView({ block: "center", inline: "center" });
        r = el.getBoundingClientRect();

        // Does a `required` x `required` box centred on the control reach it?
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const h = required / 2 - 1; // stay just inside the required box
        const corners: Array<[number, number]> = [
          [cx - h, cy - h],
          [cx + h, cy - h],
          [cx - h, cy + h],
          [cx + h, cy + h],
        ];
        const covered = corners.every(([x, y]) => {
          const hit = document.elementFromPoint(x, y);
          return !!hit && (hit === el || el.contains(hit));
        });
        if (covered) continue;

        const label =
          el.getAttribute("aria-label") ||
          el.textContent?.trim().slice(0, 40) ||
          String(el.className);
        undersized.push(
          `${label} -> ${Math.round(r.width)}x${Math.round(r.height)} box, no ${required}px target`
        );
      }

      return { count, undersized };
    },
    { rootSelector, selector: INTERACTIVE, required: REQUIRED }
  );
}

test.describe("Phone touch targets", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("phone")) test.skip();
  });

  for (const route of PHONE_ROUTES) {
    test(`every interactive control on ${route} offers a 44x44 target`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const { count, undersized } = await measureTargets(page, "body");
      expect(count).toBeGreaterThan(0);
      expect(
        undersized,
        `Undersized controls on ${route}:\n${undersized.join("\n")}`
      ).toEqual([]);
    });
  }

  test("the mobile navigation sheet has no undersized controls", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Open navigation" }).click();

    const nav = page.getByRole("dialog", { name: "Navigation" });
    await expect(nav).toBeVisible();

    const { count, undersized } = await measureTargets(page, '[role="dialog"]');
    expect(count).toBeGreaterThan(0);
    expect(undersized, `Undersized nav controls:\n${undersized.join("\n")}`).toEqual([]);
  });

  test("a switch stays a pill and a checkbox stays a small box", async ({ page }) => {
    await page.goto("/general");
    const sw = page.locator('[data-slot="switch"]').first();
    await expect(sw).toBeVisible();
    const swBox = (await sw.boundingBox())!;
    // A switch is a horizontal pill, not a circle.
    expect(swBox.width).toBeGreaterThan(swBox.height * 1.4);
    expect(swBox.height).toBeLessThan(30);

    await page.goto("/concepts");
    const cb = page.locator('[data-slot="checkbox"]').first();
    await expect(cb).toBeVisible();
    const cbBox = (await cb.boundingBox())!;
    // A checkbox is a small square, not a 44px slab.
    expect(cbBox.width).toBeLessThan(30);
    expect(Math.abs(cbBox.width - cbBox.height)).toBeLessThan(4);
  });
});
