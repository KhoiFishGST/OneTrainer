import { test, expect, type Page } from "@playwright/test";

/*
  Guards against the "opacity hover" defect: solid-variant buttons (default,
  secondary, destructive) must shift to a real --*-hover colour token on
  hover, not an opacity blend of the resting colour. See app.css and
  button.svelte for the tokens/LOCAL MODIFICATION this test protects.
*/
test.describe("Button hover states", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!testInfo.project.name.includes("desktop")) test.skip();
  });

  async function getBg(page: Page, locator: ReturnType<Page["locator"]>) {
    return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  }

  async function assertHoverChanges(page: Page, locator: ReturnType<Page["locator"]>) {
    await expect(locator).toBeVisible();
    const rest = await getBg(page, locator);
    await locator.hover();
    await page.waitForTimeout(250);
    const hover = await getBg(page, locator);
    expect(hover, `expected background to change on hover, both were ${rest}`).not.toBe(rest);
  }

  async function switchToLightTheme(page: Page) {
    const toggle = page.getByRole("button", { name: /switch to light theme/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }

  async function openSaveDialog(page: Page) {
    await page.goto("/general");
    await page.getByTestId("header-desktop-bar").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog", { name: "Save Configuration" })).toBeVisible();
  }

  async function gotoSecretsWithPasswordSet(page: Page) {
    await page.route("**/api/secrets**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          huggingface_token: "",
          huggingface_token_set: false,
          webui_password_set: true,
        }),
      })
    );
    await page.goto("/secrets");
  }

  test("primary (default variant) button changes background on hover in dark theme", async ({ page }) => {
    await openSaveDialog(page);
    const saveBtn = page.getByRole("dialog", { name: "Save Configuration" }).getByRole("button", { name: "Save" });
    await assertHoverChanges(page, saveBtn);
  });

  test("primary (default variant) button changes background on hover in light theme", async ({ page }) => {
    await page.goto("/general");
    await switchToLightTheme(page);
    await page.getByTestId("header-desktop-bar").getByRole("button", { name: "Save" }).click();
    const dialog = page.getByRole("dialog", { name: "Save Configuration" });
    await expect(dialog).toBeVisible();
    const saveBtn = dialog.getByRole("button", { name: "Save" });
    await assertHoverChanges(page, saveBtn);
  });

  test("secondary variant button changes background on hover in dark theme", async ({ page }) => {
    await openSaveDialog(page);
    const cancelBtn = page.getByRole("dialog", { name: "Save Configuration" }).getByRole("button", { name: "Cancel" });
    await assertHoverChanges(page, cancelBtn);
  });

  test("secondary variant button changes background on hover in light theme", async ({ page }) => {
    await page.goto("/general");
    await switchToLightTheme(page);
    await page.getByTestId("header-desktop-bar").getByRole("button", { name: "Save" }).click();
    const dialog = page.getByRole("dialog", { name: "Save Configuration" });
    await expect(dialog).toBeVisible();
    const cancelBtn = dialog.getByRole("button", { name: "Cancel" });
    await assertHoverChanges(page, cancelBtn);
  });

  test("destructive variant button changes background on hover in dark theme", async ({ page }) => {
    await gotoSecretsWithPasswordSet(page);
    const clearBtn = page.getByRole("button", { name: "Clear Password" });
    await assertHoverChanges(page, clearBtn);
  });

  test("destructive variant button changes background on hover in light theme", async ({ page }) => {
    await gotoSecretsWithPasswordSet(page);
    await switchToLightTheme(page);
    const clearBtn = page.getByRole("button", { name: "Clear Password" });
    await assertHoverChanges(page, clearBtn);
  });
});
