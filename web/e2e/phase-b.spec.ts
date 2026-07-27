import { test, expect } from "@playwright/test";

test.describe("Phase B Configuration Surface", () => {
  test("navigates through Model, Training, Sampling, LoRA, and Concepts tabs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/live$/);

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
    await page.getByTitle("Configure advanced optimizer parameters").first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".modal-title")).toContainText(/optimizer/i);

    // Close Optimizer modal with Cancel button
    await dialog.getByRole("button", { name: "Cancel" }).click();
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
  });

  test("Optimizer / Scheduler modal updates training values and persists draft state", async ({ page }) => {
    await page.goto("/training");
    await expect(page.locator("h1.page-title")).toContainText(/training/i);

    // Open modal
    await page.getByTitle("Configure advanced optimizer parameters").first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Fill beta1 input inside modal
    const beta1Input = dialog.locator('#param-beta1');
    await beta1Input.fill("0.8");

    // Click Apply Parameters inside modal
    await dialog.getByRole("button", { name: "Apply Parameters" }).click();
    await expect(dialog).not.toBeVisible();

    // Workspace should reflect saved/unsaved status
    await expect(page.getByTestId("saved-icon-badge")).toBeVisible();
  });

  test("Concepts editor supports adding and configuring dataset concepts", async ({ page }) => {
    const reset = await page.request.put("/api/concepts", { data: { concepts: [] } });
    expect(reset.ok()).toBeTruthy();

    await page.goto("/concepts");
    await expect(page.locator("h1.page-title")).toContainText(/concepts/i);

    // Click Add First Concept button
    const addBtn = page.getByRole("button", { name: "Add First Concept" });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Modal opens for concept detail
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await modal.getByLabel("Name").fill("E2E Concept");

    // Save concept settings
    await modal.getByRole("button", { name: "Save Concept Settings" }).click();
    await expect(modal).not.toBeVisible();

    // Verify concept card with E2E Concept text is visible
    await expect(page.locator(".concept-card", { hasText: "E2E Concept" })).toBeVisible();
  });
});
