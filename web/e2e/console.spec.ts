import { test, expect } from "@playwright/test";

test.describe("Console Connection Flows", () => {
  test.describe.configure({ mode: "serial" });

  test("stdout and stderr lines appear, CR progress ends as single 20% row", async ({ page }) => {
    await page.goto("/console");

    const terminal = page.locator(".terminal-viewport");
    await expect(terminal).toBeVisible();

    const filterInput = page.getByPlaceholder("Filter console...");
    await filterInput.fill("stdout-line");
    await expect(page.locator(".console-row", { hasText: "stdout-line" })).toBeVisible();

    await filterInput.fill("stderr-line");
    await expect(page.locator(".console-row", { hasText: "stderr-line" })).toBeVisible();

    // Filter instead of clearing. The console viewport is virtualised and
    // follows the tail, so it renders only ~33 rows around the scroll position.
    // The four marker lines are written at server start, and by the time this
    // spec runs inside a full suite the backlog has grown past 5,000 lines of
    // request logging -- the markers are then nowhere in the DOM, and asserting
    // on them races the auto-scroll. Filtering to "0%" matches only the CR
    // progress output, which is what this test is actually about.
    await filterInput.fill("0%");
    await expect(page.locator(".console-row", { hasText: "20%" })).toBeVisible();
    await expect(page.locator(".console-row", { hasText: "10%" })).toHaveCount(0);
    // The CR sequence must have collapsed into exactly one row.
    await expect(page.locator(".console-row")).toHaveCount(1);
  });

  test("scrolling pauses follow mode, Jump to latest resumes it, filtering works", async ({ page }) => {
    await page.goto("/console");

    const filterInput = page.getByPlaceholder("Filter console...");
    await filterInput.fill("stdout");

    await expect(page.locator(".console-row", { hasText: "stdout-line" })).toBeVisible();
    await expect(page.locator(".console-row", { hasText: "stderr-line" })).not.toBeVisible();

    await filterInput.fill("");

    const viewport = page.locator(".terminal-viewport");
    await viewport.evaluate((el) => {
      Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll"));
    });

    const jumpBtn = page.getByRole("button", { name: "Latest" });
    await expect(jumpBtn).toBeVisible();

    await jumpBtn.click();
    await expect(jumpBtn).not.toBeVisible();
  });

  test("full page and drawer share console rows", async ({ page }) => {
    await page.goto("/general");

    const consoleToggle = page.getByTitle("Toggle Console Drawer");
    await consoleToggle.click();

    const drawer = page.locator('section[aria-label="Console Output"]');
    await expect(drawer).toBeVisible();

    const filterInput = drawer.getByPlaceholder("Filter console...");
    await filterInput.fill("stdout-line");
    await expect(drawer.locator(".console-row", { hasText: "stdout-line" })).toBeVisible();

    await page.goto("/console");
    const pageFilterInput = page.getByPlaceholder("Filter console...");
    await pageFilterInput.fill("stdout-line");
    await expect(page.locator(".console-row", { hasText: "stdout-line" })).toBeVisible();
  });

  test("socket interruption shows disconnected state and reconnect restores backlog without duplicates", async ({ page }) => {
    await page.addInitScript(() => {
      const OriginalWebSocket = window.WebSocket;
      (window as any).__sockets = [];

      const WrappedWebSocket = function (url: string | URL, protocols?: string | string[]) {
        const ws = new OriginalWebSocket(url, protocols);
        (window as any).__sockets.push(ws);
        return ws;
      };
      WrappedWebSocket.prototype = OriginalWebSocket.prototype;
      (window as any).WebSocket = WrappedWebSocket;
    });

    await page.goto("/console");

    const statusTag = page.locator(".status-tag");
    await expect(statusTag).toHaveText("connected");

    const filterInput = page.getByPlaceholder("Filter console...");

    await filterInput.fill("stdout-line");
    await expect(page.locator(".console-row", { hasText: "stdout-line" })).toBeVisible();
    await expect(page.locator(".console-row")).toHaveCount(1);

    await filterInput.fill("stderr-line");
    await expect(page.locator(".console-row", { hasText: "stderr-line" })).toBeVisible();
    await expect(page.locator(".console-row")).toHaveCount(1);

    await filterInput.fill("");

    await page.evaluate(() => {
      const sockets: WebSocket[] = (window as any).__sockets || [];
      for (const ws of sockets) {
        ws.close();
        if (typeof ws.onclose === "function") {
          ws.onclose(new CloseEvent("close"));
        }
      }
    });

    await expect(statusTag).toHaveText("disconnected");

    await expect(statusTag).toHaveText("connected", { timeout: 5000 });

    await filterInput.fill("stdout-line");
    await expect(page.locator(".console-row", { hasText: "stdout-line" })).toBeVisible();
    await expect(page.locator(".console-row")).toHaveCount(1);

    await filterInput.fill("stderr-line");
    await expect(page.locator(".console-row", { hasText: "stderr-line" })).toBeVisible();
    await expect(page.locator(".console-row")).toHaveCount(1);

    // Same reason as the first test: filter rather than clear, because the
    // virtualised viewport does not render the oldest rows once the backlog is
    // large. Exactly one match also proves the reconnect did not re-apply the
    // backlog on top of the rows already held.
    await filterInput.fill("0%");
    await expect(page.locator(".console-row", { hasText: "20%" })).toBeVisible();
    await expect(page.locator(".console-row")).toHaveCount(1);
  });
});
