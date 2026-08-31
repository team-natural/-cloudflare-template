import { readFileSync } from "node:fs";
import path from "node:path";

// Plop generators for the `scaffold` skill (.claude/skills/scaffold/SKILL.md).
// Run from the repo root via `pnpm generate <generator>` (both apps are generated from here —
// apps/* must not reach into each other, so this lives at the root like eslint.config.js).
// Assumes the target Drizzle table already exists in packages/schema/src/schema.ts
// (i.e. `schema-build` has already run for this table — DEV-01 §9).

function parseCsv(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// "from:to:action,from:to:action" -> [{ from, to, action }]
function parseTransitions(value) {
  return parseCsv(value).map((entry) => {
    const [from, to, action] = entry.split(":").map((p) => p.trim());
    return { from, to, action };
  });
}

function groupByFrom(transitions) {
  const grouped = {};
  for (const { from, to } of transitions) {
    grouped[from] ??= [];
    grouped[from].push({ to });
  }
  return grouped;
}

// One row per unique action name — assumes an action name always targets the same state
// regardless of which state it's triggered from (true for all of Post's publish/unpublish/archive).
function uniqueActions(transitions) {
  const seen = new Map();
  for (const { to, action } of transitions) {
    if (!seen.has(action)) seen.set(action, to);
  }
  return Array.from(seen, ([action, to]) => ({ action, to }));
}

// PRD-04 §3-1 (public, SCR-*) and §3-2 (admin, ADM-*) are the source of truth for which screens
// exist and where they live. Both tables carry a ルート column, so the generator reads them
// directly instead of having the screen list retyped into a flag — retyping is exactly where a
// route map drifts out of sync with the spec.
const SCREENS_DOC = "docs/2-product/04-ui-ux-design.md";

// A row looks like: | ADM-02 | 記事（Post）一覧 / 編集 | `/posts` · `/posts/[id]` | ... |
// One row can name several routes (list + detail), separated by "·".
function parseScreenTable(markdown, idPrefix) {
  const rows = [];
  const rowRe = new RegExp(String.raw`^\|\s*(${idPrefix}-\d+)\s*\|([^|]*)\|([^|]*)\|`, "gm");
  for (const [, screenId, rawName, rawRoutes] of markdown.matchAll(rowRe)) {
    const screenName = rawName.trim();
    const routes = rawRoutes
      .split("·")
      .map((r) => r.trim().replace(/^`|`$/g, ""))
      .filter((r) => r.startsWith("/"));
    for (const route of routes) rows.push({ screenId, screenName, route });
  }
  return rows;
}

// PRD-04 marks adoption-gated screens in the 画面名 itself (軽量 EC / マイページ機能採用時, 標準外).
// Those tables stay in the doc for every project, so skip them unless the project opted in.
function isOptional(screenName) {
  return /採用時|標準外/.test(screenName);
}

// "/" -> index.astro ; "/blog" -> blog/index.astro ; "/blog/[slug]" -> blog/[slug].astro
function routeToFile(route) {
  const trimmed = route.replace(/^\/+|\/+$/g, "");
  if (trimmed === "") return "index.astro";
  const segments = trimmed.split("/");
  const last = segments[segments.length - 1];
  // A dynamic final segment becomes a file, a static one becomes a directory with index.astro,
  // so that /blog keeps working as a route once /blog/[slug] exists next to it.
  return last.startsWith("[") ? `${segments.join("/")}.astro` : `${segments.join("/")}/index.astro`;
}

export default function (plop) {
  plop.setGenerator("pages", {
    description: "Stamp Astro page skeletons for every screen in PRD-04 §3-1/§3-2 — both apps in one run, routes only, no design decisions",
    prompts: [
      {
        type: "confirm",
        name: "includeOptional",
        message: "Include adoption-gated screens (軽量 EC / マイページ / 標準外)?",
        default: false,
      },
    ],
    actions(data) {
      const markdown = readFileSync(path.join(import.meta.dirname, SCREENS_DOC), "utf8");
      const apps = [
        { idPrefix: "ADM", base: "apps/admin/src/pages", section: 2, designSkill: "admin-design" },
        { idPrefix: "SCR", base: "apps/public/src/pages", section: 1, designSkill: "public-design" },
      ];

      const actions = [];
      for (const app of apps) {
        const screens = parseScreenTable(markdown, app.idPrefix);
        // A project that rewrote PRD-04's screen table without the ルート column would otherwise
        // get a silent no-op here. Fail loudly instead — the route map is the whole point.
        if (screens.length === 0) {
          throw new Error(`No ${app.idPrefix}-* rows with a ルート column found in ${SCREENS_DOC}. Add the route to PRD-04 §3-${app.section} first (see the scaffold skill).`);
        }
        for (const screen of screens) {
          if (!data.includeOptional && isOptional(screen.screenName)) continue;
          const file = routeToFile(screen.route);
          // Layout.astro always sits at src/layouts/, so the relative depth follows the route depth.
          const up = "../".repeat(file.split("/").length);
          actions.push({
            type: "add",
            path: `${app.base}/${file}`,
            templateFile: "plop-templates/page/page.astro.hbs",
            skipIfExists: true,
            data: {
              ...screen,
              sectionNumber: app.section,
              designSkill: app.designSkill,
              layoutImport: `${up}layouts/Layout.astro`,
            },
          });
        }
      }
      return actions;
    },
  });

  plop.setGenerator("resource", {
    description: "Scaffold a Service + validation + API Route set for a resource already defined in DEV-07 and packages/schema/src/schema.ts",
    prompts: [
      { type: "input", name: "name", message: "Resource name (singular, camelCase — e.g. category):" },
      { type: "input", name: "table", message: "Drizzle table export name in schema.ts (e.g. categories):" },
      {
        type: "input",
        name: "externalKeyField",
        message: "Column used as the URL id param (camelCase — publicId if the table has one, otherwise e.g. slug):",
        default: "publicId",
      },
      {
        type: "input",
        name: "fields",
        message: "Comma-separated client-writable fields for create/update (exclude the URL key, status, id, timestamps):",
      },
      {
        type: "list",
        name: "writeRole",
        message: "Role required for create/update/delete (DEV-02 §2-3):",
        choices: ["editor", "admin"],
        default: "editor",
      },
      { type: "confirm", name: "hasTransitions", message: "Does this resource have a state machine (DEV-09)?", default: false },
      // No `when` on the next two — node-plop's CLI bypass ("-- --flag=value") rejects any
      // prompt with a `when` function outright ("You can not bypass conditional prompts").
      // Always ask/pass both; leave them empty when hasTransitions is false.
      {
        type: "input",
        name: "statusField",
        message: "Status column name (leave empty if no state machine):",
        default: "status",
      },
      {
        type: "input",
        name: "transitions",
        message: "Transitions as from:to:action pairs, comma-separated, or empty if none (e.g. draft:published:publish,published:draft:unpublish,published:archived:archive,archived:published:publish):",
      },
    ],
    actions: function (data) {
      data.fieldsList = parseCsv(data.fields);
      data.hasAutoKey = data.externalKeyField === "publicId";

      const actions = [
        {
          type: "add",
          path: `apps/admin/src/lib/server/services/${data.name}.ts`,
          templateFile: "plop-templates/resource/service.ts.hbs",
        },
        {
          type: "add",
          path: `apps/admin/src/lib/server/validation/${data.name}.ts`,
          templateFile: "plop-templates/resource/validation.ts.hbs",
        },
        {
          type: "add",
          path: `apps/admin/src/pages/api/v1/${data.table}/index.ts`,
          templateFile: "plop-templates/resource/api-index.ts.hbs",
        },
        {
          type: "add",
          path: `apps/admin/src/pages/api/v1/${data.table}/[id].ts`,
          templateFile: "plop-templates/resource/api-id.ts.hbs",
        },
      ];

      if (data.hasTransitions) {
        const transitions = parseTransitions(data.transitions);
        const states = new Set();
        for (const t of transitions) {
          states.add(t.from);
          states.add(t.to);
        }
        data.states = Array.from(states);
        data.firstState = transitions[0].from; // the state a newly created row starts in
        data.transitionsByFrom = groupByFrom(transitions);

        for (const { action, to } of uniqueActions(transitions)) {
          actions.push({
            type: "add",
            path: `apps/admin/src/pages/api/v1/${data.table}/[id]/${action}.ts`,
            templateFile: "plop-templates/resource/api-transition.ts.hbs",
            data: { targetState: to },
          });
        }
      }

      return actions;
    },
  });
}
