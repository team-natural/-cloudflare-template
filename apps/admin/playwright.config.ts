import { defineConfig } from "@playwright/test";

// E2E is optional until the project grows (DEV-03 §3-1).
// Browsers are not preinstalled: `npx playwright install chromium`.
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: `http://localhost:${process.env.APP_PORT_DEV_ADMIN ?? "5174"}`,
  },
  webServer: {
    command: "pnpm dev",
    // Astro v7 auto-adds `--background` when it detects an AI coding agent, which detaches the
    // dev server and makes the foreground process exit — Playwright then reports
    // "Process from config.webServer exited early" and every test fails. Opting out keeps
    // `astro dev` in the foreground so Playwright can own its lifetime.
    // https://docs.astro.build/en/guides/build-with-ai/#background-mode
    env: { ASTRO_DEV_BACKGROUND: "0" },
    url: `http://localhost:${process.env.APP_PORT_DEV_ADMIN ?? "5174"}`,
    reuseExistingServer: !process.env.CI,
  },
});
