<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  // `/` is the login screen itself (DEV-06 §4-4), so success must land elsewhere or it loops.
  // A constant, not a `?next=` parameter — that would be an open redirect.
  const LANDING_ROUTE = "/dashboard";

  let email = $state("");
  let password = $state("");
  let submitting = $state(false);
  // The island renders before its JS runs, and a submit in that window is a native POST to `/`
  // that silently loses the input. Gate the button on onMount.
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
        // replace() so Back doesn't return to an already-authenticated login form.
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
        // Verbatim: the API withholds whether the address exists (DEV-02 §7).
        formError = body?.message ?? "ログインに失敗しました。時間をおいてやり直してください。";
      }
    } catch {
      formError = "サーバーに接続できませんでした。通信環境を確認してください。";
    } finally {
      // Unreached on success (navigating away) — re-enabling first would allow a double submit.
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
    <form onsubmit={handleSubmit}>
      <Field.FieldGroup>
        {#if formError}
          <p role="alert" class="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        {/if}

        <Field.Field data-invalid={fieldErrors.email ? true : undefined}>
          <Field.FieldLabel for="email">メールアドレス</Field.FieldLabel>
          <Input id="email" name="email" type="email" autocomplete="username" placeholder="admin@example.com" bind:value={email} required aria-invalid={fieldErrors.email ? "true" : undefined} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
          {#if fieldErrors.email}
            <Field.FieldError id="email-error">{fieldErrors.email.join(" ")}</Field.FieldError>
          {/if}
        </Field.Field>

        <Field.Field data-invalid={fieldErrors.password ? true : undefined}>
          <Field.FieldLabel for="password">パスワード</Field.FieldLabel>
          <Input id="password" name="password" type="password" autocomplete="current-password" bind:value={password} required aria-invalid={fieldErrors.password ? "true" : undefined} aria-describedby={fieldErrors.password ? "password-error" : undefined} />
          {#if fieldErrors.password}
            <Field.FieldError id="password-error">{fieldErrors.password.join(" ")}</Field.FieldError>
          {/if}
        </Field.Field>
      </Field.FieldGroup>

      <Card.Footer class="flex-col gap-2 px-0 pt-6">
        <Button type="submit" class="w-full" disabled={!hydrated || submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </Button>
      </Card.Footer>
    </form>
  </Card.Content>
</Card.Root>
