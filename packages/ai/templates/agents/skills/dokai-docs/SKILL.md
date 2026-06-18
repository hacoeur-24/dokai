---
name: dokai-docs
description: Use when reading, writing, or updating documentation in a repository that uses DOKAI (a committed DOKAI/ markdown tree served by a local UI). Covers running the CLI, the frontmatter/section/Mermaid conventions, and the author-from-scratch and incremental-update workflows.
---

# Working with DOKAI docs

This project uses **DOKAI** for local-first documentation: a `DOKAI/` folder of markdown files,
committed to Git, served by a local web UI. The engine and UI live in the installed `dokai-kit`
package (its CLI command is `dokai`) — only the `DOKAI/` markdown is part of this repo. Your job,
as an agent, is to keep that markdown accurate, well-structured, and consistent with the code.

> **Keep the docs in sync.** Whenever you make a significant change to the codebase — a new
> feature, an API or schema change, an architecture or dependency shift, a removed module — update
> the affected docs under `DOKAI/` as part of the same change (see Workflow B below). Treat the
> docs as part of "done", not an afterthought.

## Running it

The `dokai` CLI is available once the package is installed (`dokai dev`, or `npm run dokai` /
`pnpm dokai` if the project added the script).

| Command                                   | What it does                                                    |
| ----------------------------------------- | --------------------------------------------------------------- |
| `dokai dev`                               | Live docs UI on http://localhost:8128 (read/write the markdown) |
| `dokai build`                             | Static read-only site to `DOKAI/.dokai/dist/`                   |
| `dokai preview`                           | Serve the last static build                                     |
| `dokai generate`                          | Rebuild the search index (and re-emit these agent assets)       |
| `dokai update`                            | Re-sync DOKAI-managed files after upgrading the package         |
| `dokai bump <path> <patch\|minor\|major>` | Bump a doc's or section's frontmatter version                   |

You do not need the UI running to edit docs — they are plain markdown files. Run `dokai dev` only
when you want to preview rendering, search, or diagrams.

## Conventions (follow these exactly)

**Frontmatter is mandatory.** Every `*.md` under `DOKAI/` starts with:

```yaml
---
title: <sentence-cased title>
description: <one-line summary, powers search + previews>
tags: [<area>, <subsystem>]
version: 0.1.0
status: draft # draft | review | stable | deprecated | archived
createdAt: <ISO 8601>
updatedAt: <ISO 8601>
---
```

Missing `title` or `description` fails validation. See `templates/doc-frontmatter.md` for the
canonical shape and `templates/_section.json` for section metadata.

**Sections are logical, not literal.** Group docs by product, package, feature, or domain — never
by mirroring every code folder. A folder gets a `_section.json` (`title`, `description`, `tags`,
`version`, `order`) only when it needs its own title/ordering. Match the conventions already
present in the existing `_section.json` files before inventing new ones.

**Routes are deterministic.** `DOKAI/<path>.md` → `/dokai/<path>`, with `index.md` collapsing to
its parent. Use filenames that translate cleanly to URLs (kebab-case).

**Mermaid is first-class.** Use fenced ` ```mermaid ` blocks for architecture (`flowchart`),
request/auth flows (`sequenceDiagram`), data models (`erDiagram`), and state. Don't paste images
of diagrams — Mermaid renders inline and stays searchable. Only diagram what prose explains worse.

**Settings split.** `DOKAI/settings.json` is team-shared (committed): project name, theme,
repository structure, workspace mappings. `DOKAI/user-settings.local.json` is per-user
(gitignored): personal theme, sidebar/editor preferences. Never put personal prefs in
`settings.json`, and never edit `user-settings.local.json`.

**Versioning is metadata, not Git.** Bump a doc's frontmatter `version`: `patch` for wording,
`minor` for additive content, `major` for a breaking restructure. Always refresh `updatedAt`.
Bump a `_section.json` version when a child doc takes a `major` bump.

## Workflow A — author the docs from scratch

Use when `DOKAI/` is empty or only has the init stubs (`index.md`, `architecture/overview.md`).

1. **Detect the repo shape** — read `package.json`, workspace config, `turbo.json`, lockfile. It's
   one of: normal (single package), workspaces, Turborepo, or non-Turbo monorepo.
2. **Read the codebase deliberately** — entry points, public APIs, data layer, auth, build/release,
   tests, configuration, integrations. Skip `node_modules/`, build output, and anything gitignored.
   You should be able to explain the system end-to-end before writing. Where you can't infer
   something, write `TBD: <question>` rather than guessing.
3. **Plan a logical tree** — one section per product/package/feature/service that warrants it
   (for monorepos, one per documented workspace package). Keep files focused (< ~600 lines).
4. **Write each doc** with the mandatory frontmatter, add `_section.json` for new section folders,
   and add Mermaid where it earns its place.
5. **Update `DOKAI/settings.json`** with the real project name and repository structure
   (`workspace-mapped` for monorepos), then replace the seeded `index.md` /
   `architecture/overview.md` stubs with real content.
6. Write files directly; then summarize what you created/replaced and any `TBD`s.

## Workflow B — update existing docs (drift + gaps)

Use when `DOKAI/` already has substantive content.

1. **Inventory the docs** — every `*.md`'s `title`/`tags`/`version`/`status` and what code surface
   it claims to cover; every `_section.json` and the conventions it sets.
2. **Inventory the code** the same way as Workflow A; check recent commits for hotspots.
3. **Compare and classify** each code surface: current (skip), stale (drift), or undocumented (gap).
   Docs that describe code which no longer exists are orphans.
4. **Fix drift** with minimal, targeted edits — preserve the author's voice; update prose, code
   samples, and only the diagrams that actually changed; refresh `updatedAt`; bump `version`.
5. **Fill gaps** by creating new docs that match the _existing_ structure and naming conventions —
   the structure follows the project, not your preference.
6. **Don't** rewrite untouched docs, restructure without cause, delete orphans (surface them
   instead), or modify `user-settings.local.json`. Then summarize updated/created/orphaned files.

## Anti-patterns

One massive doc; mirroring code folders 1:1; stale `updatedAt`; missing `description`; diagrams as
images; mixing the two settings files; rewriting everything on a routine update.

## Set up / Update

When asked to **set the documentation** (docs are absent or only stubs exist), follow Workflow A
above from step 1 through step 6.

When asked to **update the documentation** (docs already exist), follow Workflow B above from
step 1 through step 6.

Work directly on the `DOKAI/` markdown files — read, write, and edit them as plain text. You do
not need the UI running to do this.

When asked to "set the documentation", do this.
