import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "lineage-fixture.spec.ts",
  metadata: { data_mode: "fictional_lineage_packaging_test" },
  webServer: {
    ...base.webServer,
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
  },
});
