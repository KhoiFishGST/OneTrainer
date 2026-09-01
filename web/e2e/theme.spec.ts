import { test, expect } from "@playwright/test";

test.describe("Theme Switching and Persistence", () => {
  test("follows the OS preference by default, which this project pins to dark", async ({
    page,
  }) => {
    await page.goto("/general");
    await expect(page.locator("html")).toHaveClass(/dark/);

    const toggleBtn = page.getByRole("button", { name: /switch to light theme/i });
    await expect(toggleBtn).toBeVisible();
  });

  test("toggles to light theme and updates localStorage webui.theme", async ({ page }) => {
    await page.goto("/general");
    await expect(page.locator("html")).toHaveClass(/dark/);

    const toggleBtn = page.getByRole("button", { name: /switch to light theme/i });
    await toggleBtn.click();

    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const darkToggleBtn = page.getByRole("button", { name: /switch to dark theme/i });
    await expect(darkToggleBtn).toBeVisible();

    const storedTheme = await page.evaluate(() => localStorage.getItem("webui.theme"));
    expect(storedTheme).toBe("light");
  });

  test("persists theme preference across page reload", async ({ page }) => {
    await page.goto("/general");

    // Toggle to light theme
    await page.getByRole("button", { name: /switch to light theme/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Reload page and confirm light theme persists
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    let storedTheme = await page.evaluate(() => localStorage.getItem("webui.theme"));
    expect(storedTheme).toBe("light");

    // Toggle back to dark theme
    await page.getByRole("button", { name: /switch to dark theme/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Reload page and confirm dark theme persists
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    storedTheme = await page.evaluate(() => localStorage.getItem("webui.theme"));
    expect(storedTheme).toBe("dark");
  });
});

test.describe("First load on a light-preference machine", () => {
  test.use({ colorScheme: "light" });

  test("paints light and stays light, with no flash through dark", async ({ page }) => {
    // The client's fallback and the server's default are both 'system', so
    // nothing paints dark first and then corrects itself once the appearance
    // query resolves.
    await page.goto("/general");
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Let the appearance query resolve and reconcile, then confirm nothing
    // moved: a divergent default would show up here as a flip to dark.
    await expect(page.getByRole("button", { name: /switch to dark theme/i })).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
