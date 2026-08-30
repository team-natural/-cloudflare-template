// @ts-check
// Layer-boundary rules: docs/3-development/03-quality-policy.md §3-3
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import boundaries from "eslint-plugin-boundaries";
import eslintPluginSvelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";
import adminSvelteConfig from "./apps/admin/svelte.config.js";
import publicSvelteConfig from "./apps/public/svelte.config.js";

export default tseslint.config(
  {
    ignores: ["**/dist/", "**/.astro/", "**/.wrangler/", "**/.turbo/", "**/.agents/", "**/.claude/", "**/.playwright-mcp/", "**/node_modules/", "**/worker-configuration.d.ts", "**/migrations/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginSvelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // Each app has its own svelte.config.js; passing it to the parser is what makes
  // preprocessor-aware rules (svelte/valid-compile etc.) accurate.
  {
    files: ["apps/admin/**/*.svelte"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, svelteConfig: adminSvelteConfig },
    },
  },
  {
    files: ["apps/public/**/*.svelte"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, svelteConfig: publicSvelteConfig },
    },
  },
  {
    // d.ts files need triple-slash references and empty-interface module augmentation
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["apps/*/src/**/*.{ts,astro,svelte}", "packages/*/src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      // Without this, patterns resolve against cwd and silently match nothing when turbo runs eslint per app.
      "boundaries/root-path": path.dirname(fileURLToPath(import.meta.url)),
      // Required so boundaries can resolve extensionless TS imports
      "import/resolver": { typescript: true },
      "boundaries/elements": [
        { type: "public-pages", pattern: "apps/public/src/pages" },
        { type: "public-components", pattern: "apps/public/src/components" },
        { type: "admin-pages", pattern: "apps/admin/src/pages" },
        { type: "admin-components", pattern: "apps/admin/src/lib/components" },
        { type: "services", pattern: "apps/admin/src/lib/server/services" },
        { type: "db", pattern: "apps/admin/src/lib/server/db" },
        { type: "auth", pattern: "apps/admin/src/lib/server/auth" },
        { type: "http", pattern: "apps/admin/src/lib/server/http" },
        { type: "validation", pattern: "apps/admin/src/lib/server/validation" },
        { type: "packages", pattern: "packages/*/src" },
      ],
      // client.ts (createDb) is the one db file routes may import (DEV-05 §1).
      // No negation patterns here — a bare "!x" matches every file except x.
      "boundaries/files": [
        {
          category: "db-internal",
          pattern: ["apps/admin/src/lib/server/db/!(client).ts", "apps/admin/src/lib/server/db/*/**"],
        },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: { element: { types: { anyOf: ["public-pages", "admin-pages"] } } },
              disallow: { to: { file: { categories: "db-internal" } } },
              message: "Pages / API routes must not query db directly — go through the service layer; only db/client.ts (createDb) may be imported (DEV-01 §5, DEV-05 §2)",
            },
            {
              // The Drizzle schema lives in packages/schema (@app/schema). Pages/components
              // must not import table defs directly and query around the service layer — this
              // restores the DEV-05 §2 boundary that db-internal enforced before the schema moved
              // to a package. Only services/db(client)/validation may import @app/schema. Revisit
              // if a page-consumable package (shared UI/types) is ever added to packages/.
              from: {
                element: { types: { anyOf: ["public-pages", "admin-pages", "public-components", "admin-components"] } },
              },
              disallow: { to: { element: { type: "packages" } } },
              message: "Pages / API routes / UI components must not import @app/schema directly — go through the service layer (DEV-01 §5, DEV-05 §2)",
            },
            {
              from: { element: { types: { anyOf: ["public-components", "admin-components"] } } },
              disallow: { to: { element: { types: { anyOf: ["services", "db", "auth", "http"] } } } },
              message: "UI components must not import server layers — delegate via API routes (DEV-01 §5-3)",
            },
            {
              from: { element: { types: { anyOf: ["services", "db", "auth", "http", "validation"] } } },
              disallow: { to: { element: { types: { anyOf: ["public-pages", "public-components", "admin-pages", "admin-components"] } } } },
              message: "Server layers must not depend on UI layers — dependencies flow one way (DEV-05 §2)",
            },
            {
              // Two independently deployable Workers (apps/public, apps/admin) — neither app may
              // reach into the other's source; share via packages/* instead.
              from: { element: { types: { anyOf: ["public-pages", "public-components"] } } },
              disallow: {
                to: { element: { types: { anyOf: ["admin-pages", "admin-components", "services", "db", "auth", "http", "validation"] } } },
              },
              message: "apps/public must not import from apps/admin — share code via packages/* instead",
            },
            {
              from: { element: { types: { anyOf: ["admin-pages", "admin-components", "services", "db", "auth", "http", "validation"] } } },
              disallow: { to: { element: { types: { anyOf: ["public-pages", "public-components"] } } } },
              message: "apps/admin must not import from apps/public — share code via packages/* instead",
            },
            {
              // packages/* is shared code — it must never depend back on an app (DEV-01 §1 monorepo rules).
              from: { element: { type: "packages" } },
              disallow: {
                to: {
                  element: {
                    types: { anyOf: ["public-pages", "public-components", "admin-pages", "admin-components", "services", "db", "auth", "http", "validation"] },
                  },
                },
              },
              message: "packages/* must not depend on apps/* — dependencies flow apps -> packages only",
            },
          ],
        },
      ],
    },
  },
);
