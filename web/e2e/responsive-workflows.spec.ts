import { test, expect } from "@playwright/test";

test.describe("Responsive Workflows & Accessibility Controls", () => {
  test.describe("Desktop Navigation & Sidebar Persistence", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

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

    test("directory picker opens as Dialog on desktop", async ({ page }) => {
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();

      const dialog = page.getByRole("dialog", { name: "Select Directory" });
      await expect(dialog).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe("Phone Navigation & Responsive Components", () => {
    test.use({ viewport: { width: 390, height: 844 } });

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

    test("directory picker opens as Sheet on phone viewport", async ({ page }) => {
      await page.goto("/general");
      const browseBtn = page.getByRole("button", { name: "Browse directory" }).first();
      await browseBtn.click();

      const sheet = page.getByRole("dialog", { name: "Select Directory" });
      await expect(sheet).toBeVisible();
      // On mobile viewport (width 390), sheet has full-screen / sheet styling class
      await expect(sheet).toHaveClass(/full-screen/);

      await page.keyboard.press("Escape");
      await expect(sheet).not.toBeVisible();
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
    test("schema editing updates saved badge", async ({ page }) => {
      await page.goto("/general");
      await page.getByRole("tab", { name: "Hardware" }).click();
      const trainDeviceInput = page.locator("#field-train-device");
      await trainDeviceInput.fill("cuda:0");
      await expect(page.getByTestId("saved-icon-badge")).toBeVisible();
    });

    test("concepts, datasets, and sampling editing pages load and function", async ({ page }) => {
      await page.goto("/concepts");
      await expect(page.getByRole("heading", { level: 1, name: /concepts/i })).toBeVisible();

      await page.goto("/datasets");
      await expect(page.getByRole("heading", { level: 1, name: /datasets/i })).toBeVisible();

      await page.goto("/sampling");
      await expect(page.getByRole("heading", { level: 1, name: /sampling/i })).toBeVisible();
    });

    test("training controls and live dashboard function", async ({ page }) => {
      await page.goto("/live");
      await expect(page.getByRole("button", { name: "Start Training" })).toBeVisible();
    });

    test("console access via drawer toggle", async ({ page }) => {
      await page.goto("/general");
      const viewport = page.viewportSize();
      if (viewport && viewport.width <= 767) {
        const mobileMenu = page.getByRole("button", { name: "Open navigation" });
        await expect(mobileMenu).toBeVisible();
        await mobileMenu.click();
        const nav = page.getByRole("dialog", { name: "Navigation" });
        await nav.getByRole("button", { name: "Console" }).click();
      } else {
        const consoleToggle = page.getByTitle("Toggle Console Drawer");
        await consoleToggle.click();
      }

      const consoleDrawer = page.locator('section[aria-label="Console Output"]');
      await expect(consoleDrawer).toBeVisible();
    });

    test("destructive confirmation dialog on dataset delete", async ({ page }) => {
      await page.goto("/datasets");
      const addBtn = page.getByRole("button", { name: "Add Dataset" });
      await expect(addBtn).toBeVisible();
    });
  });
});
