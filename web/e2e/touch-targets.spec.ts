import { test, expect } from "@playwright/test";

const PHONE_ROUTES = ["/live", "/general", "/datasets", "/concepts", "/sampling", "/console"];

const INTERACTIVE =
  'button:visible, a[href]:visible, input:visible, select:visible, textarea:visible, [role="button"]:visible';

test.describe("Phone touch targets", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("phone")) test.skip();
  });

  for (const route of PHONE_ROUTES) {
    test(`every interactive control on ${route} is at least 44x44`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const controls = await page.locator(INTERACTIVE).all();
      expect(controls.length).toBeGreaterThan(0);

      const undersized: string[] = [];
      for (const control of controls) {
        const box = await control.boundingBox();
        if (!box) continue;
        if (box.width < 44 || box.height < 44) {
          const label =
            (await control.getAttribute("aria-label")) ??
            (await control.textContent())?.trim().slice(0, 40) ??
            (await control.evaluate((el) => el.className));
          undersized.push(`${label} -> ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }

      expect(undersized, `Undersized controls on ${route}:\n${undersized.join("\n")}`).toEqual([]);
    });
  }

  test("the mobile navigation sheet has no undersized controls", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("button", { name: "Open navigation" }).click();

    const nav = page.getByRole("dialog", { name: "Navigation" });
    await expect(nav).toBeVisible();

    const controls = await nav.locator(INTERACTIVE).all();
    expect(controls.length).toBeGreaterThan(0);

    const undersized: string[] = [];
    for (const control of controls) {
      const box = await control.boundingBox();
      if (!box) continue;
      if (box.width < 44 || box.height < 44) {
        undersized.push(`${(await control.textContent())?.trim()} -> ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }

    expect(undersized, `Undersized nav controls:\n${undersized.join("\n")}`).toEqual([]);
  });
});
