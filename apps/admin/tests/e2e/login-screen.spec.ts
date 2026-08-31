import { expect, test } from "@playwright/test";

// TEMPLATE SAMPLE — the login screen (rendering, a11y wiring, headers). The flow itself is in
// login-flow.spec.ts. Browsers are not preinstalled: `npx playwright install chromium`.

test.describe("admin login screen", () => {
  test("renders the form with programmatically associated labels", async ({ page }) => {
    await page.goto("/");

    // getByLabel only resolves with an intact <label for>/id pair, so this is also an a11y check.
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
    await expect(page.getByLabel("パスワード")).toBeVisible();
    await expect(page.getByRole("button", { name: "ログイン" })).toBeEnabled();
  });

  test("the password field does not expose its value", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByLabel("パスワード")).toHaveAttribute("type", "password");
  });

  test("submitting an empty form is blocked by the browser and stays on the page", async ({ page }) => {
    await page.goto("/");
    // Enabled == the island has hydrated (login-form.svelte gates the button on onMount).
    const submit = page.getByRole("button", { name: "ログイン" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByLabel("メールアドレス")).toBeFocused();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("security headers from the middleware are present", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("an unauthenticated request to a protected API is rejected", async ({ request }) => {
    // Asserts the API refuses on its own, independent of the UI: there is no auth middleware,
    // so this is per-route behavior (DEV-04 §2).
    const response = await request.get("/api/v1/auth/me");

    expect(response.status()).toBe(401);
  });
});
