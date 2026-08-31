<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";

  // Where a successful login lands. `/` is the login screen itself (DEV-06 §4-4 — there is no
  // separate /login route), so this must be a different route or the redirect loops straight
  // back here. ADM-01 in PRD-04 §3-2 puts the admin landing at /dashboard. A fixed constant,
  // not a `?next=` parameter: a redirect target taken from the URL is an open redirect.
  const LANDING_ROUTE = "/dashboard";

  let email = $state("");
  let password = $state("");
  let submitting = $state(false);
  // The island is server-rendered, so the form exists in the DOM before its JS runs. Submitting
  // in that window does a native POST to `/`, which has no POST handler — the input is silently
  // lost. onMount fires only after hydration, so gating the submit button on it closes the gap.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  // Per-field errors from the API's 422 envelope, rendered inline (DEV-06 §4-4).
  let fieldErrors = $state<Record<string, string[] | undefined>>({});
  // Everything else (401 bad credentials, 429 lockout, 5xx) — a form-level message.
  let formError = $state("");

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting) return;

    submitting = true;
    fieldErrors = {};
    formError = "";

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // The session cookie is set by the API (HttpOnly — deliberately unreadable from here).
        // Use replace() so Back doesn't return to a login form that is already authenticated.
        window.location.replace(LANDING_ROUTE);
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        errors?: Record<string, string[] | undefined>;
      } | null;

      if (response.status === 422 && body?.errors) {
        fieldErrors = body.errors;
      } else {
        // The API deliberately does not say whether the address exists (DEV-02 §7) — show its
        // message as-is rather than adding detail the server withheld on purpose.
        formError = body?.message ?? "ログインに失敗しました。時間をおいてやり直してください。";
      }
    } catch {
      formError = "サーバーに接続できませんでした。通信環境を確認してください。";
    } finally {
      // Not reset on success: the page is navigating away, and re-enabling the button first
      // would let a double-click fire a second login request.
      submitting = false;
    }
  }
</script>

<Card.Root class="w-full max-w-sm">
  <Card.Header>
    <Card.Title>管理画面ログイン</Card.Title>
    <Card.Description>メールアドレスとパスワードを入力してください</Card.Description>
  </Card.Header>
  <Card.Content>
    <!-- Browser validation (`required` below) stays on as the cheap first pass; the inline
         errors here render what the server rejected, which is the check that actually
         matters (lib/server/validation/auth.ts). -->
    <form onsubmit={handleSubmit}>
      <div class="flex flex-col gap-6">
        {#if formError}
          <!-- role="alert" so screen readers announce it without moving focus (DEV-06 §4-4). -->
          <p role="alert" class="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        {/if}

        <div class="grid gap-2">
          <Label for="email">メールアドレス</Label>
          <Input id="email" name="email" type="email" autocomplete="username" placeholder="admin@example.com" bind:value={email} required aria-invalid={fieldErrors.email ? "true" : undefined} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
          {#if fieldErrors.email}
            <p id="email-error" class="text-sm text-destructive">{fieldErrors.email.join(" ")}</p>
          {/if}
        </div>

        <div class="grid gap-2">
          <Label for="password">パスワード</Label>
          <Input id="password" name="password" type="password" autocomplete="current-password" bind:value={password} required aria-invalid={fieldErrors.password ? "true" : undefined} aria-describedby={fieldErrors.password ? "password-error" : undefined} />
          {#if fieldErrors.password}
            <p id="password-error" class="text-sm text-destructive">{fieldErrors.password.join(" ")}</p>
          {/if}
        </div>
      </div>

      <Card.Footer class="flex-col gap-2 px-0 pt-6">
        <Button type="submit" class="w-full" disabled={!hydrated || submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </Button>
      </Card.Footer>
    </form>
  </Card.Content>
</Card.Root>
