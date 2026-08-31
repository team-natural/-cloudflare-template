import { defineConfig } from "@playwright/test";

// E2E is optional until the project grows (DEV-03 §3-1).
// Browsers are not preinstalled: `npx playwright install chromium`.
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: `http://localhost:${process.env.APP_PORT_DEV_PUBLIC ?? "5173"}`,
  },
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${process.env.APP_PORT_DEV_PUBLIC ?? "5173"}`,
    reuseExistingServer: !process.env.CI,
  },
});
