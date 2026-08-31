import { expect, test } from "@playwright/test";

// TEMPLATE SAMPLE — patterns to copy, not a meaningful suite. DEV-03 §3-1 names the flows worth
// covering once the site is real (記事公開 / お問い合わせ送信 / 決済).
// Browsers are not preinstalled: `npx playwright install chromium`.

test.describe("public site smoke", () => {
  test("the top page renders with a single top-level heading", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/apps\/public/);
  });

  test("the Svelte island hydrates and responds to input", async ({ page }) => {
    await page.goto("/");

    // A broken client:* directive still renders server-side, so only an interaction catches it.
    const counter = page.getByRole("button", { name: /カウント/ });
    await counter.click();
    await expect(counter).toHaveText(/カウント: 1/);
  });

  test("security headers from the middleware are present", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};

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
    // Wait for hydration, or this races the errors it exists to catch.
    await expect(page.getByRole("button", { name: /カウント/ })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
