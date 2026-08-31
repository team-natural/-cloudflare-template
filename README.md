# Development Environment

A generic Dev Container-based project template. Node.js and Claude Code come
pre-configured, so you can use this as the starting point for a new project.

## Prerequisites

- Docker (e.g. Docker Desktop)
- VS Code + the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
  or GitHub Codespaces

## Getting started from this template

This is the bootstrap checklist referenced by `docs/3-development/08-deployment.md` (DEV-08) §2.
Steps 1–3 are needed before the container is useful, steps 4–10 before the project can deploy,
and step 11 is where the project itself starts.

### 1. Container identity and ports — `.devcontainer/`

1. **Update the values in `.devcontainer/.env`**
   - `COMPOSE_PROJECT_NAME`: change to a name unique to the project (docker compose uses it to
     prefix container, volume, and network names, keeping each project's containers and its
     Claude Code config volume isolated from other projects)
   - `APP_PORT_DEV_PUBLIC` / `APP_PORT_DEV_ADMIN`: change so they don't collide with other
     projects' ports (used for both the container-side and host-side port)
2. Update `name` in `.devcontainer/devcontainer.json` to match the project name, if needed
   - If the ports were changed from the defaults `5173`/`5174`, also update the port keys under
     `portsAttributes` in `.devcontainer/devcontainer.json` to match
3. Add any required OS packages to `.devcontainer/Dockerfile`

### 2. Project identity — package names and Worker names

4. Set the project name in `package.json` (`"name": "app"` is a placeholder). All four
   `package.json` files are `"private": true` / `"license": "UNLICENSED"` — keep it that way
   unless the project is actually being published.
5. **Rename the Workers in `apps/admin/wrangler.jsonc` and `apps/public/wrangler.jsonc`.** They
   ship as `"name": "admin"` and `"name": "public"`, and **a Worker name is unique across the
   whole Cloudflare account** — leave them and the second project created from this template
   deploys over the first one's Workers. Use a project prefix: `<project>-admin` /
   `<project>-public`.

### 3. Cloudflare resources — one D1, one R2, one KV per project

6. **Create each resource once, then copy the ids into both apps.** Both `wrangler.jsonc` files
   ship `replace-with-*` placeholders, and each id appears in **three** scopes per file —
   top-level, `env.staging`, and `env.production`. Missing one fails at deploy time, not now.

   ```bash
   cd apps/admin
   pnpm exec wrangler d1 create <project>-db          # → database_id
   pnpm exec wrangler r2 bucket create <project>-media
   pnpm exec wrangler kv namespace create <project>-kv  # → id (admin only; apps/public has no KV)
   ```

   Paste `database_id` / `bucket_name` into **both** files (`apps/public` shares the same
   database and bucket — see CLAUDE.md's binding table); the KV namespace is admin-only. Repeat
   for staging/production with separate resources per environment.

7. **Add the custom domains.** Neither `wrangler.jsonc` declares `routes` or `custom_domain`, so
   as shipped a deploy is only reachable at its `*.workers.dev` URL. Add the real hostnames per
   environment (the admin is expected to live on its own subdomain — `apps/admin` is the whole
   console, not an `/admin` path):

   ```jsonc
   // in each env.* block
   "routes": [{ "pattern": "admin.example.com", "custom_domain": true }],
   "workers_dev": false,
   ```

   `workers_dev: false` matters most for `apps/admin`: without it the console stays reachable at
   its `*.workers.dev` URL as well as the real domain, which is a second, unmonitored front door
   to the login page.

### 4. Secrets, schema, and first admin user

8. **Secrets**: copy `apps/admin/.dev.vars.example` to `apps/admin/.dev.vars` and fill it in
   (it documents which keys are required vs. adoption-gated, and how to generate
   `SESSION_SIGNING_KEY`). For staging/production these are Workers Secrets, not `vars`:
   `pnpm --filter admin exec wrangler secret put SESSION_SIGNING_KEY --env production`.
9. **Schema → migration → seed.** Fill in `packages/schema` with the project's real Drizzle
   tables (see `docs/3-development/07-database-schema.md`), then:

   ```bash
   pnpm db:generate                  # first run creates packages/schema/migrations/ — commit it
   pnpm --filter admin db:migrate    # local D1; --remote / --env for deployed environments
   pnpm --filter admin seed:admin -- --email=you@example.com --password='…' --name='Admin'
   ```

   `migrations/` is deliberately absent from the template so the first `db:generate` produces a
   clean baseline — see CLAUDE.md's "D1 / R2 / KV binding rules".

### 5. Repository setup

10. **Create the `main` branch.** `dev` is this template's default (integration) branch;
    `main` is production and does not exist yet because the template itself is never deployed.
    `.github/workflows/ci.yml` and Cloudflare Workers Builds both key off `dev` (staging) and
    `main` (production) — DEV-08 §2/§3. Branch `main` from `dev` and protect both.

### 6. Then build the project

11. Replace the `apps/public`/`apps/admin` scaffold pages with the real site/CMS. The workflow
    for this — docs → bulk scaffold → admin UI → public UI → features → tests — is
    `docs/00_DEV_GUIDE.md` §3; start there rather than editing pages ad hoc.

> Running the E2E samples needs browsers, which are not preinstalled:
> `pnpm --filter admin exec playwright install chromium` (same for `public`). `pnpm test`
> (Vitest) needs no extra setup.

## Starting the container

### VS Code

1. Open the repository in VS Code
2. Run `Dev Containers: Reopen in Container` from the command palette
3. On first startup, `.devcontainer/setup.sh` (`pnpm install`, across all workspace packages)
   runs automatically

### CLI

```bash
docker compose -f .devcontainer/docker-compose.yml up -d
```

Once started, the container listens on `APP_PORT_DEV_PUBLIC` / `APP_PORT_DEV_ADMIN` (defaults
`5173` / `5174`) and those same ports are published on the host, bound to `127.0.0.1` (handled by
docker compose; change them per project to avoid collisions).

## Using Claude Code

This template's Dev Container includes the `claude-code` Dev Container Feature, so the `claude`
command is available right away inside the container. Claude Code's auth/settings are stored in a
named Docker volume (`claude-config`), not shared with the host, so each project container has its
own independent login. Run this in a terminal inside the container and log in the first time:

```bash
claude
```
