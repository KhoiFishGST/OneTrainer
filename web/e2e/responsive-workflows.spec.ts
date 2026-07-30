import { test, expect } from "@playwright/test";
import { expectNoSaveProblem, expectSaved, pickDifferentDevice } from "./helpers/config-state";

test.describe("Responsive Workflows & Accessibility Controls", () => {
  test.describe("Desktop Navigation & Sidebar Persistence", () => {
    test.beforeEach(async ({}, testInfo) => {
      if (!testInfo.project.name.includes("desktop")) test.skip();
    });

    test("desktop sidebar collapses, expands, and persists across reload", async ({ page }) => {
      await page.goto("/general");
      const railToggle = page.getByRole("button", { name: "Expand navigation" });
      await expect(railToggle).toBeVisible();

      await railToggle.click();
      await expect(page.locator(".rail")).toHaveClass(/expanded/);

      let isExpanded = await page.evaluate(() => localStorage.getItem("webui.railExpanded"));
      expect(isExpanded).toBe("true");

      await page.reload();
      await expect(page.locator(".rail")).toHaveClass(/expanded/);

      // Collapse sidebar back
      await railToggle.click();
      await expect(page.locator(".rail")).not.toHaveClass(/expanded/);
      isExpanded = await page.evaluate(() => localStorage.getItem("webui.railExpanded"));
      expect(isExpanded).toBe("false");
    });

    test("rail sits below the header and reserves only its own width", async ({ page }) => {
      await page.goto("/general");
      const header = await page.locator("header").boundingBox();
      const rail = await page.locator('[data-slot="sidebar-container"], .rail').first().boundingBox();
      const main = await page.locator("main.main-content").boundingBox();

      // Rail must start at or below the header, never overlapping it.
      expect(rail!.y, `rail.y (${rail!.y}) should be >= header bottom (${header!.y + header!.height})`).toBeGreaterThanOrEqual(header!.y + header!.height - 1);

      // Main content must not be pushed beyond the rail's own width.
      expect(main!.x, `main.x (${main!.x}) should be <= rail width (${rail!.width})`).toBeLessThanOrEqual(rail!.width + 1);

      // Logo must be visible and not covered
      await expect(page.locator("header img[alt='OneTrainer Logo']")).toBeVisible();
    });

    test("opening a dataset does not reload the document", async ({ page }) => {
      await page.goto("/datasets");
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => {
        (window as any).__spaMarker = "alive";
      });

      const target = page.locator("tbody tr, [data-dataset-card]").first();
      await expect(target).toBeVisible();
      await target.click();

      await page.waitForURL(/\/datasets\/.+/);
      const marker = await page.evaluate(() => (window as any).__spaMarker ?? "GONE");
      expect(marker).toBe("alive");
    });
  });


  test.describe("Phone Navigation & Responsive Components", () => {
    test.beforeEach(async ({}, testInfo) => {
      if (!testInfo.project.name.includes("phone")) test.skip();
    });

    test("ephemeral phone sidebar menu opens, navigates, and closes", async ({ page }) => {
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
    });

    test("directory picker opens as Drawer on phone viewport", async ({ page }) => {
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();

      const drawer = page.getByRole("dialog", { name: "Select Directory" });
      await expect(drawer).toBeVisible();
      // On mobile viewport (width 390), the picker renders as the bottom drawer.
      await expect(drawer).toHaveAttribute("data-slot", "drawer-content");

      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
    });

    test("no horizontal page overflow at 390px viewport across main routes", async ({ page }) => {
      const routes = ["/live", "/general", "/datasets", "/concepts", "/training", "/sampling", "/console"];
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(overflow, `Horizontal overflow detected on ${route}`).toBe(false);
      }
    });
  });

  test.describe("Core Workflow Controls & Modals", () => {
    test("schema editing persists to the server", async ({ page }) => {
      await page.goto("/general");
      const isMobile = page.viewportSize() && page.viewportSize()!.width <= 767;
      if (isMobile) {
        await page.getByRole("combobox", { name: "General section" }).selectOption({ label: "Hardware" });
      } else {
        await page.getByRole("tab", { name: "Hardware" }).click();
      }
      const trainDeviceInput = page.locator("#field-train-device");
      const device = await pickDifferentDevice(page);
      await trainDeviceInput.fill(device);
      await expectSaved(page, "train_device", device);
      await expectNoSaveProblem(page);
    });

    test("a dataset created on this page survives a reload", async ({ page }) => {
      await page.goto("/datasets");
      await page.getByRole("button", { name: "Add Dataset" }).click();

      const createModal = page.getByRole("dialog", { name: "Create New Dataset" });
      await expect(createModal).toBeVisible();
      await page.locator("#ds-name-input").fill("Workflow Persistence Check");
      await createModal.getByRole("button", { name: "Create" }).click();
      await expect(createModal).not.toBeVisible();

      await expect(page.getByText("Workflow Persistence Check").first()).toBeVisible();
      await page.reload();
      await expect(page.getByText("Workflow Persistence Check").first()).toBeVisible();
    });

    test("training controls and live dashboard function", async ({ page }) => {
      await page.goto("/live");
      await expect(page.getByRole("button", { name: "Start Training" })).toBeVisible();
    });

    test("console is reachable from the shell", async ({ page }) => {
      await page.goto("/general");
      const viewport = page.viewportSize();
      if (viewport && viewport.width <= 767) {
        // On phones the console is a route, not a drawer: the mobile nav
        // exposes it as an ordinary link to /console.
        const mobileMenu = page.getByRole("button", { name: "Open navigation" });
        await expect(mobileMenu).toBeVisible();
        await mobileMenu.click();
        const nav = page.getByRole("dialog", { name: "Navigation" });
        await nav.getByRole("link", { name: "Console" }).click();
        await expect(page).toHaveURL(/\/console$/);
      } else {
        const consoleToggle = page.getByTitle("Toggle Console Drawer");
        await consoleToggle.click();
        await expect(page.locator('section[aria-label="Console Output"]')).toBeVisible();
      }

      // Same observable either way: the console output viewport is on screen.
      await expect(page.getByRole("region", { name: "Terminal Output Viewport" })).toBeVisible();
    });

    test("destructive confirmation dialog on dataset delete", async ({ page }) => {
      await page.goto("/datasets");

      // Create dataset for deletion test
      const addBtn = page.getByRole("button", { name: "Add Dataset" });
      await expect(addBtn).toBeVisible();
      await addBtn.click();

      const createModal = page.getByRole("dialog", { name: "Create New Dataset" });
      await expect(createModal).toBeVisible();

      const nameInput = page.locator("#ds-name-input");
      await nameInput.fill("Dataset For Deletion");
      await createModal.getByRole("button", { name: "Create" }).click();
      await expect(createModal).not.toBeVisible();

      const datasetItem = page
        .locator("tbody tr", { hasText: "Dataset For Deletion" })
        .or(page.locator(".dataset-card-link", { hasText: "Dataset For Deletion" }));
      await expect(datasetItem).toBeVisible();

      // Trigger deletion confirmation dialog
      await datasetItem.hover();
      const deleteBtn = datasetItem.getByRole("button", { name: "Delete dataset" });
      await expect(deleteBtn).toBeVisible();
      await deleteBtn.click();

      // Assert AlertDialog ("Delete dataset" confirmation title/description) appears
      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible();
      await expect(alertDialog.getByRole("heading", { name: "Delete Dataset" })).toBeVisible();
      await expect(
        alertDialog.getByText(/Are you sure you want to delete dataset "Dataset For Deletion"\?/)
      ).toBeVisible();

      // Click Cancel and verify dataset was NOT deleted
      await alertDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(alertDialog).not.toBeVisible();
      await expect(datasetItem).toBeVisible();

      // Trigger deletion again and click Confirm/Delete
      await datasetItem.hover();
      await deleteBtn.click();
      await expect(alertDialog).toBeVisible();

      await alertDialog.getByRole("button", { name: "Delete" }).click();
      await expect(alertDialog).not.toBeVisible();

      // Verify dataset deletion behavior (item is removed)
      await expect(datasetItem).not.toBeVisible();
    });

    test("responsive viewport transition retains draft in open editor dialog", async ({ page }) => {
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();

      const input = page.locator("input[placeholder='Enter path...']");
      await expect(input).toBeVisible();
      await input.fill("/custom/incomplete/draft/path");

      // Transition viewport from desktop to phone
      await page.setViewportSize({ width: 390, height: 844 });

      // Assert exactly one dialog and draft path retained
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(input).toHaveValue(/\/custom\/incomplete\/draft\/path$/);

      // Transition viewport back to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(input).toHaveValue(/\/custom\/incomplete\/draft\/path$/);
    });
  });
});
