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
    command: "python ../tests/webui/e2e_server.py --root .e2e --port 7801",
    url: "http://127.0.0.1:7801/api/health",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium-desktop",
      testMatch: /phase-a|phase-b|phase-c|console|theme|responsive-workflows|accessibility|visual|paint-states|dialog-width|gallery-viewer|perf-budget/,
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
      testMatch: /mobile|mobile-layout|responsive-workflows|accessibility|theme|visual|touch-targets/,
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
