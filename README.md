<div align="center">

# DOKAI

**Local-first documentation, dropped into any repo with one command.**

[![npm](https://img.shields.io/npm/v/dokai-kit?style=flat-square&color=2563eb)](https://www.npmjs.com/package/dokai-kit)
[![License](https://img.shields.io/npm/l/dokai-kit?style=flat-square&color=22c55e)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<sub>Built by <a href="https://github.com/hacoeur-24">hacoeur-24</a> · React 19 · Vite · Tailwind v4 · Milkdown · MiniSearch · Claude Code</sub>

</div>

---

## Contents

- [What is DOKAI?](#what-is-dokai)
- [Installation](#installation)
- [Daily commands](#daily-commands)
- [What lands in your repo](#what-lands-in-your-repo)
- [AI agent integration](#ai-agent-integration)
- [FAQ](#faq)
- [Collaborate](#collaborate)
- [License](#license)

---

## What is DOKAI?

DOKAI is an installable documentation product for any project. Run `dokai init` in a repository and you get a fully-functional, locally-served documentation site backed by a `DOKAI/` folder of markdown files — no SaaS, no external service, no engine source code dumped into your repository.

Designed to drop into:

- 📦 single-package projects (Next.js, Vite, plain Node, anything)
- 🌳 monorepos (pnpm / npm / yarn workspaces)
- ⚡ Turborepo apps
- 🧩 frontend, backend, full-stack, libraries, services

What you get from a single command:

| Feature                       | What it does                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| 📖 **Live docs UI**           | React + Tailwind UI on `localhost:8128`, served by Vite             |
| ✍️ **WYSIWYG editor**         | Milkdown rich-text editor + raw-markdown toggle                     |
| 🧭 **Auto-organized sidebar** | Workspace-aware navigation built from your folder structure         |
| 🔎 **Local search**           | MiniSearch index over titles, headings, body, tags, status, version |
| 🌗 **Light & dark themes**    | Configurable per project, overridable per user                      |
| 📊 **Mermaid diagrams**       | Inline rendering, click-to-fullscreen, SVG/PNG export               |
| 🌍 **i18n**                   | English / French UI                                                 |
| 🤖 **AI integration**         | `/set-documentation` and `/update-documentation` slash commands     |
| 📦 **Static build**           | `dokai build` produces a deployable read-only site                  |
| 🔁 **Frontmatter versioning** | Auto-bump on save (rollover semver), team-shared via Git            |

**Local-first by design.** Your docs, your repo, your Git history. The engine and UI live entirely inside the installed package; your project receives only its own data.

> Requires **Node.js 22+**.

---

## Installation

DOKAI ships as the **`dokai-kit`** package on the **public npm registry** — `npm install dokai-kit` works with zero configuration (no scope, no `.npmrc`, no auth). The package is `dokai-kit`; the CLI command it installs is **`dokai`**. Requires **Node.js 22+**.

```bash
# 1. Add dokai-kit to your project (npm / pnpm / yarn / bun all work)
pnpm add -D dokai-kit      # npm install -D dokai-kit · yarn add -D dokai-kit · bun add -d dokai-kit

# 2. Scaffold docs into the repo (idempotent — safe to re-run); the command is "dokai"
pnpm exec dokai init       # or: npx dokai-kit init

# 3. Launch the docs UI on http://localhost:8128
pnpm dokai                 # runs the "dokai dev --port 8128" script init added
```

Prefer a global install? It works from any repo with no per-project dependency:

```bash
npm install -g dokai-kit
dokai init
dokai dev                  # http://localhost:8128
```

`dokai init` detects your repo shape (single package, pnpm / npm / yarn workspaces, or Turborepo) and is fully idempotent: re-running it leaves your existing files untouched and only fills in what is missing — which is exactly how `dokai update` upgrades a project.

**Running the UI.** `dokai init` adds a `dokai` script, so:

- **pnpm / yarn:** `pnpm dokai` or `yarn dokai` (these run scripts without `run`).
- **npm:** `npm run dokai` — npm has no `npm <script>` shorthand, so `npm dokai` does **not** work; it's `npm run dokai`.
- **Directly:** bare `dokai` defaults to the dev server, so `npx dokai`, `pnpm exec dokai`, or a global `dokai` all start it too — no `dev` subcommand needed.

---

## Step-by-step setup guide

### 1. Install and scaffold

```bash
pnpm add -D dokai-kit
pnpm exec dokai init
```

**Single-package repo?** Init finishes immediately — no prompts.

**Monorepo?** DOKAI auto-detects pnpm / npm / yarn workspaces and Turborepo. It opens an interactive multiselect asking which workspace packages to map to documentation sections (Space to toggle, Enter to confirm). Accept everything at once with `--yes`, or cherry-pick up front with `--workspace <name...>`:

```bash
pnpm exec dokai init --yes                          # map all packages
pnpm exec dokai init --workspace apps/web packages/api   # pick specific ones
```

### 2. Boot the docs UI

```bash
pnpm dokai    # http://localhost:8128
```

That's the live editor — WYSIWYG + raw markdown, search, Mermaid diagrams, and the OpenAPI explorer (if you have specs in `DOKAI/openapi/`).

### 3. Generate the docs

#### Using Claude Code

After init, two slash commands are ready in Claude Code:

- **`/set-documentation`** — first-time full generation. Runs a deep read of your codebase and authors the complete `DOKAI/` markdown tree and/or OpenAPI specs. Opens with a scope prompt (**Docs** and **API endpoints**, both checked by default) so you can generate one or both.
- **`/update-documentation`** — refresh after code changes. Same scope prompt; targets drift and gaps rather than regenerating from scratch.

There is also a **`dokai` sub-agent** for hands-off authoring: ask it to "set up the DOKAI docs" or "update the API specs" and it will detect the repo shape, read the codebase, write everything, and summarize what it created or left as `TBD`.

#### Using Cursor, Codex, or any other agent

Just ask: _"set up the documentation"_ or _"update the API documentation"_ — that's it. DOKAI installed skills at `.agents/skills/dokai-docs/` and `.agents/skills/dokai-api/` that carry the full authoring and update workflows, and the repo root `AGENTS.md` points every agent there automatically.

### 4. What gets scaffolded

`dokai init` writes these into your repo:

| Path | What it is |
| ---- | ---------- |
| `DOKAI/` | Your documentation tree (markdown, committed to Git) |
| `.claude/agents/dokai.md` | Claude sub-agent for hands-off doc + API authoring |
| `.claude/commands/set-documentation.md` | `/set-documentation` slash command |
| `.claude/commands/update-documentation.md` | `/update-documentation` slash command |
| `.claude/skills/dokai-docs/` | Lean doc conventions reference for Claude |
| `.claude/skills/dokai-api/` | Lean OpenAPI conventions reference for Claude |
| `.agents/skills/dokai-docs/` | Full doc authoring skill for all other agents |
| `.agents/skills/dokai-api/` | Full OpenAPI authoring skill for all other agents |
| `CLAUDE.md` | Managed block pointing Claude at the commands + skills |
| `AGENTS.md` | Managed block pointing other agents at the skills |

`package.json` gets `dokai` scripts and `.gitignore` gets the cache patterns. Skip Claude assets with `--no-claude`, or agent assets with `--no-agents`.

---

## Daily commands

| Command          | What it does                                                                           |
| ---------------- | -------------------------------------------------------------------------------------- |
| `dokai init`     | Scaffold `DOKAI/`, `.claude/` assets, patch `package.json` scripts + `.gitignore`      |
| `dokai dev`      | Boot the live documentation UI (default port `8128`)                                   |
| `dokai build`    | Produce a static, deployable read-only site under `DOKAI/.dokai/dist/`                 |
| `dokai preview`  | Serve the most recent static build locally                                             |
| `dokai generate` | Re-emit the Claude templates and rebuild the MiniSearch index without launching the UI |
| `dokai update`   | Re-run scaffolding to pull in new files from a newer DOKAI version                     |
| `dokai bump`     | Bump frontmatter versions on docs / sections                                           |

After `dokai init`, the same commands are available as package scripts (`pnpm dokai`, `pnpm dokai:build`, `pnpm dokai:preview`, `pnpm dokai:generate`, `pnpm dokai:update`).

---

## What lands in your repo

```
your-repo/
├─ DOKAI/                           # your documentation (markdown, committed to Git)
│  ├─ index.md
│  ├─ _section.json                 # section title + ordering metadata
│  ├─ settings.json                 # project settings (committed, team-shared)
│  ├─ openapi/                      # OpenAPI specs (optional, authored by AI or by hand)
│  ├─ user-settings.local.json      # per-user overrides (gitignored)
│  └─ .dokai/                       # search index + static build cache (gitignored)
├─ .claude/
│  ├─ agents/dokai.md               # Claude sub-agent for hands-off authoring
│  ├─ commands/set-documentation.md # /set-documentation slash command
│  ├─ commands/update-documentation.md
│  ├─ skills/dokai-docs/            # doc conventions reference (Claude)
│  └─ skills/dokai-api/             # OpenAPI conventions reference (Claude)
├─ .agents/
│  └─ skills/
│     ├─ dokai-docs/                # full doc authoring skill (all other agents)
│     └─ dokai-api/                 # full OpenAPI authoring skill (all other agents)
├─ CLAUDE.md                        # managed block — points Claude at commands + skills
├─ AGENTS.md                        # managed block — points other agents at the skills
├─ package.json                     # patched with "dokai" scripts (your values preserved)
└─ .gitignore                       # patched with DOKAI cache patterns
```

Only your data lands in the repo. The engine, the React UI, and the Vite server all live inside the installed `dokai-kit` package and operate on your `DOKAI/` folder through local `/api` middleware.

---

## AI agent integration

`dokai init` makes the docs and OpenAPI workflow available to **any coding agent**, not just Claude Code:

- **Every agent** gets two focused skills: **`dokai-docs`** (documentation conventions and the author/update workflow) and **`dokai-api`** (OpenAPI spec conventions and the derive-from-code workflow), both under `.agents/skills/`. A managed block in the repo root **`AGENTS.md`** points Codex, Cursor, Gemini, and others at both skills automatically.
- **Claude Code** additionally gets a **`dokai` sub-agent** and two slash commands — **`/set-documentation`** (author from scratch) and **`/update-documentation`** (refresh after code changes). Both commands open with a scope prompt (Docs, API endpoints, or both) before running. The Claude skills under `.claude/skills/` are lean references; the slash commands and sub-agent carry the full workflow.
- **`CLAUDE.md`** (Claude-optimized) and **`AGENTS.md`** (all other agents) both receive an idempotent managed `dokai` block on init, so each agent type sees docs context in the format it reads best.

Skip the Claude assets with `dokai init --no-claude`, or the agent assets with `--no-agents`.

---

## FAQ

**Does DOKAI upload my docs anywhere?**
No. Everything is local — markdown files in your repo, served by a local Vite server. There is no SaaS and no telemetry.

**Do I need a special registry or `.npmrc`?**
No. DOKAI is published unscoped on the public npm registry as `dokai-kit`, so `npm install dokai-kit` works with zero configuration.

**I get an engine / Node version warning.**
DOKAI requires Node.js 22+. Use the bundled `.nvmrc` (`nvm use`) or upgrade Node.

**Does it work in a monorepo?**
Yes. `dokai init` detects pnpm / npm / yarn workspaces and Turborepo, and maps your workspace packages into the documentation sidebar automatically.

**How do I publish a read-only site?**
Run `dokai build` to emit a static site under `DOKAI/.dokai/dist/`, then deploy that folder anywhere (or preview it locally with `dokai preview`). `dokai build` recompiles the UI, so it needs `react` and `react-dom` resolvable — npm and pnpm install them automatically as peers, but on Yarn you may need `yarn add -D react react-dom`. (`dokai dev` and `dokai preview` use a prebuilt bundle and need nothing extra.)

**Where are my docs stored?**
As plain markdown in `DOKAI/`, committed to Git alongside your code, with full version history.

---

## Collaborate

Contributions are welcome. This repository is a **pnpm + Turborepo monorepo** that produces four published packages:

| Package         | Published as                                             | Role                                                            |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/cli`  | [`dokai-kit`](https://www.npmjs.com/package/dokai-kit)   | the `dokai` CLI (init / dev / build / generate / update / bump) |
| `packages/core` | [`dokai-core`](https://www.npmjs.com/package/dokai-core) | Engine: scan, parse, route, search, repo detection              |
| `packages/ui`   | [`dokai-ui`](https://www.npmjs.com/package/dokai-ui)     | React app + Vite plugin (the runtime)                           |
| `packages/ai`   | [`dokai-ai`](https://www.npmjs.com/package/dokai-ai)     | Agent assets: Claude commands + the agent-agnostic skill        |

### Install locally

Requires **Node.js 22+** (`.nvmrc` pins 22 — run `nvm use`) and **pnpm 10.x**.

```bash
git clone https://github.com/hacoeur-24/dokai.git
cd dokai
pnpm install      # links the four packages together via the workspace
pnpm build        # build all packages (required before running the CLI or the example)
```

### Test & check

```bash
pnpm test         # vitest across all packages
pnpm typecheck    # tsc --noEmit everywhere
pnpm lint         # eslint
pnpm format       # prettier --write   (pnpm format:check to verify)
```

Run a single package's suite with a turbo filter, e.g. `pnpm --filter dokai-core test`.

### Use the example project

`examples/project` is a **pnpm + Turborepo** workspace (with stub `apps/web` and `packages/ui-kit` packages) wired to the local build of `dokai-kit` via `workspace:^`. Use it to exercise the CLI end-to-end against a realistic monorepo without publishing anything:

```bash
pnpm build                              # make sure the local packages are built first
pnpm --filter example-project dokai     # boot the docs UI on http://localhost:8128
```

Its `DOKAI/` tree is committed, so the UI has content immediately. Other commands work the same way — `pnpm --filter example-project dokai:build`, `…:generate`, etc. To re-scaffold from scratch, delete `examples/project/DOKAI/` and run `pnpm --filter example-project exec dokai init --yes`.

To dogfood against the example as if you were a brand-new consumer (real tarballs, no workspace links), `pnpm --filter dokai-kit pack` (and the other packages) and `npm install` the resulting `.tgz` files into a scratch project.

### Contribute

1. Branch off `main`, make your change, and keep it focused.
2. Add or update tests next to the source (`*.test.ts`, Vitest).
3. Ensure `pnpm build && pnpm typecheck && pnpm lint && pnpm test` and `pnpm format:check` all pass.
4. Open a PR against `hacoeur-24/dokai` describing the change and why.

See [CLAUDE.md](./CLAUDE.md) for architecture details, conventions, and the release flow.

---

## License

[MIT](./LICENSE) © [hacoeur-24](https://github.com/hacoeur-24)
