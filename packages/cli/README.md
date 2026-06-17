# dokai-kit

**Local-first documentation, dropped into any repo with one command.**

[![npm](https://img.shields.io/npm/v/dokai-kit?style=flat-square&color=2563eb)](https://www.npmjs.com/package/dokai-kit)
[![License](https://img.shields.io/npm/l/dokai-kit?style=flat-square&color=22c55e)](https://github.com/hacoeur-24/dokai/blob/main/LICENSE)

`dokai-kit` scaffolds a `DOKAI/` markdown tree into your project and serves a live, local documentation UI (React + Vite) on `localhost:8128`. No SaaS, no telemetry — your docs live as markdown in your repo and Git history. The engine and UI ship inside this package; only your data lands in the repo. (The package is `dokai-kit`; the CLI command it installs is `dokai`.)

> Requires **Node.js 22+**.

## Quick start

```bash
# Add dokai-kit to your project (npm / pnpm / yarn / bun)
pnpm add -D dokai-kit

# Scaffold docs (idempotent — safe to re-run); the command is "dokai"
pnpm exec dokai init       # or: npx dokai-kit init

# Launch the docs UI on http://localhost:8128
pnpm dokai                 # runs the "dokai dev --port 8128" script init added
```

Prefer global? `npm install -g dokai-kit`, then `dokai init` and `dokai dev` from any repo.

## Commands

| Command          | What it does                                                                           |
| ---------------- | -------------------------------------------------------------------------------------- |
| `dokai init`     | Scaffold `DOKAI/`, `.claude/` assets, patch `package.json` scripts + `.gitignore`      |
| `dokai dev`      | Boot the live documentation UI (default port `8128`)                                   |
| `dokai build`    | Produce a static, deployable read-only site under `DOKAI/.dokai/dist/`                 |
| `dokai preview`  | Serve the most recent static build locally                                             |
| `dokai generate` | Re-emit the Claude templates and rebuild the MiniSearch index without launching the UI |
| `dokai update`   | Re-run scaffolding to pull in new files from a newer DOKAI version                     |
| `dokai bump`     | Bump frontmatter versions on docs / sections                                           |

## Highlights

- WYSIWYG (Milkdown) + raw-markdown editing
- Workspace-aware sidebar (pnpm / npm / yarn workspaces + Turborepo)
- Local MiniSearch over titles, headings, body, tags, status, version
- Light / dark themes, Mermaid diagrams, English / French UI
- Claude Code slash commands: `/set-documentation`, `/update-documentation`
- Static build for read-only deployment

Full documentation: <https://github.com/hacoeur-24/dokai>

## License

[MIT](https://github.com/hacoeur-24/dokai/blob/main/LICENSE) © hacoeur-24
