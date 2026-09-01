import { expect, type Page } from "@playwright/test";

/**
 * Server-side observables for config save state.
 *
 * The UI no longer renders a positive "saved" affordance, so these helpers read
 * the persisted config straight from the API. That is a stronger check than a
 * badge: it proves the write actually reached the server, not just that a
 * component rendered.
 */

function readPath(doc: Record<string, any>, path: string): any {
  return path.split(".").reduce<any>((node, key) => (node == null ? node : node[key]), doc);
}

async function serverConfig(page: Page): Promise<Record<string, any>> {
  const res = await page.request.get("/api/config");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.config ?? {};
}

/** Current server value at `path` (dot-separated). */
export async function getServerValue(page: Page, path: string): Promise<any> {
  return readPath(await serverConfig(page), path);
}

/**
 * A `train_device` value that differs from whatever is on the server right now
 * (and from any values in `avoid`). The e2e server keeps one config for the whole
 * run, so a hard-coded value can already be persisted from an earlier test,
 * which would make a "was it saved?" assertion trivially true.
 */
export async function pickDifferentDevice(page: Page, ...avoid: string[]): Promise<string> {
  const current = await getServerValue(page, "train_device");
  for (let i = 0; i < 8; i++) {
    const candidate = `cuda:${i}`;
    if (candidate !== current && !avoid.includes(candidate)) return candidate;
  }
  throw new Error("no distinct train_device candidate available");
}

/**
 * The first candidate that differs from the server's current value at `path`.
 * Same rationale as `pickDifferentDevice`.
 */
export async function pickDifferentValue<T>(page: Page, path: string, candidates: T[]): Promise<T> {
  const current = await getServerValue(page, path);
  const choice = candidates.find((c) => c !== current);
  if (choice === undefined) throw new Error(`no distinct candidate for ${path}`);
  return choice;
}

/**
 * Autosave is debounced, so poll until the value lands on the server.
 * Replaces the old "saved badge is visible" assertion.
 */
export async function expectSaved(page: Page, path: string, value: unknown): Promise<void> {
  await expect
    .poll(() => getServerValue(page, path), { timeout: 10_000, intervals: [100, 200, 500] })
    .toEqual(value);
}

/**
 * Assert the draft was NOT persisted: the server value at `path` stays at
 * `unchanged` for the full debounce window plus margin.
 * Replaces the old "saved badge is not visible" assertion.
 */
export async function expectNotSaved(page: Page, path: string, unchanged: unknown): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    expect(await getServerValue(page, path)).toEqual(unchanged);
    await page.waitForTimeout(250);
  }
}

/** No save-error affordance is showing (the surviving `.state-badge` texts). */
export async function expectNoSaveProblem(page: Page): Promise<void> {
  await expect(page.getByText("Save Failed")).not.toBeVisible();
  await expect(page.getByText("Conflict")).not.toBeVisible();
}
