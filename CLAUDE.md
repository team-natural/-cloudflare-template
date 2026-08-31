# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About this template

This repository is not a specific project — it's the **standard template** the team/organization
uses as the starting point when spinning up a new project. Individual projects are created by
copying/forking this repository.

## Bootstrapping a new project from this template

When this repo is being adapted into a real project (as opposed to being edited as the template
itself), update these first:

1. `.devcontainer/.env`: set `COMPOSE_PROJECT_NAME` to a name unique to the project (docker compose
   uses it to prefix container, volume, and network names — this also keeps each project's
   `claude-config` volume, see below, from colliding with other projects) and change
   `APP_PORT_DEV_PUBLIC` / `APP_PORT_DEV_ADMIN` so they don't collide with other projects' ports.
2. `name` in `.devcontainer/devcontainer.json`, if it should match the project name.
3. `.devcontainer/Dockerfile`: add any OS packages the project needs.
4. `apps/public` and `apps/admin`: replace the scaffold pages with the real site/CMS (see
   "Monorepo layout" below). `packages/schema`: fill in the real Drizzle tables per
   `docs/3-development/07-database-schema.md`.

## Starting the container

- VS Code: run `Dev Containers: Reopen in Container` from the command palette
- CLI: `docker compose -f .devcontainer/docker-compose.yml up -d`

On first startup, `.devcontainer/setup.sh` runs automatically as the `postCreateCommand`: it enables
Corepack, runs `pnpm install` (installing all workspace packages under `apps/*`/`packages/*`), and
installs the `context-mode` MCP server globally (inside the container).

## Container architecture

- `docker-compose.yml` mounts only this repository into the container at `/workspace`
  (`workspaceFolder` in `devcontainer.json` matches). Sibling projects on the host are deliberately
  NOT visible from inside the container — each project gets its own isolated container. The
  container itself just `sleep infinity`s; devcontainer tooling execs into it.
- `devcontainer.json` adds two Dev Container Features: Node.js (`24`) and `claude-code`, so
  `node`/`npm` and the `claude` CLI are available with no manual setup and nothing is installed on
  the host. `pnpm` (this repo's package manager — see "Monorepo layout" below) is enabled via
  Corepack in `setup.sh`, not a separate Feature.
- Claude Code auth/settings persist in a named Docker volume (`claude-config`, mounted at
  `/home/vscode/.claude`) rather than being bind-mounted from the host, so each project container
  has its own independent login and does not read or write `~/.claude` on the host. `CLAUDE_CONFIG_DIR`
  is set to `/home/vscode/.claude` so Claude Code picks up that location. The volume is root-owned
  the first time it's created, so `setup.sh` runs `sudo chown -R vscode:vscode /home/vscode/.claude`
  on every `postCreateCommand` run to keep it writable. Because the login lives in the volume (not
  the repo or the host), run `claude` once inside each new project's container and log in there.
- `Dockerfile` is based on `mcr.microsoft.com/devcontainers/base:bookworm` and additionally
  installs `uv` (required by the Semble MCP server, which runs via `uvx`).

## Port configuration

Both sides of the port mapping in `docker-compose.yml` use `APP_PORT_DEV_PUBLIC` and
`APP_PORT_DEV_ADMIN` from `.devcontainer/.env` (defaults 5173 / 5174) — the container listens on
each port and it's published to the same port number on the host, bound to `127.0.0.1` only.
`apps/public`'s `astro.config.mjs` reads `APP_PORT_DEV_PUBLIC` and `apps/admin`'s reads
`APP_PORT_DEV_ADMIN` for their dev server port, so the two stay in sync automatically. The intended
workflow is running multiple projects created from this template side by side, so both ports are
expected to be changed per project to avoid port collisions — don't assume 5173/5174 are fixed or
safe to hardcode elsewhere. Port publishing is handled entirely by docker compose; `devcontainer.json`
deliberately has no `forwardPorts`.

Note: `devcontainer.json`'s `portsAttributes` still keys its dev-server labels on the literal ports
`"5173"`/`"5174"`. If `APP_PORT_DEV_PUBLIC`/`APP_PORT_DEV_ADMIN` are changed for a project, update the
`portsAttributes` keys alongside them.

## MCP servers

Configured in `.mcp.json` and enabled in `.claude/settings.json`:

Prefer the framework-specific server over `context7` when one covers the question — reach for
`context7` for everything else rather than answering a library question from memory.

- `astro-docs` / `svelte` / `cloudflare-docs` — official docs for this stack's three core pieces.
  These are the first stop for Astro, Svelte and Workers/D1/R2/KV questions respectively.
- `context7` — remote HTTP server for up-to-date docs on any *other* library/framework.
- `playwright` — headless Chromium, used by the `design-review` skill. Screenshots default into
  the gitignored `.playwright-mcp/`; don't pass an absolute `filename`, or the file lands
  untracked in the repo root.
- `context-mode` — local context-compression server, installed globally (in-container) by
  `setup.sh` and invoked directly by command name.
- `semble` — local code search server, run via `uvx` (needs the `uv` install in the Dockerfile).

## Monorepo layout

This is a pnpm workspace (`pnpm-workspace.yaml`) orchestrated by Turborepo (`turbo.json`):

- `apps/public` — public site (Astro SSR + Svelte islands + plain Tailwind, no component library).
  Deploys as its own Cloudflare Worker.
- `apps/admin` — admin CMS (Astro SSR + Svelte islands + Tailwind + shadcn-svelte). Deploys as its
  own Cloudflare Worker. Depends on `packages/schema` via `workspace:*`.
- `packages/schema` — shared Drizzle schema (+ the `migrations/` a project generates), imported by
  both apps as `@app/schema`; the ULID helper is `@app/schema/ulid`.

`apps/admin` ships the AdminUser auth backend (login/logout/me, PBKDF2, D1-backed sessions, KV
lockout) plus the Post reference implementation that the `scaffold` generator mirrors; its login
**UI** is not wired to that API yet (DEV-06 §4-4 — that is step 3 of the workflow). `apps/public`
ships one placeholder page. `packages/schema` ships DEV-07 §3-1〜§3-3's standard tables and no
`migrations/` (see "D1 / R2 / KV binding rules"). The full tech-stack rationale (versions, why
each library was chosen, what's still `Open`) lives in `docs/3-development/01-architecture-rules.md`
(DEV-01) — do not duplicate stack decisions here or in `docs/`; this section only describes what's
already scaffolded in this repo.

## Architecture

Layer rule inside `apps/admin` (DEV-01 §5 carries the rationale; this is the enforceable form):

```text
Astro Page / API Route  →  Service  →  D1
   (render + I/O only)     (business    (Drizzle
                            logic)       queries)
```

- Pages and API routes never query D1 directly — they call a Service. The one exception is
  `lib/server/db/client.ts` (`createDb`), which may be imported from outside `lib/server/`.
- Svelte islands are UI only: they never import from `lib/server/`, they go through API routes.
- `apps/public` and `apps/admin` never import each other; shared code goes in `packages/*`, and
  `packages/*` never imports back from `apps/*`.
- All of the above is machine-checked by `eslint-plugin-boundaries` in `eslint.config.js`, so
  `pnpm lint` fails on a violation. `apps/admin/src/lib/server/` ships with the reference
  implementation (auth, http helpers, Post service); DEV-05 §1 owns its internal layout.
  `apps/public/src/lib/server/` holds exactly one thing by default — the inquiry submission
  endpoint's service (DEV-04 §5-3b) — and shares no auth code with admin (DEV-02 §1-2).

Cloudflare bindings are read with `import { env } from "cloudflare:workers"` — **not**
`Astro.locals.runtime.env`, which Astro removed in v6 and which does not exist in the v7 used here.

**Tailwind v4 is CSS-first — there is no `tailwind.config.js`.** Design tokens live in `@theme` /
`@theme inline` blocks in the stylesheet itself: `apps/admin/src/styles/admin.css` carries the
shadcn-svelte token layer, while `apps/public/src/styles/global.css` deliberately has none (plain
Tailwind, no component library). Fix a token in the stylesheet, never per page.

## D1 / R2 / KV binding rules

One D1 database and one R2 bucket per project, shared by both Workers. Binding names are fixed:

| Binding | Resource | `apps/public` | `apps/admin` |
| --- | --- | --- | --- |
| `DB` | D1 | yes | yes |
| `BUCKET` | R2 | yes | yes |
| `KV` | Workers KV | no | yes |

(Each app also has its own `ASSETS` binding for its built static files — that one is per-Worker,
not shared, and is part of the `@astrojs/cloudflare` setup rather than a project resource.)

- **Create once, then copy the ids.** Run `wrangler d1 create` / `wrangler r2 bucket create` from
  one app only and paste the generated `database_id` / `bucket_name` into the *other* app's
  `wrangler.jsonc`. Both files ship with `replace-with-*` placeholders that must be replaced at
  bootstrap — in the top-level config *and* in the `env.staging` / `env.production` blocks.
- **Migrations belong to `apps/admin`.** `pnpm db:generate` writes SQL into
  `packages/schema/migrations/`, and `wrangler d1 migrations apply` is run from `apps/admin` only —
  never from `apps/public`, even though it shares the same database.
- Never hand-write migration SQL and never edit anything under `packages/schema/migrations/`; it is
  `drizzle-kit generate` output (use the `schema-build` skill).
- **The template ships no `migrations/` directory at all** — it is a derived artifact, like `dist/`
  or `worker-configuration.d.ts`. A project's first `pnpm db:generate` creates it, producing a clean
  `0000_*.sql` for whatever tables that project actually has. Shipping a pre-generated migration
  would leave a snapshot in `meta/` that every project has to diff against, so their first
  `db:generate` would emit `ALTER`/`DROP` against the template's tables instead of a real baseline.
  Once generated, `migrations/` **is** committed by the project — do not add it to `.gitignore`.

## shadcn-svelte

Admin-only — `apps/public` gets plain Tailwind and no component library.

- Run the CLI from inside `apps/admin`, where `components.json` lives:
  `pnpm dlx shadcn-svelte@latest add <component>`.
- The CLI emits tab-indented files, so **run `pnpm format` after every `add`/`update`** or the next
  `pnpm check` fails on formatting.
- Generated components under `apps/admin/src/lib/components/ui/` are yours to edit.
- `.agents/skills/shadcn-svelte/` is vendor-managed — never hand-edit it. `.claude/skills/shadcn-svelte`
  is a symlink to it, which is what makes Claude Code load it as a skill.

## Current state / commands

Root `package.json` scripts fan out to every workspace package via Turborepo:
`pnpm dev` / `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm db:generate`.
`pnpm generate <pages|resource>` runs the root `plopfile.mjs` (the `scaffold` skill drives it —
it writes into both apps, so it is not per-app). `pnpm lint` (`eslint .`) and
`pnpm format` / `pnpm format:check` (`prettier`) run once at the repo root — not fanned out per
package — since ESLint's layer-boundary rules and Prettier's config are scoped by path pattern in
a single root `eslint.config.js` / `.prettierrc` (DEV-01 §1). `pnpm check` is the pre-commit/PR
gate and runs `format:check` + `lint` + `turbo run typecheck` together; there is deliberately no
separate per-app `check` script, since it would just be `typecheck` minus `wrangler types` (and
`worker-configuration.d.ts` is gitignored, so the `wrangler types` step is required on a fresh
clone). Check each package's own `package.json` before assuming a given script exists there — the
scaffolds only define the scripts each app actually needs so far (see "Monorepo layout" above).

A `PostToolUse` hook (`.claude/hooks/format-and-check.sh`, wired in `.claude/settings.json`) runs
Prettier → `eslint --fix` → `pnpm typecheck` automatically after every Edit/Write to a file this
toolchain understands (`*.md` is intentionally excluded — Prettier isn't run against docs here).
