import { test, expect } from "@playwright/test";

test.describe("Phone Mobile Editing Flows", () => {
  test("off-canvas rail navigation drawer opens, navigates, and closes", async ({ page }) => {
    await page.goto("/general");

    const menuBtn = page.getByRole("button", { name: "Open navigation" });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();

    const dataLink = drawer.getByRole("link", { name: "Datasets" });
    await dataLink.click();

    await expect(page).toHaveURL(/.*\/datasets$/);
    await expect(drawer).not.toBeVisible();

    await menuBtn.click();
    await expect(drawer).toBeVisible();

    // Close via backdrop / Escape or Sheet close button
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("full-screen directory picker focus trap, wrap, Escape, and focus restoration", async ({ page }) => {
    await page.goto("/general");

    const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
    await browseBtn.click();

    const modal = page.getByRole("dialog", { name: "Select Directory" });
    await expect(modal).toBeVisible();

    // Focus starts in path input
    const pathInput = modal.locator("input[placeholder='Enter path...']");
    await expect(pathInput).toBeFocused();

    // Shift+Tab wraps focus within the modal focus trap
    await page.keyboard.press("Shift+Tab");
    await expect(modal.locator(":focus")).toBeVisible();

    // Tab moves focus back into modal input
    await page.keyboard.press("Tab");
    await expect(modal.locator(":focus")).toBeVisible();

    // Escape closes modal and restores focus to browse button
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await expect(browseBtn).toBeFocused();
  });

  test("concept editing and saving flow on mobile", async ({ page }) => {
    await page.goto("/concepts");
    await expect(page.getByRole("heading", { level: 1, name: /concepts/i })).toBeVisible();

    const addBtn = page.getByRole("button", { name: /Add (First )?Concept/i }).first();
    const editBtn = page.getByRole("button", { name: "Edit" }).first();
    const trigger = (await addBtn.isVisible()) ? addBtn : editBtn;
    await trigger.click();

    const modal = page.locator("[role='dialog']").first();
    await expect(modal).toBeVisible();

    const nameInput = modal.locator("#concept-name").or(modal.locator("input").first());
    await nameInput.fill("Mobile Test Concept");

    const saveBtn = modal.getByRole("button", { name: /^save/i }).first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByText("Mobile Test Concept").first()).toBeVisible();
  });

  test("dataset creation and deletion workflow with alertdialog on mobile", async ({ page }) => {
    await page.goto("/datasets");
    await expect(page.getByRole("heading", { level: 1, name: /datasets/i })).toBeVisible();

    const addBtn = page.getByRole("button", { name: "Add Dataset" }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const createModal = page.getByRole("dialog", { name: "Create New Dataset" });
    await expect(createModal).toBeVisible();

    const nameInput = createModal.locator("#ds-name-input");
    await nameInput.fill("Phone Test Dataset");
    await createModal.getByRole("button", { name: "Create" }).click();
    await expect(createModal).not.toBeVisible();

    const datasetCard = page.locator(".dataset-card-link", { hasText: "Phone Test Dataset" });
    await expect(datasetCard).toBeVisible();

    // Trigger delete
    const deleteBtn = datasetCard.getByRole("button", { name: "Delete dataset" });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Require alertdialog specifically with no ordinary-dialog fallback
    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByRole("heading", { name: "Delete Dataset" })).toBeVisible();

    await alertDialog.getByRole("button", { name: "Delete" }).click();
    await expect(alertDialog).not.toBeVisible();
    await expect(datasetCard).not.toBeVisible();
  });

  test("sampling prompt edit workflow on mobile", async ({ page }) => {
    await page.goto("/sampling");

    await expect(page.getByRole("heading", { level: 1, name: /sampling/i })).toBeVisible();

    const addBtn = page.getByRole("button", { name: /add (sample )?prompt/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    const promptInput = modal.locator("#sample-prompt");
    await expect(promptInput).toBeVisible();
    await promptInput.fill("a photo of a cat on phone");

    const saveBtn = modal.getByRole("button", { name: "Add Sample" });
    await saveBtn.click();
    await expect(modal).not.toBeVisible();

    await expect(page.getByText("a photo of a cat on phone").first()).toBeVisible();
  });


















  test("training controls and status pill assertion on mobile", async ({ page }) => {
    await page.goto("/live");
    const startBtn = page.getByRole("button", { name: "Start Training" });
    await expect(startBtn).toBeVisible();

    const statusPill = page.getByTestId("training-status-pill");
    await expect(statusPill).toBeVisible();
    await expect(statusPill).toHaveText(/IDLE|STARTING|TRAINING|COMPLETED|PAUSED|STOPPING|FAILED/);
  });

  test("theme switching and persistence across navigation and reload on mobile", async ({ page }) => {
    await page.goto("/general");
    await expect(page.locator("html")).toHaveClass(/dark/);

    const toggleBtn = page.getByRole("button", { name: /switch to light theme/i });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Navigate to /datasets
    await page.goto("/datasets");
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Reload page
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Switch back to dark theme
    const darkToggleBtn = page.getByRole("button", { name: /switch to dark theme/i });
    await expect(darkToggleBtn).toBeVisible();
    await darkToggleBtn.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
