import { expect, test } from "@playwright/test";

// TEMPLATE SAMPLE — the login flow end to end (DEV-06 §4-4). Screen-level rendering and
// accessibility live in login-screen.spec.ts; this file is about behavior.
//
// REQUIRES A SEEDED ADMIN USER, so this suite is opt-in: it skips unless E2E_ADMIN_EMAIL and
// E2E_ADMIN_PASSWORD are set. Without that gate `pnpm test:e2e` would fail on a fresh clone,
// where no D1 database and no AdminUser exist yet. To enable it:
//   pnpm db:generate && pnpm --filter admin db:migrate
//   pnpm --filter admin seed:admin -- --email=… --password=… --name=… --db=<database_name>
//   E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… pnpm --filter admin test:e2e
// The credentials come from the environment so no password is committed.

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

// The login form is an Astro island: its markup is server-rendered, so the fields exist before
// the JS that handles submit does. The submit button stays disabled until the island mounts
// (login-form.svelte), which makes "enabled" the signal that it is safe to interact.
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

    // The message must not reveal whether the address exists (DEV-02 §7) — asserting the
    // absence of the address is what keeps a future "helpful" error message from leaking it.
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
    // The guard is server-side (pages/dashboard.astro), so this holds with JS disabled too.
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

    // Logout deletes the admin_sessions row (DEV-02 §1-1), so this is a real revocation check,
    // not just a cleared cookie — going back must not restore access.
    await page.goto("/dashboard");
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
