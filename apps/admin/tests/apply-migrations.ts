// Setup file (vitest.config.ts): applies the DEV-07 D1 migrations to the isolated test
// database before each test file, so Service-layer tests hit a real, schema-correct D1.
import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

// TEST_MIGRATIONS is a test-only binding (vitest.config.ts), not part of Cloudflare.Env.
const testEnv = env as typeof env & { TEST_MIGRATIONS: D1Migration[] };

// migrations/ is a derived artifact the template does not ship, so on a fresh clone this is empty
// and the D1-backed tests fail with a bare `no such table: …`. Warn rather than throw, so the
// tests that need no database still run.
if (!testEnv.TEST_MIGRATIONS?.length) {
  console.warn("[tests] No D1 migrations found — packages/schema/migrations/ has not been generated yet.\n" + "        Run `pnpm db:generate` from the repo root; until then every D1-backed test fails.");
} else {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
}
