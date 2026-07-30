import { test, expect } from "@playwright/test";
import {
  expectNoSaveProblem,
  expectNotSaved,
  expectSaved,
  getServerValue,
  pickDifferentDevice,
} from "./helpers/config-state";

test.describe("Phase A Desktop Flows", () => {
  test("root redirects to Live and loads shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/live$/);
    await expect(page.getByText("OneTrainer").first()).toBeVisible();
    await expect(page.locator(".rail")).toBeVisible();
  });

  test("compact rail expands, persists after reload, and future links remain disabled", async ({ page }) => {
    await page.goto("/general");
    const railToggle = page.getByRole("button", { name: "Expand navigation" });
    await railToggle.click();
    await expect(page.locator(".rail")).toHaveClass(/expanded/);

    await page.reload();
    await expect(page.locator(".rail")).toHaveClass(/expanded/);

    const disabledLink = page.getByRole("link", { name: "Tools" });
    await expect(disabledLink).toBeVisible();
    await expect(disabledLink).toHaveAttribute("aria-disabled", "true");
  });

  test("valid workspace edit reaches Saved and survives reload", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("tab", { name: "Hardware" }).click();
    const trainDeviceInput = page.locator("#field-train-device");
    const device = await pickDifferentDevice(page);
    await trainDeviceInput.fill(device);
    await expectSaved(page, "train_device", device);
    await expectNoSaveProblem(page);

    await page.reload();
    await page.getByRole("tab", { name: "Hardware" }).click();
    await expect(trainDeviceInput).toHaveValue(device);
  });

  test("invalid numeric text remains visible and Unsaved", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("tab", { name: "Hardware" }).click();
    const numberInput = page.locator("#field-dataloader-threads");
    const threadsBefore = await getServerValue(page, "dataloader_threads");
    await numberInput.fill("invalid-num");
    await expect(numberInput).toHaveValue("invalid-num");
    // Unsaved: the invalid draft must never reach the server.
    await expectNotSaved(page, "dataloader_threads", threadsBefore);
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

    const threadsBefore = await getServerValue(pageB, "dataloader_threads");
    const deviceA1 = await pickDifferentDevice(pageA);
    const deviceA2 = await pickDifferentDevice(pageA, deviceA1);

    // Page B makes local dirty edit (invalid text prevents autosave from firing automatically)
    await numInputB.fill("invalid-num");
    await expectNotSaved(pageB, "dataloader_threads", threadsBefore);

    // Page A saves a valid edit, advancing server revision
    await inputA.fill(deviceA1);
    await expectSaved(pageA, "train_device", deviceA1);

    // Page B receives remote change while dirty and enters Conflict state
    await expect(pageB.getByText("Conflict")).toBeVisible();

    // Reload syncs pageB to server state: conflict clears and B shows A's value
    await pageB.getByRole("button", { name: "Reload" }).click();
    await expectNoSaveProblem(pageB);
    await expect(inputB).toHaveValue(deviceA1);

    // Cause a second conflict
    await numInputB.fill("invalid-num-2");
    await expectNotSaved(pageB, "dataloader_threads", threadsBefore);

    await inputA.fill(deviceA2);
    await expectSaved(pageA, "train_device", deviceA2);

    await expect(pageB.getByText("Conflict")).toBeVisible();

    // Context B fixes invalid input and explicitly overwrites
    await numInputB.fill("2");
    await pageB.getByRole("button", { name: "Overwrite" }).click();
    // Overwrite pushes B's whole draft, so B's stale train_device (deviceA1)
    // deliberately replaces A's newer deviceA2 on the server.
    await expectSaved(pageB, "train_device", deviceA1);
    await expectNoSaveProblem(pageB);

    await contextA.close();
    await contextB.close();
  });

  test("pending autosave flushes before named-preset save", async ({ page }) => {
    await page.goto("/general");
    await page.getByRole("tab", { name: "Hardware" }).click();
    const deviceInput = page.locator("#field-train-device");
    const device = await pickDifferentDevice(page);
    await deviceInput.fill(device);

    await page.locator(".header-left").getByRole("button", { name: "Save" }).click();
    const presetName = `E2E Test Preset ${Date.now()}`;
    await page.getByLabel("Preset Name").fill(presetName);
    await page.getByRole("dialog", { name: "Save Configuration" }).getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog", { name: "Save Configuration" })).not.toBeVisible();
    // The pending autosave must have been flushed by the preset save.
    await expectSaved(page, "train_device", device);
    await expectNoSaveProblem(page);
  });

  test("deep-linking and browser navigation between tabs", async ({ page }) => {
    await page.goto("/general");
    await expect(page.getByRole("heading", { level: 1, name: "General" })).toBeVisible();

    await page.goto("/datasets");
    await expect(page.getByRole("heading", { level: 1, name: "Datasets" })).toBeVisible();

    await page.goto("/backup");
    await expect(page.getByRole("heading", { level: 1, name: "Backup" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/.*\/datasets$/);
    await expect(page.getByRole("heading", { level: 1, name: "Datasets" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/.*\/general$/);
    await expect(page.getByRole("heading", { level: 1, name: "General" })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/.*\/datasets$/);
  });
});
