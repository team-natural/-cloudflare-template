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

- `context7` — remote HTTP server for up-to-date library/framework docs.
- `context-mode` — local context-compression server, installed globally (in-container) by
  `setup.sh` and invoked directly by command name.
- `semble` — local code search server, run via `uvx` (needs the `uv` install in the Dockerfile).

## Monorepo layout

This is a pnpm workspace (`pnpm-workspace.yaml`) orchestrated by Turborepo (`turbo.json`):

- `apps/public` — public site (Astro SSR + Svelte islands + plain Tailwind, no component library).
  Deploys as its own Cloudflare Worker.
- `apps/admin` — admin CMS (Astro SSR + Svelte islands + Tailwind + shadcn-svelte). Deploys as its
  own Cloudflare Worker. Depends on `packages/schema` via `workspace:*`.
- `packages/schema` — shared Drizzle schema/migrations, imported by `apps/admin` as `@app/schema`.

Both apps currently ship as minimal scaffolds (one placeholder page each, no auth/login wired up).
`packages/schema` ships with one placeholder table. The full tech-stack rationale (versions, why
each library was chosen, what's still `Open`) lives in `docs/3-development/01-architecture-rules.md`
(DEV-01) — do not duplicate stack decisions here or in `docs/`; this section only describes what's
already scaffolded in this repo.

## Current state / commands

Root `package.json` scripts fan out to every workspace package via Turborepo:
`pnpm dev` / `pnpm build` / `pnpm typecheck` / `pnpm db:generate`. `pnpm lint` (`eslint .`) and
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
