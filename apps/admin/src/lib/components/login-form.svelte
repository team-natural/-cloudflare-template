<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";

  let email = $state("");
  let password = $state("");
  let submitting = $state(false);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    // TODO: wire up to POST /api/v1/auth/login (DEV-06 §4-4). UI only for now.
    submitting = true;
  }
</script>

<Card.Root class="w-full max-w-sm">
  <Card.Header>
    <Card.Title>管理画面ログイン</Card.Title>
    <Card.Description>メールアドレスとパスワードを入力してください</Card.Description>
  </Card.Header>
  <Card.Content>
    <form onsubmit={handleSubmit}>
      <div class="flex flex-col gap-6">
        <div class="grid gap-2">
          <Label for="email">メールアドレス</Label>
          <Input id="email" type="email" placeholder="admin@example.com" bind:value={email} required />
        </div>
        <div class="grid gap-2">
          <Label for="password">パスワード</Label>
          <Input id="password" type="password" bind:value={password} required />
        </div>
      </div>
      <Card.Footer class="flex-col gap-2 px-0 pt-6">
        <Button type="submit" class="w-full" disabled={submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </Button>
      </Card.Footer>
    </form>
  </Card.Content>
</Card.Root>
