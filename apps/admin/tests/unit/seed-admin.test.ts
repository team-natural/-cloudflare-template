// Parity guard: the seed script's standalone hash/ULID must stay compatible with the
// app's implementations (src/lib/server/auth/password.ts, @app/schema's ulid).
import { describe, expect, it } from "vitest";
import { verifyPassword } from "../../src/lib/server/auth/password";
import { hashPassword as seedHashPassword, ulid as seedUlid } from "../../scripts/seed-admin.mjs";

describe("seed-admin parity", () => {
  it("produces hashes the app's verifyPassword accepts", async () => {
    const hash = await seedHashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("produces valid 26-char Crockford base32 ULIDs", () => {
    const id = seedUlid();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
