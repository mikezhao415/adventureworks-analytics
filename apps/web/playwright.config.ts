import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./e2e",
  metadata: {
    data_mode:
      process.env.AW_E2E_SAMPLE === "1"
        ? "real_adventureworks"
        : "offline_fixture",
  },
  outputDir: "test-results/playwright-artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [
    ["list"],
    ["json", { outputFile: path.resolve("test-results/playwright.json") }],
    [
      "html",
      { open: "never", outputFolder: path.resolve("playwright-report") },
    ],
  ],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    // Fixture runs use development mode; explicit sample runs exercise production.
    env: {
      AW_DASHBOARD_DATA:
        process.env.AW_E2E_SAMPLE === "1"
          ? "publication-override-must-not-load.json"
          : "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    command:
      process.env.AW_E2E_SAMPLE === "1"
        ? "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100"
        : "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1080 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
