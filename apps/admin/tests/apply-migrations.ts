// Setup file (vitest.config.ts): applies the DEV-07 D1 migrations to the isolated test
// database before each test file, so Service-layer tests hit a real, schema-correct D1.
import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

// TEST_MIGRATIONS is a test-only binding (vitest.config.ts), not part of Cloudflare.Env.
const testEnv = env as typeof env & { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
