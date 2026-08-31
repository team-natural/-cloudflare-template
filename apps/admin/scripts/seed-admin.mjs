// Seeds the first AdminUser into D1 (local by default) so the admin console is usable
// on day one. Runs on plain Node — the hash/ULID logic mirrors src/lib/server/auth/
// password.ts and @app/schema's ulid (parity is enforced by tests/unit/seed-admin.test.ts).
//
// Usage:
//   pnpm seed:admin -- --email=admin@example.com --password='...' --name='Admin'
//   [--role=admin|editor] [--db=replace-with-db-name] [--remote] [--env=staging|production]
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, keyMaterial, KEY_LENGTH_BITS);
  const b64 = (bytes) => Buffer.from(bytes).toString("base64url");
  return `${b64(salt)}.${b64(new Uint8Array(hash))}`;
}

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid() {
  let remaining = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = ENCODING[remaining % 32] + time;
    remaining = Math.floor(remaining / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let random = "";
  for (const byte of bytes) random += ENCODING[byte % 32];
  return time + random;
}

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = arg.match(/^--([a-z]+)(?:=(.*))?$/);
    if (match) args[match[1]] = match[2] ?? true;
  }
  return args;
}

// `--password S3cret!` (space instead of `=`) leaves the value behind and stores `true` here.
// Truthy, so the usage guard passes, and TextEncoder stringifies it — silently seeding an
// admin whose password is the literal "true". Require the `--flag=value` form for the fields
// that carry a value; valueless flags like --remote stay boolean.
function requireValue(args, key) {
  const value = args[key];
  if (typeof value !== "string" || value === "") {
    console.error(`--${key} needs a value in --${key}=<value> form (a space-separated value is not picked up).`);
    process.exit(1);
  }
  return value;
}

const sqlQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const role = args.role ?? "admin";

  if (!args.email || !args.password || !args.name || !["admin", "editor"].includes(role)) {
    console.error("Usage: pnpm seed:admin -- --email=<email> --password=<password> --name=<name> [--role=admin|editor] [--db=<database_name>] [--remote] [--env=<wrangler env>]");
    process.exit(1);
  }

  const email = requireValue(args, "email");
  const password = requireValue(args, "password");
  const name = requireValue(args, "name");

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const sql = `INSERT INTO admin_users (public_id, name, email, password_hash, role, status, created_at, updated_at) ` + `VALUES (${sqlQuote(ulid())}, ${sqlQuote(name)}, ${sqlQuote(email)}, ${sqlQuote(passwordHash)}, ${sqlQuote(role)}, 'active', ${sqlQuote(now)}, ${sqlQuote(now)});`;

  // No default: the template's wrangler.jsonc still carries `replace-with-db-name`, so
  // defaulting to it would run `wrangler d1 execute` against a database that does not exist
  // and fail with a confusing wrangler error instead of a clear one here.
  const db = typeof args.db === "string" && args.db !== "" && !args.db.startsWith("replace-with-") ? args.db : null;
  if (!db) {
    console.error("--db=<database_name> is required. Use the database_name from apps/admin/wrangler.jsonc (replace the replace-with-* placeholder first).");
    process.exit(1);
  }
  const wranglerArgs = ["wrangler", "d1", "execute", db, args.remote ? "--remote" : "--local", "--command", sql];
  if (args.env) wranglerArgs.splice(4, 0, "--env", args.env);

  const result = spawnSync("npx", wranglerArgs, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`Seeded ${role} user ${email} into ${db} (${args.remote ? "remote" : "local"}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
