import { expect, test } from "@playwright/test";

// TEMPLATE SAMPLE — the patterns a project copies, not a meaningful test suite.
// DEV-03 §3-1 makes E2E optional and names the flows worth covering once the site is real
// (記事公開 / お問い合わせ送信 / 決済). Replace the placeholder-page assertions below with those
// flows; keep the header and console checks, which stay valid for every page.
//
// Browsers are not preinstalled in the container: `npx playwright install chromium` once.
// `pnpm test:e2e` starts the dev server itself (see playwright.config.ts).

test.describe("public site smoke", () => {
  test("the top page renders with a single top-level heading", async ({ page }) => {
    await page.goto("/");

    // Locate by role, not by CSS class — class names churn as the design evolves, accessible
    // roles do not, and a role locator fails loudly when the markup stops being accessible.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/apps\/public/);
  });

  test("the Svelte island hydrates and responds to input", async ({ page }) => {
    await page.goto("/");

    // Islands are the one part of an Astro page that can silently fail to hydrate — the markup
    // renders server-side, so a broken `client:*` directive looks fine until you click. Asserting
    // an interaction (not just visibility) is what catches that.
    const counter = page.getByRole("button", { name: /カウント/ });
    await expect(counter).toBeVisible();
    await counter.click();
    await expect(counter).toHaveText(/カウント: 1/);
  });

  test("security headers from the middleware are present", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};

    // Guards apps/public/src/middleware.ts. A project that adds CSP in astro.config.mjs
    // (DEV-02) should assert it here too.
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    // Islands hydrate after load; without this the check races the hydration it exists to cover.
    await expect(page.getByRole("button", { name: /カウント/ })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
