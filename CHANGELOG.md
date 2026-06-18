# Changelog

## v1.1.0 — 2026-06-17

- OpenAPI explorer: drop OpenAPI/Swagger specs into `DOKAI/openapi/` and DOKAI renders each as an
  interactive reference (powered by Scalar), grouped under a new "APIs" sidebar section with a lock
  icon on specs that have secured operations.
- Try-it-out: run requests live from the UI in `pnpm dokai` via a local CORS-proof proxy that works
  against any backend (including `localhost`); hosts are limited to spec `servers` + loopback +
  `settings.openapi.allowedHosts`. The static `dokai build` export renders specs read-only.
- Specs are indexed in search (one entry per spec). New optional `openapi` block in
  `DOKAI/settings.json` (`enabled`, `dir`, `allowedHosts`, `persistAuth`).

## v1.0.1 — 2026-06-17

- `dev` is now the default command — bare `dokai` (and `npx dokai-kit` / `pnpm exec dokai` / a
  global `dokai`) starts the documentation UI with no `dev` subcommand needed.
- First release published through the automated GitHub Actions pipeline (npm Trusted Publishing
  / OIDC, no token).

## v1.0.0 — 2026-06-17 — First public release

The first public release of DOKAI: local-first documentation, dropped into any repo
with one command. Published unscoped on the public npm registry as `dokai-kit`
(the CLI — its command is `dokai`), plus `dokai-core`, `dokai-ui`, and `dokai-ai`.

### Highlights

- **`dokai init`** scaffolds a `DOKAI/` markdown tree, `.claude/` slash commands and a
  documentation skill, and patches your `package.json` scripts and `.gitignore`. It is
  idempotent — re-running it (or `dokai update`) only fills in what is missing.
- **Live docs UI** on `http://localhost:8128` (`dokai dev`): React + Tailwind, a Milkdown
  WYSIWYG editor with a raw-markdown toggle, a workspace-aware sidebar, local MiniSearch,
  light/dark themes, inline Mermaid diagrams, and an English/French UI.
- **Static build** (`dokai build`) produces a deployable read-only site; `dokai preview`
  serves it locally.
- **Claude Code integration** via the `/set-documentation` and `/update-documentation`
  slash commands.
- **Frontmatter versioning** with `dokai bump`, and a standalone search-index rebuild via
  `dokai generate`.
- **Repo-aware**: detects single-package, pnpm/npm/yarn workspace, and Turborepo layouts and
  maps workspace packages into the documentation sidebar.

Requires Node.js 22+. MIT licensed.
