---
description: Compare DOKAI/ against the current codebase. Fix stale docs (drift), create new docs for undocumented areas (gaps), all matching the existing structure. Preserves user prose where possible.
argument-hint: "[scope] (optional — e.g. 'frontend', 'just architecture', 'since v0.4.0')"
---

# /update-documentation

You are doing an **incremental update + gap audit** of the existing `DOKAI/` documentation. This is the _update_ command — it does NOT regenerate the tree. It compares what's documented against what's in the code, then makes targeted edits.

Two distinct outputs every run:

1. **Drift fixes** — docs that no longer match the code. Edit the prose (and only the prose) to match reality.
2. **Gap fills** — code that has no doc covering it. Create new docs that follow the _existing_ structure conventions.

## When to use this vs `/set-documentation`

| Situation                                                          | Command                                             |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `DOKAI/` is empty or only has init stubs                           | `/set-documentation`                                |
| `DOKAI/` already has substantive docs, you want to refresh         | **`/update-documentation`** ← you're here           |
| You suspect there are undocumented modules and want them filled in | **`/update-documentation`** (gap audit covers this) |

## Phase 1 — Inventory the existing documentation

Read `DOKAI/` exhaustively. Build an internal mental map:

- Every `*.md` file → its `title`, `tags`, `version`, `status`, and what code surface it claims to document.
- Every `_section.json` → its `title`, `tags`, `order`. Note the _conventions_ the project uses (file naming, frontmatter style, how sections are split, where Mermaid diagrams live, etc.).
- The repo's settings — `DOKAI/settings.json` — for `projectName`, `repository.structure`, workspace mappings.

This inventory is the source of truth for "what's documented today". Hold it in working memory; you'll use it in every later phase.

## Phase 2 — Inventory the codebase

Read the codebase the same way `/set-documentation` does, but with extra attention to _boundaries_:

- Workspace packages (monorepos): each one's role, public API, entry points, dependencies.
- Top-level features / domains in a single-package repo.
- Public surfaces: HTTP/RPC endpoints, CLI commands, exported library APIs.
- Critical invariants, auth flows, data models.
- Recent commits (`git log --since="3 months ago" --name-only`) — signal hotspots that may have drifted.

If `[scope]` was passed, narrow to that scope.

## Phase 3 — Compare and classify

For each item in the codebase inventory, find its match in the docs inventory. Classify:

- **Match (current)** — doc exists and prose accurately describes the current code. Skip.
- **Match (stale)** — doc exists but prose contradicts the code (renamed function, removed endpoint, changed signature, outdated diagram, etc.). Mark for **drift fix**.
- **Gap** — code surface has no covering doc. Mark for **gap fill**.

For each item in the docs inventory not yet matched, check whether it documents code that still exists. If not, mark as **orphan** (deletion candidate — but don't delete; surface to the user).

## Phase 4 — Fix drift (minimal, targeted edits)

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

## Phase 5 — Fill gaps (new docs that match existing structure)

For each _gap_, create a new doc. **Match the conventions you observed in Phase 1**:

- File location → put it where similar docs already live (e.g. if all backend services are documented under `services/<name>/overview.md` + `endpoints.md`, follow that pattern).
- File naming → use the same kebab-case conventions as siblings.
- Frontmatter → same `tags` vocabulary, same `version` start (`0.1.0`), `status: draft`.
- Section depth → don't introduce a new top-level section if the new doc fits inside an existing one.
- If a new section folder is genuinely required, also add a `_section.json` with `title`, `description`, `tags`, `version: 0.1.0`, and an `order` that fits the existing sequence.

The _structure follows the project_, not your preferences. If the project documents per-feature, do per-feature. If per-package, do per-package.

## Phase 6 — Respect settings boundaries

- Do not modify `DOKAI/user-settings.local.json`. It is a per-user file, gitignored.
- Edit `DOKAI/settings.json` only if a real shared change occurred (e.g. a workspace was added or removed and `repository.structure` needs updating). Don't gratuitously touch this file.

## What NOT to do

- Do not rewrite untouched docs.
- Do not change tags or section structure unless required by a real change.
- Do not roll back user edits to frontmatter that look intentional.
- Do not delete orphaned docs — surface them and let the user decide.
- Do not introduce new top-level sections for trivial changes — fold them into existing sections.
- Do not commit. The user runs git themselves.

## Output

After all phases, print a summary in chat (not in the docs):

### Updated (drift fixes)

- `frontend/components.md` `0.2.1 → 0.3.0` _— Button props changed; added new size variant_
- `services/auth/overview.md` `1.0.0 → 1.1.0` _— OAuth callback URL updated_

### Created (gap fills)

- `services/billing/overview.md` _— newly created, no doc previously covered this service_
- `services/billing/webhooks.md`
- `packages/shared-utils/_section.json` _— new section needed for this package_

### Orphans (manual review)

- `legacy/sso.md` _— could not find any code matching the documented `LegacySSOClient`. Possibly deleted; consider archiving or removing._

### Unchanged but worth a look (optional)

- Files you considered but didn't edit, with a one-line reason.

End with a recommendation: typically _"Review the drafts in the editor (`pnpm dokai`), then commit when satisfied."_
