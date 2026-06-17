# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

DOKAI is a public library for **local-first documentation** into any repository. A user runs `dokai init` in their project; DOKAI scaffolds a `DOKAI/` markdown tree, patches `package.json` and `.gitignore`, and from then on `pnpm dokai` boots a Vite UI on `:8128` that reads/writes those markdown files in place. **The engine and UI are never copied into the consumer's repo** — they live entirely inside the installed npm packages and operate on the consumer's `DOKAI/` folder via `/api` middleware.

This repo is the source of those packages. You can dogfood it by running `dokai init` (via the locally-built CLI) against a scratch repo or the `examples/project` fixture.

## Commands

Workspace-wide (run from repo root):

```bash
pnpm install           # node 22+ required (.nvmrc pins 22)
pnpm build             # turbo run build — builds all four packages
pnpm test              # turbo run test — vitest in all packages
pnpm typecheck
pnpm lint
pnpm format            # prettier --write
pnpm clean             # turbo clean + rm -rf node_modules
```

Single-package work (turbo filter):

```bash
pnpm --filter dokai-core test
pnpm --filter dokai-core test:watch
pnpm --filter dokai-ui dev          # vite dev server
pnpm --filter dokai build           # tsup --watch via dev script
```

Single test file: `pnpm --filter dokai-core exec vitest run src/scan.test.ts`.

End-to-end smoke against the example fixture (after `pnpm build`). `examples/project` is a **pnpm + Turborepo** workspace (stub `apps/web` + `packages/ui-kit`, a package-level `turbo.json` with `extends: ["//"]`, and `packageManager`/`workspaces` set so `detectRepo` reports `turborepo` + `pnpm`); its `DOKAI/` tree is committed, so `init` reports skips and `dev` has content immediately:

```bash
pnpm --filter example-project dokai     # boot the UI on :8128 (DOKAI/ is committed)
# or drive the built CLI directly:
cd examples/project
node ../../packages/cli/dist/index.js init --yes
node ../../packages/cli/dist/index.js dev --port 8128
```

## Architecture

Four packages, all published **unscoped to the public npm registry** (`dokai-kit` — the CLI, bin `dokai` — plus `dokai-core`, `dokai-ui`, `dokai-ai`). The unscoped name `dokai` is blocked by npm's similarity filter, so the CLI package is `dokai-kit` while its command stays `dokai`. Turborepo orchestrates the build graph; pnpm workspace links them.

```
packages/cli/   → dokai-kit   bin: dokai (commander + tsup ESM bundle)
packages/core/  → dokai-core  engine — dual entry: "." (browser-safe) and "./node"
packages/ui/    → dokai-ui    React app + Vite plugin (the runtime)
packages/ai/    → dokai-ai    agent assets: Claude commands, the dokai skill, AGENTS.md helper
```

### How a `dokai dev` invocation flows

1. `cli/src/index.ts` (commander) → `cli/src/commands/dev.ts` → calls `startDevServer({ repoRoot })` from `dokai-ui`.
2. `ui/plugin/index.ts::startDevServer` runs **`vite preview`** on the prebuilt UI bundle at `<dokai-ui-package>/dist/app/` and registers `dokaiPlugin({ mode: 'dev' })`.
3. The plugin's `configurePreviewServer` hook calls `mountDokaiApi({ server, repoRoot, mode: 'dev' })` from `ui/plugin/api/index.ts`, which mounts `/api/manifest`, `/api/doc/*`, `/api/settings`, `/api/search`, etc. on Vite's middleware stack.
4. Those handlers call into `dokai-core/node` (filesystem-touching utilities — `scanDokai`, `parseDoc`, `loadSettings`, `buildSearchIndex`) operating on `<repoRoot>/DOKAI/`.
5. The React UI in `dokai-ui/src/main.tsx` fetches from `/api/*` (see `state.tsx` and `lib/api.ts`).

**Why a preview server, not a dev server?** v0.3.6 architectural change. Compiling `src/main.tsx` on the fly inside the consumer's pnpm-symlinked `node_modules` produced two React instances ("hooks must be used inside `<DokaiProvider>`"). The fix: ship a prebuilt bundle from publish time and serve it static. `runStaticBuild` (used by `dokai build`) still compiles fresh, and aliases `react`/`react-dom` to single absolute directories via `reactAliases()` in `ui/plugin/index.ts`. **If you touch React resolution, read the long comments in that file before changing anything.**

### dokai-core: dual entry split

`packages/core/src/index.ts` is **browser-safe** — only schemas, route helpers, slug helpers, types. `packages/core/src/node.ts` is **Node-only** — `fs`, `gray-matter`, `fast-glob`. The browser bundle MUST NOT import from `./node`. tsup emits both entries (`packages/core/tsup.config.ts`). When adding a util, decide which entry it belongs in.

### dokai-ui shape (two outputs from one package)

- **`./dist/app/`** — the React app built by `vite build` (run on every publish so consumers don't recompile it).
- **`./dist/plugin/`** — the Vite plugin (`plugin/index.ts`) and `/api` middleware (`plugin/api/index.ts`), built by `tsup` with `vite`/`react`/`react-dom` externalized.

`pnpm --filter dokai-ui build` runs both: `tsup` first, then `vite build`. The `package.json` `exports` map exposes `.` (plugin), `./app` (the React entry source), and `./app-html` (`index.html`).

### Init scaffolding (CLI)

`cli/src/commands/init.ts` orchestrates `detectRepo` (from `dokai-core/node`) → `scaffoldDokaiFolder` → `scaffoldSettings` → `patchGitignore` → `patchPackageJsonScripts` → `scaffoldAgentAssets`. Each scaffold step is **idempotent**: re-running `dokai init` leaves existing files alone (counted as `filesSkipped`). When changing scaffolding behavior, preserve idempotency — the `update` command relies on it.

`scaffoldAgentAssets` (`cli/src/scaffold/agents.ts` → `dokai-ai`'s `copyAgentAssets` + `patchAgentsMd`) writes the agent-facing assets: Claude Code slash commands to `.claude/commands/` and the single agent-agnostic `dokai` skill to **both** `.claude/skills/dokai/` and `.agents/skills/dokai/`, plus an idempotent managed `dokai` block in the repo root `AGENTS.md` (the file Codex/Cursor/etc. read). Slash commands are Claude-only; every other agent works from the skill + `AGENTS.md`. `--no-claude` skips `.claude/`; `--no-agents` skips `.agents/` + `AGENTS.md`. There is exactly **one** skill (`dokai`) — it covers running the CLI, the doc conventions, and the author/update workflows; the slash commands are the richer, interactive Claude version of those same workflows.

The repo-detection logic in `core/src/detect/` distinguishes Turborepo / pnpm workspace / NextJS / single-package and feeds workspace mappings into the seeded `DOKAI/settings.json`.

## Conventions

- **TypeScript strict everywhere.** `tsconfig.base.json` sets `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `useUnknownInCatchVariables: true`. Honor these — don't disable per-file.
- **ESM only.** All packages declare `"type": "module"`. tsup outputs `format: ['esm']`. Use `.js` extensions in relative imports (TypeScript `Bundler` resolution).
- **Tests** live next to source as `*.test.ts`. Vitest, no Jest. Each package has its own `vitest.config.ts`.
- **No emojis in source code.** README uses them; code does not.
- **Versioning is locked across the four packages.** All four bump together to the same version (the example fixture is private and never published). The git tag `vX.Y.Z` triggers `.github/workflows/release.yml`, which publishes all four to the public npm registry.

## Release flow

Publishing uses **npm Trusted Publishing (OIDC)** — no long-lived npm token or repo secret.

**One-time setup** (trusted publishers can only be configured for packages that already exist, so the first release is manual):

1. Bootstrap locally — `npm login`, then `pnpm build && pnpm publish -r --access public --no-git-checks` (creates all four packages on npm).
2. On npmjs.com, for each of `dokai-kit` / `dokai-core` / `dokai-ui` / `dokai-ai`: Settings → Trusted Publisher → GitHub Actions, org `hacoeur-24`, repo `dokai`, workflow `release.yml`.

**Each release after that (the canonical, tag-driven path):**

1. Bump the four `packages/*/package.json` versions in lockstep, update `CHANGELOG.md`.
2. `git commit -am "release: vX.Y.Z" && git tag vX.Y.Z && git push origin main --tags`.
3. `.github/workflows/release.yml` runs install → build → typecheck → lint → test, then `pnpm publish -r --access public --no-git-checks --provenance`, authenticating via OIDC (`id-token: write`). `pnpm publish -r` skips private packages (root + `examples/project`) and rewrites `workspace:*` deps to resolved versions automatically.

**Constraints:** stay on **pnpm 10.x** (pinned via root `packageManager`; pnpm 11 currently regresses OIDC — pnpm/pnpm#11513) and Node ≥ 22.14 (`.nvmrc`). The same `pnpm release` script works locally for the bootstrap when you are `npm login`ed.

`scripts/pack-release.mjs` is a fallback offline packer that rewrites `workspace:*` deps to GitHub Release URL deps and produces `release/*.tgz`, for the rare case where a consumer must install via direct URL; usually you don't touch it.

## Things to remember when editing

- The Vite plugin's `reactAliases()` in `packages/ui/plugin/index.ts` is the single load-bearing fix for the "two Reacts under pnpm" bug. Don't simplify it without re-reading the comment.
- The browser/node split in `dokai-core` is a hard boundary. A stray `import 'node:fs'` in `src/index.ts` will break the UI bundle silently (it'll just throw at runtime).
- Init/update commands must stay idempotent — re-running them is part of the upgrade path (`dokai update`).
- The Vite preview server (not dev server) intentionally serves a prebuilt bundle; do not "fix" this back to a dev server.
