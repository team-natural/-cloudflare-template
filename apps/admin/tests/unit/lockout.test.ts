// Auth lockout (DEV-02 §7): KV-backed failure counters and lock windows.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { assertNotLockedOut, clearAuthFailures, recordAuthFailure } from "../../src/lib/server/auth/lockout";
import { RateLimitError } from "../../src/lib/server/http/errors";

const config = { maxAttempts: 3, lockoutMinutes: 15 };
const ip = "203.0.113.1";
const email = "admin@example.com";

async function resetKv() {
  const { keys } = await env.KV.list();
  await Promise.all(keys.map((key) => env.KV.delete(key.name)));
}

describe("auth lockout", () => {
  beforeEach(resetKv);

  it("allows attempts below the threshold", async () => {
    await recordAuthFailure(env.KV, ip, email, config);
    await recordAuthFailure(env.KV, ip, email, config);
    await expect(assertNotLockedOut(env.KV, ip, email)).resolves.toBeUndefined();
  });

  it("locks out after reaching the threshold", async () => {
    for (let i = 0; i < config.maxAttempts; i++) {
      await recordAuthFailure(env.KV, ip, email, config);
    }
    await expect(assertNotLockedOut(env.KV, ip, email)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("locks the account scope even from a different IP", async () => {
    for (let i = 0; i < config.maxAttempts; i++) {
      await recordAuthFailure(env.KV, ip, email, config);
    }
    await expect(assertNotLockedOut(env.KV, "198.51.100.9", email)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("clears counters on success", async () => {
    await recordAuthFailure(env.KV, ip, email, config);
    await recordAuthFailure(env.KV, ip, email, config);
    await clearAuthFailures(env.KV, ip, email);
    // After clearing, the previous failures no longer count toward the threshold
    await recordAuthFailure(env.KV, ip, email, config);
    await expect(assertNotLockedOut(env.KV, ip, email)).resolves.toBeUndefined();
  });
});
