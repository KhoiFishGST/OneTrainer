import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:7801",
    trace: "on-first-retry",
    // The default theme is 'system' on both the client and the server, so the
    // browser's colour scheme -- not the app -- decides what a fresh profile
    // paints. Pinning it here makes the suite's "starts dark" assumption
    // explicit instead of leaving it to Playwright's default. Tests that care
    // about the light path override this with test.use().
    colorScheme: "dark",
  },
  webServer: {
    // Build first: e2e_server.py serves the static `build/` directory, so
    // without this the suite silently tests the previous build.
    command: "npm run build && python ../modules/webui/tests/e2e_server.py --root .e2e --port 7801",
    url: "http://127.0.0.1:7801/api/health",
    reuseExistingServer: false,
    timeout: 180000,
  },
  projects: [
    {
      name: "chromium-desktop",
      testMatch:
        /phase-a|phase-b|phase-c|console|theme|responsive-workflows|accessibility|paint-states|dialog-width|gallery-viewer|perf-budget|hover-states|motion|metrics-replay/,
      use: Object.assign({}, devices["Desktop Chrome"], {
        viewport: { width: 1280, height: 720 },
      }),
    },
    {
      name: "webkit-phone",
      testMatch: /mobile|mobile-layout|responsive-workflows|accessibility|touch-targets/,
      use: Object.assign({}, devices["iPhone 13"], {
        viewport: { width: 390, height: 844 },
      }),
    },
    {
      name: "chromium-phone",
      testMatch: /mobile|mobile-layout|responsive-workflows|accessibility|theme|touch-targets/,
      use: Object.assign({}, devices["iPhone 13"], {
        defaultBrowserType: "chromium",
        viewport: { width: 390, height: 844 },
      }),
    },
    {
      name: "firefox-smoke",
      testMatch: /firefox-smoke/,
      use: Object.assign({}, devices["Desktop Firefox"]),
    },
  ],
});
