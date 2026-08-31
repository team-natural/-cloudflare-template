import { existsSync } from "node:fs";
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run in the Workers runtime (DEV-01 §1, DEV-03 §3). Bindings are declared inline rather
// than via `wrangler.configPath`, because wrangler.jsonc's `main` points at the Astro adapter
// entrypoint, which unit tests do not need to build. Keep the binding names in sync with
// apps/admin/wrangler.jsonc.
// migrations/ may not exist yet; tests/apply-migrations.ts handles the empty case.
const migrationsPath = path.join(import.meta.dirname, "../../packages/schema/migrations");

export default defineConfig(async () => {
  const migrations = existsSync(migrationsPath) ? await readD1Migrations(migrationsPath) : [];

  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: "2026-08-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          r2Buckets: ["BUCKET"],
          kvNamespaces: ["KV"],
          bindings: {
            TEST_MIGRATIONS: migrations,
            SESSION_TTL_DAYS: "30",
            AUTH_LOCKOUT_MAX_ATTEMPTS: "5",
            AUTH_LOCKOUT_MINUTES: "15",
          },
        },
      }),
    ],
    test: {
      include: ["tests/unit/**/*.test.ts"],
      setupFiles: ["./tests/apply-migrations.ts"],
    },
  };
});
