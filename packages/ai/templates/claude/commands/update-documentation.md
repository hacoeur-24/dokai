---
description: Compare DOKAI/ against the current codebase. Fix stale docs (drift), create new docs for undocumented areas (gaps), all matching the existing structure. Preserves user prose where possible.
argument-hint: "[scope] (optional — e.g. 'frontend', 'just architecture', 'since v0.4.0', 'api', 'docs')"
---

# /update-documentation

You are doing an **incremental update + gap audit** of the existing `DOKAI/` documentation and/or OpenAPI specs. This is the _update_ command — it does NOT regenerate the tree. It compares what's documented against what's in the code, then makes targeted edits.

Two distinct outputs every run:

1. **Drift fixes** — docs or specs that no longer match the code. Edit the content (and only the content) to match reality.
2. **Gap fills** — code surfaces that have no covering doc or spec. Create new files that follow the _existing_ structure conventions.

## When to use this vs `/set-documentation`

| Situation                                                          | Command                                             |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `DOKAI/` is empty or only has init stubs                           | `/set-documentation`                                |
| `DOKAI/` already has substantive docs, you want to refresh         | **`/update-documentation`** ← you're here           |
| You suspect there are undocumented modules and want them filled in | **`/update-documentation`** (gap audit covers this) |

## Step 0 — Choose scope

Unless `$ARGUMENTS` already names a scope (e.g. "api", "docs", "frontend", "since v0.4.0"), use the **AskUserQuestion** tool with `multiSelect: true` to ask what to update. Present exactly two options:

- **Docs** — the `DOKAI/` markdown documentation tree (architecture, features, packages, etc.)
- **API endpoints** — OpenAPI specs under `DOKAI/openapi/` (re-sync against changed routes and handlers)

Both options are **selected by default**. The user may uncheck one to limit the run to a single scope.

Proceed with whatever the user keeps checked. If `$ARGUMENTS` contains an unambiguous scope word ("docs", "api", "openapi", "markdown", etc.), infer the scope and skip the question.

---

## Docs scope — Workflow B (drift + gap update)

_Run this section only if **Docs** is in scope._

### Phase 1 — Inventory the existing documentation

Read `DOKAI/` exhaustively. Build an internal mental map:

- Every `*.md` file → its `title`, `tags`, `version`, `status`, and what code surface it claims to document.
- Every `_section.json` → its `title`, `tags`, `order`. Note the _conventions_ the project uses (file naming, frontmatter style, how sections are split, where Mermaid diagrams live, etc.).
- The repo's settings — `DOKAI/settings.json` — for `projectName`, `repository.structure`, workspace mappings.

This inventory is the source of truth for "what's documented today". Hold it in working memory; you'll use it in every later phase.

### Phase 2 — Inventory the codebase

Read the codebase the same way `/set-documentation` does, but with extra attention to _boundaries_:

- Workspace packages (monorepos): each one's role, public API, entry points, dependencies.
- Top-level features / domains in a single-package repo.
- Public surfaces: HTTP/RPC endpoints, CLI commands, exported library APIs.
- Critical invariants, auth flows, data models.
- Recent commits (`git log --since="3 months ago" --name-only`) — signal hotspots that may have drifted.

If `[scope]` was passed, narrow to that scope.

### Phase 3 — Compare and classify

For each item in the codebase inventory, find its match in the docs inventory. Classify:

- **Match (current)** — doc exists and prose accurately describes the current code. Skip.
- **Match (stale)** — doc exists but prose contradicts the code (renamed function, removed endpoint, changed signature, outdated diagram, etc.). Mark for **drift fix**.
- **Gap** — code surface has no covering doc. Mark for **gap fill**.

For each item in the docs inventory not yet matched, check whether it documents code that still exists. If not, mark as **orphan** (deletion candidate — but don't delete; surface to the user).

### Phase 4 — Fix drift (minimal, targeted edits)

For each _stale_ doc:

- Update the prose to reflect current behavior. **Edit, do not rewrite.** Preserve voice, tone, and structure.
- Update Mermaid diagrams ONLY if the architecture, flow, or relationships visibly changed.
- Update code samples if signatures changed.
- Refresh `updatedAt` to the current ISO 8601 timestamp.
- Bump `version` according to the change:
  - `patch` — wording fixes, minor refactor docs, internal-only details.
  - `minor` — new sections, new examples, additive API documentation.
  - `major` — breaking change to a documented interface, deletion or significant restructure of a section.
- For folders with `_section.json`, bump the section version when one of its child docs gets a `major` bump.

### Phase 5 — Fill gaps (new docs that match existing structure)

For each _gap_, create a new doc. **Match the conventions you observed in Phase 1**:

- File location → put it where similar docs already live (e.g. if all backend services are documented under `services/<name>/overview.md` + `endpoints.md`, follow that pattern).
- File naming → use the same kebab-case conventions as siblings.
- Frontmatter → same `tags` vocabulary, same `version` start (`0.1.0`), `status: draft`.
- Section depth → don't introduce a new top-level section if the new doc fits inside an existing one.
- If a new section folder is genuinely required, also add a `_section.json` with `title`, `description`, `tags`, `version: 0.1.0`, and an `order` that fits the existing sequence.

The _structure follows the project_, not your preferences. If the project documents per-feature, do per-feature. If per-package, do per-package.

### Phase 6 — Respect settings boundaries

- Do not modify `DOKAI/user-settings.local.json`. It is a per-user file, gitignored.
- Edit `DOKAI/settings.json` only if a real shared change occurred (e.g. a workspace was added or removed and `repository.structure` needs updating). Don't gratuitously touch this file.

### Docs — What NOT to do

- Do not rewrite untouched docs.
- Do not change tags or section structure unless required by a real change.
- Do not roll back user edits to frontmatter that look intentional.
- Do not delete orphaned docs — surface them and let the user decide.
- Do not introduce new top-level sections for trivial changes — fold them into existing sections.
- Do not commit. The user runs git themselves.

---

## API scope — Re-sync OpenAPI specs against changed routes

_Run this section only if **API endpoints** is in scope._

Re-sync the existing specs under `DOKAI/openapi/` against the current routes, controllers, and handlers. Follow the `dokai-api` skill (`.claude/skills/dokai-api/SKILL.md`) for the full conventions.

### API Phase 1 — Inventory existing specs

Read every `*.yaml` and `*.json` file under `DOKAI/openapi/`. For each spec, note:

- Which routes/paths it covers
- The `info.version` and any existing `TBD` comments
- Security schemes declared in `components.securitySchemes`

### API Phase 2 — Identify what changed in the API

Check recent commit history and diffs for route/controller/handler changes:

```bash
git log --since="3 months ago" --name-only -- <routes dir>
```

If `$ARGUMENTS` names a version or date (e.g. "since v0.4.0"), use that as the lookback window. Otherwise default to 3 months.

Read the affected handlers for:

- New paths or HTTP methods added
- Removed paths or methods
- Changed request body shapes (new fields, removed fields, type changes)
- Changed response shapes
- Changed path/query parameters
- Auth guards added or removed

### API Phase 3 — Edit specs (minimal, targeted changes)

For each changed route:

- Update the corresponding `paths` entry in the spec.
- Update or add `components/schemas` entries as needed; use `$ref` — do not duplicate inline.
- If security changed (new scheme, route now public, etc.), update `securitySchemes` and per-operation `security`.
- Remove entries for routes that no longer exist.
- Resolve any `TBD` comments that the updated code now makes clear.
- Add new `TBD: <question>` comments for anything you still cannot infer.

Do not rewrite sections of the spec that were not affected by the code change.

### API Phase 4 — Fill spec gaps

If the inventory reveals routes that have no spec coverage at all, create a new spec file under `DOKAI/openapi/<name>.yaml` following the same conventions as existing files (see `/set-documentation` API scope for the file structure template).

### API — What NOT to do

- Do not regenerate the entire spec from scratch; edit only affected paths and schemas.
- Do not invent field shapes not present in the handler code.
- Do not remove `TBD` comments unless the code now makes the answer clear.
- Do not commit. The user runs git themselves.

---

## Output

After all phases, print a summary in chat (not in the docs):

### Updated (drift fixes)

- `frontend/components.md` `0.2.1 → 0.3.0` _— Button props changed; added new size variant_
- `services/auth/overview.md` `1.0.0 → 1.1.0` _— OAuth callback URL updated_
- `DOKAI/openapi/api.yaml` _— added POST /payments, updated GET /users/:id response schema_

### Created (gap fills)

- `services/billing/overview.md` _— newly created, no doc previously covered this service_
- `services/billing/webhooks.md`
- `packages/shared-utils/_section.json` _— new section needed for this package_
- `DOKAI/openapi/internal.yaml` _— new spec for admin API, previously undocumented_

### Orphans (manual review)

- `legacy/sso.md` _— could not find any code matching the documented `LegacySSOClient`. Possibly deleted; consider archiving or removing._

### Unchanged but worth a look (optional)

- Files you considered but didn't edit, with a one-line reason.

### Scopes run

- Docs: yes / no
- API endpoints: yes / no

End with a recommendation: typically _"Review the drafts in the editor (`pnpm dokai`), then commit when satisfied."_
