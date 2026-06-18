## DOKAI documentation

This project uses [DOKAI](https://github.com/hacoeur-24/dokai) for local-first documentation: a
committed `DOKAI/` tree of markdown files and `DOKAI/openapi/` OpenAPI specs, served by a local
web UI. The engine and UI live in the installed `dokai-kit` package — only the `DOKAI/` content is
part of this repo. Run `pnpm dokai` (or `dokai dev`) to open the UI on http://localhost:8128.

## How to work on docs and API specs

The skills at `.agents/skills/dokai-docs/SKILL.md` and `.agents/skills/dokai-api/SKILL.md` carry
the full workflows, conventions, and examples. When asked to set up or update the documentation or
API specs, load and follow the relevant skill before writing anything.

- **First-time docs setup** (`DOKAI/` is empty or stub-only): load `dokai-docs` and follow
  Workflow A — detect the repo shape; read entry points, public APIs, data layer, auth, build, and
  tests; plan a logical section tree; write all docs with mandatory frontmatter; update
  `DOKAI/settings.json`.
- **Update existing docs** (after code changes): load `dokai-docs` and follow Workflow B —
  inventory current docs; compare against the code; fix drift with targeted edits; fill gaps; surface
  orphans. Do not rewrite untouched docs.
- **First-time API spec setup**: load `dokai-api` — locate routes and handlers, derive paths,
  schemas, and security; write spec(s) under `DOKAI/openapi/`; mark uncertain fields `TBD`.
- **Update existing API specs**: load `dokai-api` — re-read changed handlers; edit affected paths
  and schemas; remove stale entries; resolve existing `TBD` comments the code now answers.

## Keep docs in sync with code

Whenever you make a significant change to the codebase — a new feature, an API or schema change, an
architecture or dependency shift, a removed module — update the affected docs under `DOKAI/` as part
of the same change. Follow the dokai-docs skill. Do not let docs drift from the code; treat them as
part of "done."

## OpenAPI specs

OpenAPI/Swagger specs (`.yaml`/`.yml`/`.json`) live under `DOKAI/openapi/`. DOKAI lists them in the
sidebar "APIs" group and renders each as an interactive reference with try-it-out. The lock icon and
Authorize flow come from the spec's `components.securitySchemes` plus per-operation `security`
arrays — no extra DOKAI configuration is needed. Specs are derived from the repo's actual routes
and handlers (read the code; do not invent endpoints); uncertain fields are marked
`TBD: <question>`. Try-it-out runs live when `pnpm dokai` is active; `dokai build` produces a
read-only static export.

Claude Code users also have `/set-documentation` and `/update-documentation` slash commands and a
`dokai` sub-agent.
