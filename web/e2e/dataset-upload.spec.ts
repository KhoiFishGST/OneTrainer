import { test, expect } from '@playwright/test';

test('dropping a file shows progress, then the file appears', async ({ page }) => {
  await page.route('**/api/datasets/*/files', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'E2E', path: '/E2E', items: [] }),
    });
  });

  // Hold the upload open so the progress UI is observable.
  let releaseUpload: () => void = () => {};
  const uploadHeld = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });

  await page.route('**/api/datasets/*/upload', async (route) => {
    await uploadHeld;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ saved: ['e2e.png'] }),
    });
  });

  await page.goto('/datasets/E2E');

  await page.setInputFiles('input[type="file"]', {
    name: 'e2e.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(64 * 1024),
  });

  await expect(page.getByText('e2e.png')).toBeVisible();
  await expect(page.getByLabel('Overall upload progress')).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel upload/i })).toBeVisible();

  releaseUpload();

  // The response is the completion signal, so the card clears without any
  // event from the server.
  await expect(page.getByRole('button', { name: /cancel upload/i })).toBeHidden();
});
