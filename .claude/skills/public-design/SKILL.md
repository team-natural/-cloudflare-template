---
name: public-design
description: Orchestrates the full page-building chain for PUBLIC-FACING pages (LP, marketing, top page, general content) — frontend-design → baseline-ui → fixing-accessibility → fixing-motion-performance → web-design-guidelines → design-review. Use when building a new public page/screen or substantially reworking an existing one. NOT for admin screens — use the admin-design skill for those. NOT for light touch-ups — for those use the individual skill instead (spacing/typography → baseline-ui, a11y → fixing-accessibility, animation → fixing-motion-performance, guideline audit → web-design-guidelines, visual review → design-review).
---

# Public Page Design

Build a public-facing page by applying six skills **in this exact order**. Do not skip or
reorder steps; each one assumes the previous step's output. The argument to this skill is the
page brief (what to build, tone, constraints).

Scope: this pipeline is for building a public page from scratch or substantially reworking an
existing one — Step 1 revisits the visual direction, so running it on an existing page WILL
reshape its look. For small fixes on an existing page, don't use this skill; invoke the one
specialized skill that owns the problem (see the description above). For admin screens, use
`admin-design` instead — admin design is decided by the existing shadcn-svelte patterns, not by
this chain.

## Project constraints (apply throughout every step)

- **No shadcn-svelte / `admin.css` tokens on public pages** — build with plain Astro + Svelte
  islands + Tailwind v4 (see CLAUDE.md's Architecture section). shadcn-svelte is the admin-side
  system only.
- **Layout**: wrap the page in `apps/public/src/layouts/Layout.astro` and import
  `apps/public/src/styles/global.css` (plain Tailwind, no design-token layer). Site-wide
  `<head>` changes (OGP, fonts) belong in the layout, not the page — pages contain only their
  `<main>` content.
- **Svelte components are islands**: place them in `apps/public/src/components/`, mount from
  the `.astro` page with a `client:*` directive, and use Svelte 5 runes syntax (`$state`, etc.).
- **Design tokens**: `global.css` deliberately has no `@theme` token layer — if Step 1 commits
  to recurring custom values (a brand color, a type scale), keep them as Tailwind utility
  composition or page-scoped CSS custom properties; don't reach into `admin.css`'s tokens.

### Chain depth

Full 6-step chain: top page, LP, pricing/feature pages — anything that carries the product's
face. Simple pages (legal pages, `404.astro`/`500.astro`): Steps 1 and 6 are usually enough —
state which depth you chose and why.

## Step 1 — Design & build: `frontend-design`

Invoke the `frontend-design` skill and follow it while implementing the page: pin down the
subject/audience/job of the page, commit to a distinctive aesthetic direction, then build the
full UI. Done when the page renders end-to-end with real (or realistic) content.

## Step 2 — Polish pass: `baseline-ui`

Invoke the `baseline-ui` skill and sweep the code you just wrote: spacing scale, hierarchy,
typography, and small layout issues. Done when the pass produces no further changes.

## Step 3 — Accessibility pass: `fixing-accessibility`

Invoke the `fixing-accessibility` skill and audit/fix the page: ARIA labels, keyboard
navigation, focus management, contrast, form errors. Done when the audit finds nothing left
to fix in the new code.

## Step 4 — Motion & performance pass: `fixing-motion-performance`

Invoke the `fixing-motion-performance` skill and audit/fix every animation and transition on
the page: compositor-only properties, layout thrashing, scroll-linked motion, blur effects.
If the page has no motion at all, state that and move on. Done when the audit finds nothing
left to fix in the new code.

## Step 5 — Guideline QA gate: `web-design-guidelines`

Invoke the `web-design-guidelines` skill with the files written/changed in Steps 1–4 as the
audit target. It fetches the latest Vercel Web Interface Guidelines (100+ rules) and reports
violations in `file:line` format. This is a static code audit and runs AFTER all
code-rewriting passes so it sees the final code — it catches what the specialized passes
don't own (forms, touch targets, dark mode, i18n, image optimization, typography rules).
Fix every reported violation: route accessibility items with Step 3's approach and
animation items with Step 4's approach; fix the rest in place. Done when a re-audit reports
nothing, or only items you consciously reject as deliberate design decisions (state which
and why).

## Step 6 — Verify in a real browser: `design-review`

Invoke the `design-review` skill. It drives the running app through the `playwright` MCP
browser (screenshots at mobile/tablet/desktop, a11y snapshot, console check) and returns a
prioritized list of findings.

## Feedback loop

If design-review reports findings, fix them by returning to the step that owns the problem —
visual direction → Step 1, spacing/typography → Step 2, a11y → Step 3, animation jank or
performance → Step 4, guideline violations (forms, touch targets, dark mode, i18n, etc.) →
Step 5 — then re-run Step 6. Any fix that changed code should also pass back through the
Step 5 audit before re-verifying in the browser. Stop when design-review comes back clean or
only polish-level items remain; report those remaining items to the user rather than looping
forever (max 2 loops without asking).

## Reporting

At the end, summarize in the user's language: what was built, what each pass changed, and the
final design-review result (attach/reference the screenshots).
