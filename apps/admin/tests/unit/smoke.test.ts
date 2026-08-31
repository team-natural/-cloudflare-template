import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Toolchain smoke tests: verify the Workers runtime and binding emulation.
describe("toolchain smoke", () => {
  it("runs inside the Workers runtime", () => {
    expect(typeof caches).toBe("object");
  });

  it("exposes the D1 binding (DB)", () => {
    expect(env.DB).toBeDefined();
  });
});
