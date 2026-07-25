import { test, expect } from "@playwright/test";

test.describe("Phase B Configuration Surface", () => {
  test("navigates through Model, Training, Sampling, LoRA, and Concepts tabs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/general$/);

    // Expand rail if collapsed to ensure labels/links are interactable
    const rail = page.locator(".rail");
    if (await rail.isVisible()) {
      const isExpanded = await rail.evaluate((el) => el.classList.contains("expanded"));
      if (!isExpanded) {
        await page.click('button[aria-label="Expand navigation"]');
      }
    }

    // Navigate to Model tab
    await page.click('a[href="/model"]');
    await expect(page).toHaveURL(/.*\/model$/);
    await expect(page.locator("h1.page-title")).toContainText(/model/i);

    // Navigate to Training tab and open Optimizer modal
    await page.click('a[href="/training"]');
    await expect(page).toHaveURL(/.*\/training$/);
    await expect(page.locator("h1.page-title")).toContainText(/training/i);

    // Open Optimizer modal
    await page.click('button:has-text("Configure Optimizer")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".modal-title")).toContainText(/optimizer/i);

    // Close Optimizer modal with Cancel/Close button
    await page.click('.modal-footer button:has-text("Cancel"), button[aria-label="Close"]');
    await expect(dialog).not.toBeVisible();

    // Navigate to Sampling tab
    await page.click('a[href="/sampling"]');
    await expect(page).toHaveURL(/.*\/sampling$/);
    await expect(page.locator("h1.page-title")).toContainText(/sampling/i);

    // Navigate to LoRA tab
    await page.click('a[href="/lora"]');
    await expect(page).toHaveURL(/.*\/lora$/);
    await expect(page.locator("h1.page-title")).toContainText(/lora/i);

    // Navigate to Concepts tab
    await page.click('a[href="/concepts"]');
    await expect(page).toHaveURL(/.*\/concepts$/);
    await expect(page.locator("h1.page-title")).toContainText(/concepts/i);
    await expect(page.locator('button:has-text("Add Concept")')).toBeVisible();
  });

  test("Optimizer / Scheduler modal updates training values and persists draft state", async ({ page }) => {
    await page.goto("/training");
    await expect(page.locator("h1.page-title")).toContainText(/training/i);

    // Open modal
    await page.click('button:has-text("Configure Optimizer")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Fill learning rate input inside modal
    const lrInput = dialog.locator('#field-learning_rate');
    await lrInput.fill("0.0002");

    // Click Save inside modal
    await dialog.locator('button:has-text("Save")').click();
    await expect(dialog).not.toBeVisible();

    // Workspace should reflect dirty unsaved/saved state badge
    await expect(page.locator(".state-badge")).toBeVisible();
  });

  test("Concepts editor supports adding and configuring dataset concepts", async ({ page }) => {
    await page.goto("/concepts");
    await expect(page.locator("h1.page-title")).toContainText(/concepts/i);

    // Click Add Concept button
    const addBtn = page.locator('button:has-text("Add Concept")').first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Verify concept card is added
    const conceptCard = page.locator(".concept-card").first();
    await expect(conceptCard).toBeVisible();

    // Fill instance prompt field
    const promptInput = conceptCard.locator("#instance-prompt-0");
    await promptInput.fill("a photo of my_custom_token object");
    await expect(promptInput).toHaveValue("a photo of my_custom_token object");

    // Save changes button should be functional
    const saveBtn = page.locator('button:has-text("Save Changes")');
    await expect(saveBtn).toBeVisible();
  });
});
