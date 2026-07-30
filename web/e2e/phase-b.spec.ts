import { test, expect } from "@playwright/test";
import { expectNoSaveProblem, expectSaved, pickDifferentValue } from "./helpers/config-state";

test.describe("Phase B Configuration Surface", () => {
  test("navigates through Model, Training, Sampling, LoRA, and Concepts tabs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/live$/);

    // Expand rail if collapsed to ensure labels/links are interactable
    const rail = page.locator(".rail");
    if (await rail.isVisible()) {
      const isExpanded = await rail.evaluate((el) => el.classList.contains("expanded"));
      if (!isExpanded) {
        await page.getByRole("button", { name: "Expand navigation" }).click();
      }
    }

    // Navigate to Model tab
    await page.getByRole("link", { name: "Model" }).click();
    await expect(page).toHaveURL(/.*\/model$/);
    await expect(page.getByRole("heading", { level: 1, name: /model/i })).toBeVisible();

    // Navigate to Training tab and open Optimizer modal
    await page.getByRole("link", { name: "Training" }).click();
    await expect(page).toHaveURL(/.*\/training$/);
    await expect(page.getByRole("heading", { level: 1, name: /training/i })).toBeVisible();

    // Open Optimizer modal
    await page.getByTitle("Configure advanced optimizer parameters").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Close Optimizer modal with Cancel button
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();

    // Navigate to Sampling tab
    await page.getByRole("link", { name: "Sampling" }).click();
    await expect(page).toHaveURL(/.*\/sampling$/);
    await expect(page.getByRole("heading", { level: 1, name: /sampling/i })).toBeVisible();

    // Navigate to LoRA tab
    await page.getByRole("link", { name: "LoRA" }).click();
    await expect(page).toHaveURL(/.*\/lora$/);
    await expect(page.getByRole("heading", { level: 1, name: /lora/i })).toBeVisible();

    // Navigate to Concepts tab
    await page.getByRole("link", { name: "Concepts" }).click();
    await expect(page).toHaveURL(/.*\/concepts$/);
    await expect(page.getByRole("heading", { level: 1, name: /concepts/i })).toBeVisible();
  });

  test("Optimizer / Scheduler modal updates training values and persists draft state", async ({ page }) => {
    await page.goto("/training");
    await expect(page.getByRole("heading", { level: 1, name: /training/i })).toBeVisible();

    // Open modal
    await page.getByTitle("Configure advanced optimizer parameters").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill beta1 input inside modal
    const beta1Input = dialog.locator('#param-beta1');
    const beta1 = await pickDifferentValue(page, "optimizer.beta1", [0.8, 0.85]);
    await beta1Input.fill(String(beta1));

    // Click Apply Parameters inside modal
    await dialog.getByRole("button", { name: "Apply Parameters" }).click();
    await expect(dialog).not.toBeVisible();

    // The applied modal value must reach the workspace and persist
    await expectSaved(page, "optimizer.beta1", beta1);
    await expectNoSaveProblem(page);
  });

  test("Concepts editor supports adding and configuring dataset concepts", async ({ page }) => {
    const reset = await page.request.put("/api/concepts", { data: { concepts: [] } });
    expect(reset.ok()).toBeTruthy();

    await page.goto("/concepts");
    await expect(page.getByRole("heading", { level: 1, name: /concepts/i })).toBeVisible();

    // Click Add First Concept button
    const addBtn = page.getByRole("button", { name: "Add First Concept" });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Modal opens for concept detail
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.getByRole("textbox", { name: "Name" }).fill("E2E Concept");

    // Save concept settings
    await modal.getByRole("button", { name: "Save Concept Settings" }).click();
    await expect(modal).not.toBeVisible();

    // Verify concept card with E2E Concept text is visible
    await expect(page.getByText("E2E Concept")).toBeVisible();
  });
});
