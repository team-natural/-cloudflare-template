---
name: scaffold
description: Generate a Service + Zod validation + API Route set for a resource, via Plop. Use when asked to add CRUD (and optionally a state machine) for a table that already exists in DEV-07/schema.ts. NOT for the schema itself — run schema-build first if the table doesn't exist yet. NOT for admin/public page UI — that's public-design/admin-design.
---

# Scaffold

Stamps out the Service/validation/API-Route set demonstrated by the Post reference
implementation (`apps/admin/src/lib/server/services/posts.ts`, `apps/admin/src/pages/api/v1/posts/`)
for a new resource, via the `resource` Plop generator (`apps/admin/plopfile.mjs`, templates in
`apps/admin/plop-templates/resource/`). Run the generator from inside `apps/admin`.

> **Not available in the bare template.** None of the machinery above ships with this template:
> `plop` is not a dependency, there is no `plopfile.mjs` or `plop-templates/`, and neither the
> reference implementation nor `apps/admin/src/lib/server/` exists yet. All of it is created
> during project bootstrap, once the project has real tables and its first Service. Until then,
> stop and tell the user this skill has nothing to run — do not hand-write files pretending to be
> generator output, and do not invent the Service-layer conventions; DEV-05 §1 owns those.

**Precondition**: the target table must already exist in `packages/schema/src/schema.ts` (run the
`schema-build` skill first if it doesn't — scaffold reads the table, it doesn't create it).

## Step 1 — Gather the generator inputs

Read the target table's definition in `docs/3-development/07-database-schema.md` (DEV-07) and,
if it has states, the matching section of `docs/3-development/09-state-machine-spec.md` (DEV-09).
From these, work out:

| Input | How to determine it |
| --- | --- |
| `name` | Singular camelCase resource name (e.g. `category`) — matches the Service/validation file name |
| `table` | The Drizzle export name in `packages/schema/src/schema.ts` (e.g. `categories`) — DEV-07's table name |
| `externalKeyField` | The column used as the URL id. `publicId` if the table has one (DEV-07 §1's convention); otherwise the table's natural unique key (e.g. `slug` for `categories`/`tags`, which have no `public_id` — DEV-07 §4-3/§4-4) |
| `fields` | Comma-separated client-writable columns for create/update. Exclude the external key, `id`, `status`/state column, `created_at`/`updated_at`, and any column set from the session (e.g. `author_id`) rather than the request body |
| `writeRole` | `editor` or `admin` — who may create/update/delete (DEV-02 §2-3) |
| `hasTransitions` | Whether DEV-09 defines a state machine for this entity |
| `statusField` | The status column name (usually `status`) — leave empty if `hasTransitions` is false |
| `transitions` | `from:to:action` triples, comma-separated, built from DEV-09's transition matrix for the entity (e.g. `new:in_progress:start,in_progress:resolved:resolve` for Inquiry). Leave empty if `hasTransitions` is false. One action file is generated per **unique action name** — if the same action name appears with different `from` states (e.g. Post's `archived:published:publish` reusing the `publish` action already used for `draft:published:publish`), it must always target the same `to` state; the generator does not check this |

## Step 2 — Run the generator

```bash
npx plop resource -- --name=<name> --table=<table> --externalKeyField=<field> --fields=<csv> --writeRole=<role> --hasTransitions=<true|false> --statusField=<field-or-empty> --transitions=<csv-or-empty>
```

All seven flags are required in this order-independent `--flag=value` form — Plop's CLI bypass
mechanism cannot skip conditional prompts, so `statusField`/`transitions` must always be passed
(empty string when there's no state machine). Do not run `npx plop resource` interactively from
an agent context; always use the bypass form above.

This generates (paths use `<table>` for the URL segment, `<name>` for file/function names, all
rooted at `apps/admin/`):

- `src/lib/server/services/<name>.ts` — list/get/create/update/delete, plus `transition<Name>` if `hasTransitions`
- `src/lib/server/validation/<name>.ts` — `create<Name>Schema`/`update<Name>Schema` via `drizzle-zod`
- `src/pages/api/v1/<table>/index.ts` — GET (cursor-paginated list, DEV-04 §8) + POST (create)
- `src/pages/api/v1/<table>/[id].ts` — GET/PATCH/DELETE
- `src/pages/api/v1/<table>/[id]/<action>.ts` — one per unique transition action, if `hasTransitions`

Refuses to overwrite existing files (default Plop behavior) — if a file already exists, resolve
the conflict by hand rather than re-running with `--force`.

## Step 3 — Format and verify

```bash
pnpm run format
pnpm --filter admin run typecheck
```

The generator writes files outside Claude's own Edit/Write tool calls, so the `PostToolUse` hook
does not auto-format them (same caveat as `npx shadcn-svelte add` — see CLAUDE.md). Always run
`pnpm run format` before typecheck.

## Step 4 — Fill in what the generator can't know

The templates are deliberately generic and will not get every resource fully right. Check for,
and hand-add if needed:

- **Refinements on validation fields** — the generated Zod schemas have no `.min()`/`.max()`/etc; add them from DEV-07's column remarks (e.g. "最大 255 文字を想定")
- **Session-derived fields on create** — e.g. Post's `authorId: session.adminUserId` isn't in the generic template's `create<Name>` (which takes no `session` param); add it by hand if the resource needs one, and update the API route to pass `session` through
- **Side effects inside a transition** — e.g. Inquiry's `new → in_progress` transition should also set `handled_by` (DEV-09 §2-2-3); the generated `transition<Name>` only updates the status column and calls `logActivity`
- **Per-action role overrides** — every generated action route uses the single `writeRole` answer; split roles per action by hand if DEV-02 §2-3 ※1's per-project judgment calls for it (as Post's hand-written `unpublish.ts`/`archive.ts` do, using `admin` while `publish.ts` uses `editor`)

## Reporting

State which resource was scaffolded, the exact command used, which files were generated, and
which Step 4 follow-ups (if any) still need a human/AI pass before the endpoints are real.
