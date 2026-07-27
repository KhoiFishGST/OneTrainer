import { test, expect } from "@playwright/test";

test.describe("Phase A Desktop Flows", () => {
  test("root redirects to Live and loads shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/live$/);
    await expect(page.locator(".app-title")).toHaveText("OneTrainer");
    await expect(page.locator(".rail")).toBeVisible();
  });

  test("compact rail expands, persists after reload, and future links remain disabled", async ({ page }) => {
    await page.goto("/general");
    const railToggle = page.locator('button[aria-label="Expand navigation"]');
    await railToggle.click();
    await expect(page.locator(".rail")).toHaveClass(/expanded/);

    await page.reload();
    await expect(page.locator(".rail")).toHaveClass(/expanded/);

    const disabledLink = page.locator('a.nav-item.disabled[aria-disabled="true"]').first();
    await expect(disabledLink).toBeVisible();
  });

  test("valid workspace edit reaches Saved and survives reload", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("tab", { name: "Hardware" }).click();
    const trainDeviceInput = page.locator("#field-train-device");
    await trainDeviceInput.fill("cuda:0");
    await expect(page.getByTestId("saved-icon-badge")).toBeVisible();

    await page.reload();
    await page.getByRole("tab", { name: "Hardware" }).click();
    await expect(trainDeviceInput).toHaveValue("cuda:0");
  });

  test("invalid numeric text remains visible and Unsaved", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("tab", { name: "Hardware" }).click();
    const numberInput = page.locator("#field-dataloader-threads");
    await numberInput.fill("invalid-num");
    await expect(numberInput).toHaveValue("invalid-num");
    await expect(page.getByTestId("saved-icon-badge")).not.toBeVisible();
  });

  test("conflict handling between two browser contexts", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto("/general");
    await pageB.goto("/general");

    await pageA.getByRole("tab", { name: "Hardware" }).click();
    await pageB.getByRole("tab", { name: "Hardware" }).click();

    const inputA = pageA.locator("#field-train-device");
    const numInputB = pageB.locator("#field-dataloader-threads");
    const inputB = pageB.locator("#field-train-device");

    // Page B makes local dirty edit (invalid text prevents autosave from firing automatically)
    await numInputB.fill("invalid-num");
    await expect(pageB.getByTestId("saved-icon-badge")).not.toBeVisible();

    // Page A saves a valid edit, advancing server revision
    await inputA.fill("cuda:0");
    await expect(pageA.getByTestId("saved-icon-badge")).toBeVisible();

    // Page B receives remote change while dirty and enters Conflict state
    await expect(pageB.locator(".state-badge")).toHaveText("Conflict");

    // Reload syncs pageB to server state
    await pageB.getByRole("button", { name: "Reload" }).click();
    await expect(pageB.getByTestId("saved-icon-badge")).toBeVisible();
    await expect(inputB).toHaveValue("cuda:0");

    // Cause a second conflict
    await numInputB.fill("invalid-num-2");
    await expect(pageB.getByTestId("saved-icon-badge")).not.toBeVisible();

    await inputA.fill("cuda:1");
    await expect(pageA.getByTestId("saved-icon-badge")).toBeVisible();

    await expect(pageB.locator(".state-badge")).toHaveText("Conflict");

    // Context B fixes invalid input and explicitly overwrites
    await numInputB.fill("2");
    await pageB.getByRole("button", { name: "Overwrite" }).click();
    await expect(pageB.getByTestId("saved-icon-badge")).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test("pending autosave flushes before named-preset save", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("tab", { name: "Hardware" }).click();
    const deviceInput = page.locator("#field-train-device");
    await deviceInput.fill("cuda:2");

    await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
    const presetName = `E2E Test Preset ${Date.now()}`;
    await page.getByLabel("Preset Name").fill(presetName);
    await page.locator('[role="dialog"]').getByRole("button", { name: "Save" }).click();

    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.getByTestId("saved-icon-badge")).toBeVisible();
  });

  test("deep-linking and browser navigation between tabs", async ({ page }) => {
    await page.goto("/general");
    await expect(page.locator("h1.page-title")).toHaveText("General");

    await page.goto("/datasets");
    await expect(page.locator("h1.page-title")).toHaveText("Datasets");

    await page.goto("/backup");
    await expect(page.locator("h1.page-title")).toHaveText("Backup");

    await page.goBack();
    await expect(page).toHaveURL(/.*\/datasets$/);
    await expect(page.locator("h1.page-title")).toHaveText("Datasets");

    await page.goBack();
    await expect(page).toHaveURL(/.*\/general$/);
    await expect(page.locator("h1.page-title")).toHaveText("General");

    await page.goForward();
    await expect(page).toHaveURL(/.*\/datasets$/);
  });
});
