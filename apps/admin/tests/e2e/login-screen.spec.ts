import { expect, test } from "@playwright/test";

// TEMPLATE SAMPLE — the patterns a project copies, not a meaningful test suite.
//
// Scope note: this covers the login SCREEN (ADM-00 rendering, accessibility wiring, headers),
// deliberately not the login FLOW. The form is UI-only right now — `handleSubmit` in
// apps/admin/src/lib/components/login-form.svelte still has a TODO instead of a call to
// POST /api/v1/auth/login (DEV-06 §4-4). When that wiring lands, add the flow cases here:
// wrong password shows an error and does not navigate, correct password lands on the
// post-login screen, the session cookie is HttpOnly, and a locked-out account is refused
// (DEV-02 — the lockout counter lives in KV).
//
// Browsers are not preinstalled in the container: `npx playwright install chromium` once.

test.describe("admin login screen", () => {
  test("renders the form with programmatically associated labels", async ({ page }) => {
    await page.goto("/");

    // getByLabel only resolves when the <label for>/id pair is intact, so these three lines
    // double as an accessibility assertion — the reason to prefer them over CSS selectors.
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
    await page.getByRole("button", { name: "ログイン" }).click();

    // `required` keeps the submit from firing; the assertion is that nothing navigated.
    // Client-side validation is a convenience only — the server validates independently
    // (apps/admin/src/lib/server/validation/auth.ts), which is what actually protects the API.
    await expect(page.getByLabel("メールアドレス")).toBeFocused();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("security headers from the middleware are present", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};

    // Guards apps/admin/src/middleware.ts. If the project adds `X-Robots-Tag: noindex` to keep
    // the admin out of search engines (PRD-02 §5), assert it here so it cannot be dropped.
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("an unauthenticated request to a protected API is rejected", async ({ request }) => {
    // Worth keeping even after the UI flow exists: it asserts the API refuses on its own,
    // independent of whatever the UI does. Pages/routes each check the session at the top of
    // their handler — there is no auth middleware (DEV-04 §2), so this is per-route behavior.
    const response = await request.get("/api/v1/auth/me");

    expect(response.status()).toBe(401);
  });
});
