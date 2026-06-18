# Changelog

## v1.1.0 — 2026-06-17

- **Agent assets v2:** the single `dokai` skill is split into two focused skills — `dokai-docs`
  (documentation conventions and author/update workflows) and `dokai-api` (OpenAPI authoring and
  update-from-code workflows). Both are installed under `.claude/skills/` (lean Claude reference)
  and `.agents/skills/` (full workflow for all other agents). The legacy `.claude/skills/dokai/`
  and `.agents/skills/dokai/` directories are automatically removed on `dokai init` / `dokai update`.
- **`dokai` Claude sub-agent** added at `.claude/agents/dokai.md`: a focused orchestrator that
  detects the repo shape, authors or refreshes `DOKAI/` markdown and `DOKAI/openapi/` specs by
  reading the actual codebase, and summarizes what it created or left as `TBD`. Invoke it hands-off
  with "set up the DOKAI docs" or "update the API specs."
- **`CLAUDE.md` managed block**: `dokai init` now patches a `<!-- dokai:start -->`/`<!-- dokai:end -->`
  block into the repo root `CLAUDE.md` (creating it if needed) alongside the existing `AGENTS.md`
  block. The `CLAUDE.md` block is Claude-optimized — it surfaces the slash commands, the sub-agent,
  and the two skills; `AGENTS.md` surfaces the full-workflow agent skills for Codex/Cursor/etc.
- **`/set-documentation` and `/update-documentation` now ask Docs / API scope**: both commands open
  with an AskUserQuestion multiselect (Docs + API endpoints, both checked by default) before
  running. Pass an unambiguous scope word as `$ARGUMENTS` (e.g. "api", "docs") to skip the prompt.
- **OpenAPI specs authored from code**: the `dokai-api` skill and the API scope in the slash
  commands drive agents to read the repo's routes, controllers, and handlers — deriving
  `components.securitySchemes`, per-operation `security` arrays, paths, and response schemas —
  and write OAS 3.x specs under `DOKAI/openapi/`. Uncertain fields are marked `TBD: <question>`.
- OpenAPI explorer: drop OpenAPI/Swagger specs into `DOKAI/openapi/` and DOKAI renders each as an
  interactive reference (powered by Scalar), grouped under a new "APIs" sidebar section with a lock
  icon on specs that have secured operations.
- Try-it-out: run requests live from the UI in `pnpm dokai` via a local CORS-proof proxy that works
  against any backend (including `localhost`); hosts are limited to spec `servers` + loopback +
  `settings.openapi.allowedHosts`. The static `dokai build` export renders specs read-only.
- Specs are indexed in search (one entry per spec). New optional `openapi` block in
  `DOKAI/settings.json` (`enabled`, `dir`, `allowedHosts`, `persistAuth`).
- Full-width site header with GitHub and Application quick-links (configurable via the new
  `project.githubUrl` / `project.appUrl` settings fields); the global search bar relocated into the
  header.
- Create-new flow: a "+" button in the sidebar header opens a modal with a Document / Folder
  switcher, a location dropdown, and a live slug preview. Folders are created instantly via a new
  `POST /api/folder` endpoint that writes a `_section.json` file — no content required.
- Sidebar collapse-all / expand-all toggle: a single button folds or unfolds every section at once;
  state is seeded from and persisted to `settings.sidebarFoldersCollapsed`.
- Search filters toggle and custom status filter: a funnel icon reveals filter chips, with a
  custom-styled status dropdown (replaces the native `<select>`) so the look matches the rest of the
  UI.
- Custom `Dropdown` and `InfoTip` primitives shared across the settings panel: settings fields that
  use dropdowns now render the custom control, and each setting has an info-icon tooltip explaining
  the option.
- `project.githubUrl` and `project.appUrl` fields in the Settings panel (with `InfoTip`
  explanations) replace the old plain text inputs; both are optional.
- Doc content area is slightly wider (max `76ch` instead of `72ch`) to give prose more room on
  large screens.
- French translations added for the diagram fullscreen-mode buttons ("Plein écran" / "Quitter le
  plein écran" / "Fermer").

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
