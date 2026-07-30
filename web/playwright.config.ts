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
      testMatch: /phase-a|phase-b|phase-c|console|theme|responsive-workflows|accessibility|paint-states|dialog-width|gallery-viewer|perf-budget|hover-states/,
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
