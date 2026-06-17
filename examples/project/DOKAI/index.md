---
title: Documentation
description: >-
  Welcome to the project documentation. Replace this content with an overview of
  your project.
tags: []
version: 0.1.0
status: draft
createdAt: '2026-06-17T20:44:40.873Z'
updatedAt: '2026-06-17T20:44:40.873Z'
---

# Documentation

This documentation is powered by **DOKAI** — local-first markdown docs with built-in search,
Mermaid diagrams, and a Claude-Code-driven authoring workflow.

## How to populate this

Two slash commands are wired up in `.claude/commands/`:

- **`/set-documentation`** — first-time deep read of the codebase. Generates the full doc tree.
  Use this when DOKAI/ is empty (or just has these seeded stubs).
- **`/update-documentation`** — incremental refresh. Compares the current docs against the
  current codebase, fixes drift, and creates new docs for undocumented areas — all
  following the structure conventions already in DOKAI/.

## Where to start

- Architecture: see `architecture/overview.md`
- Run `pnpm dokai` to launch the editor UI on http://localhost:8128
