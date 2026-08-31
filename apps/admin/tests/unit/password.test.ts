// Web Crypto test (runs in the workerd runtime via vitest-pool-workers, so crypto.subtle
// PBKDF2 behaves as in production — DEV-01 §2, DEV-02 §1-1). Security-relevant: password
// hashing is on the "must not ship a defect" list (DEV-03 §1).
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/server/auth/password";

describe("password hashing (Web Crypto PBKDF2)", () => {
  it("verifies a correct password against its stored hash", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("Tr0ub4dor&3", stored)).toBe(false);
  });

  it("produces a different salt each time (non-deterministic hashes)", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).not.toBe(b);
  });
});
