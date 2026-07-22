import { test, expect } from "@playwright/test";

test.describe("Phase A Desktop Flows", () => {
  test("root redirects to General and loads shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/general$/);
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
    const trainDeviceInput = page.locator("#field-train-device");
    await trainDeviceInput.fill("cuda:0");
    await expect(page.locator(".state-badge")).toHaveText("Saved");

    await page.reload();
    await expect(trainDeviceInput).toHaveValue("cuda:0");
  });

  test("invalid numeric text remains visible and Unsaved", async ({ page }) => {
    await page.goto("/general");
    const numberInput = page.locator("#field-dataloader-threads");
    await numberInput.fill("invalid-num");
    await expect(numberInput).toHaveValue("invalid-num");
    await expect(page.locator(".state-badge")).toHaveText("Unsaved");
  });

  test("conflict handling between two browser contexts", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto("/general");
    await pageB.goto("/general");

    const inputA = pageA.locator("#field-train-device");
    const numInputB = pageB.locator("#field-dataloader-threads");
    const inputB = pageB.locator("#field-train-device");

    // Page B makes local dirty edit (invalid text prevents autosave from firing automatically)
    await numInputB.fill("invalid-num");
    await expect(pageB.locator(".state-badge")).toHaveText("Unsaved");

    // Page A saves a valid edit, advancing server revision
    await inputA.fill("cuda:0");
    await expect(pageA.locator(".state-badge")).toHaveText("Saved");

    // Page B receives remote change while dirty and enters Conflict state
    await expect(pageB.locator(".state-badge")).toHaveText("Conflict");

    // Reload syncs pageB to server state
    await pageB.locator('button:has-text("Reload")').click();
    await expect(pageB.locator(".state-badge")).toHaveText("Saved");
    await expect(inputB).toHaveValue("cuda:0");

    // Cause a second conflict
    await numInputB.fill("invalid-num-2");
    await expect(pageB.locator(".state-badge")).toHaveText("Unsaved");

    await inputA.fill("cuda:1");
    await expect(pageA.locator(".state-badge")).toHaveText("Saved");

    await expect(pageB.locator(".state-badge")).toHaveText("Conflict");

    // Context B fixes invalid input and explicitly overwrites
    await numInputB.fill("2");
    await pageB.locator('button:has-text("Overwrite")').click();
    await expect(pageB.locator(".state-badge")).toHaveText("Saved");

    await contextA.close();
    await contextB.close();
  });

  test("pending autosave flushes before named-preset save", async ({ page }) => {
    await page.goto("/general");
    const deviceInput = page.locator("#field-train-device");
    await deviceInput.fill("cuda:2");

    await page.locator('button:has-text("Save Preset")').click();
    await page.locator('input[aria-label="Preset Name"]').fill("E2E Test Preset");
    await page.locator('.modal-actions button:has-text("Save")').click();

    await expect(page.locator(".modal-content")).not.toBeVisible();
    await expect(page.locator(".state-badge")).toHaveText("Saved");
  });

  test("deep-linking and browser navigation between tabs", async ({ page }) => {
    await page.goto("/general");
    await expect(page.locator("h1.page-title")).toHaveText("General");

    await page.goto("/data");
    await expect(page.locator("h1.page-title")).toHaveText("Data");

    await page.goto("/backup");
    await expect(page.locator("h1.page-title")).toHaveText("Backup");

    await page.goBack();
    await expect(page).toHaveURL(/.*\/data$/);
    await expect(page.locator("h1.page-title")).toHaveText("Data");

    await page.goBack();
    await expect(page).toHaveURL(/.*\/general$/);
    await expect(page.locator("h1.page-title")).toHaveText("General");

    await page.goForward();
    await expect(page).toHaveURL(/.*\/data$/);
  });
});
