import { expect, test } from "@playwright/test";

// TEMPLATE SAMPLE — the login flow (DEV-06 §4-4); the screen itself is in login-screen.spec.ts.
// Opt-in: needs a seeded AdminUser, so it skips unless the env vars below are set.
//   pnpm db:generate && pnpm --filter admin db:migrate
//   pnpm --filter admin seed:admin -- --email=… --password=… --name=… --db=<database_name>
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… pnpm --filter admin test:e2e

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

// The island renders before its JS runs; login-form.svelte keeps the button disabled until
// onMount, so "enabled" is the hydration signal.
async function submitLogin(page: import("@playwright/test").Page, email: string, password: string) {
  const submit = page.getByRole("button", { name: "ログイン" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await submit.click();
}

test.describe("admin login flow", () => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for a seeded AdminUser to run these.");

  test("wrong credentials keep the user on the login screen with an error", async ({ page }) => {
    await page.goto("/");
    await submitLogin(page, EMAIL!, "definitely-not-the-password");

    await expect(page.getByRole("alert")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");

    // Must not reveal whether the address exists (DEV-02 §7).
    await expect(page.getByRole("alert")).not.toContainText(EMAIL!);
  });

  test("correct credentials land on the dashboard with an HttpOnly session cookie", async ({ page, context }) => {
    await page.goto("/");
    await submitLogin(page, EMAIL!, PASSWORD!);

    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
    await expect(page.getByText(EMAIL!)).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === "admin_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("the dashboard redirects to the login screen when unauthenticated", async ({ page }) => {
    // Server-side guard (pages/dashboard/index.astro), so this holds with JS disabled.
    await page.goto("/dashboard");

    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByLabel("パスワード")).toBeVisible();
  });

  test("logging out revokes the session so the dashboard is no longer reachable", async ({ page }) => {
    await page.goto("/");
    await submitLogin(page, EMAIL!, PASSWORD!);
    await page.waitForURL("**/dashboard");

    await page.getByRole("button", { name: "ログアウト" }).click();
    await page.waitForURL(/\/$/);

    // Logout deletes the admin_sessions row (DEV-02 §1-1) — a real revocation, not just a
    // cleared cookie.
    await page.goto("/dashboard");
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
