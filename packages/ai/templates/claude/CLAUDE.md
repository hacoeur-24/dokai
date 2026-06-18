## DOKAI documentation

This project uses [DOKAI](https://github.com/hacoeur-24/dokai) for local-first documentation: a
committed `DOKAI/` tree of markdown files and `DOKAI/openapi/` OpenAPI specs, served by a local
web UI. The engine and UI live in the installed `dokai-kit` package — only the `DOKAI/` content is
part of this repo. Run `pnpm dokai` (or `dokai dev`) to open the UI on http://localhost:8128.

## How to work on docs and API specs in Claude Code

**First-time setup** — run `/set-documentation`. It asks whether to generate Docs, API specs, or
both (both are selected by default), then drives the full authoring workflow for the selected scope.

**After code changes** — run `/update-documentation`. Same scope prompt; targets drift and gaps
rather than regenerating from scratch.

**Hands-off authoring** — delegate to the `dokai` sub-agent (`.claude/agents/dokai.md`). It detects
the repo shape, authors or refreshes `DOKAI/` and `DOKAI/openapi/` by reading the codebase, and
summarizes what it created or updated. Invoke it with "set up the DOKAI docs" or "update the API
specs after the recent changes."

The **dokai-docs** skill (`.claude/skills/dokai-docs/SKILL.md`) carries the full frontmatter
conventions, section rules, Mermaid guidance, and Workflows A and B. The **dokai-api** skill
(`.claude/skills/dokai-api/SKILL.md`) carries the OpenAPI authoring and update conventions.

## Keep docs in sync with code

Whenever you make a significant change to the codebase — a new feature, an API or schema change, an
architecture or dependency shift, a removed module — update the affected docs under `DOKAI/` as part
of the same change. Run `/update-documentation` or ask the `dokai` sub-agent. Do not let docs drift
from the code; treat them as part of "done."

## OpenAPI specs

OpenAPI/Swagger specs (`.yaml`/`.yml`/`.json`) live under `DOKAI/openapi/`. DOKAI lists them in the
sidebar "APIs" group and renders each as an interactive reference with try-it-out. The lock icon and
Authorize flow come from the spec's `components.securitySchemes` plus per-operation `security`
arrays — no extra DOKAI configuration is needed. Specs are authored by reading the repo's actual
routes and handlers, not by invention; uncertain fields are marked `TBD: <question>`. Try-it-out
runs live when `pnpm dokai` is active; `dokai build` produces a read-only static export.
