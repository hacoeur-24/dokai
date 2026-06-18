# DOKAI OpenAPI Integration — v1.1.0 Design

**Status:** approved design, pre-implementation
**Date:** 2026-06-17
**Branch:** `feature/openapi`
**Target version:** 1.1.0 (all four packages bump in lockstep)

## 1. Summary

Add a **read-and-run OpenAPI explorer** to DOKAI. Users author OpenAPI/Swagger
spec files in their repo under `DOKAI/openapi/`; DOKAI scans them, lists them in
a dedicated **APIs** sidebar group (with a lock badge when a spec has secured
operations), and renders each one with **Scalar** as a full API reference plus
**try-it-out**. In `pnpm dokai` (the live dev server), requests execute for real
through a local server-side proxy that sidesteps CORS, so try-it-out works
against any backend — including `localhost` — regardless of the consumer's CORS
configuration. The static `dokai build` export renders specs read-only.

This is **not** an authoring tool: there is no in-app spec editor or no-code
builder in 1.1.0. Specs are authored as files (by hand or with help from the
`dokai` agent skill). The work is therefore (a) scanning + rendering specs and
(b) making try-it-out work in any repo.

### Key reframing

The **Authorize / bearer-token flow** and the **lock icon on secured endpoints**
are *native renderer behaviors* derived from the spec's `components.securitySchemes`
and per-operation `security`. DOKAI does not build auth UI — it feeds Scalar a
well-formed spec and Scalar provides Authorize, the lock icons, and try-it-out.
The genuine engineering is the **CORS proxy** and the **spec scanning + sidebar
integration**.

## 2. Decisions (locked)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Authoring scope | **Read + run only** | Specs authored in-repo; smallest shippable scope. No in-app editor. |
| 2 | Renderer | **Scalar** (`@scalar/api-reference`, web component) | Native `proxyUrl` solves CORS; renders as a web component → **no second React instance** (avoids DOKAI's "two Reacts under pnpm" footgun); native bearer/OAuth/API-key + `persistAuth`; OpenAPI 3.0/3.1 + Swagger 2.0; CSS-variable themeable. |
| 3 | Packaging | **Fold into existing 4 packages** | Runtime pieces are pinned to `dokai-ui` by architecture (Vite middleware + app route); only spec types/parser could be separate, not worth a 5th package's release overhead. Lockstep versioning unchanged. |
| 4 | Static build try-it-out | **Read-only in static export** | The proxy is dev-server middleware; a deployed static site has no server. Try-it-out is a `pnpm dokai` feature. Safe default; avoids leaking tokens to arbitrary hosts from a public site. |
| 5 | Specs directory | **`DOKAI/openapi/`** | Matches the consumer's existing mavira-space layout (`content/openapi/`); explicit about format. |
| 6 | Sidebar placement | **Dedicated "APIs" group** | Clear separation of prose docs vs. runnable APIs. |
| 7 | Search granularity | **One Cmd+K entry per spec** | Title + `info.description` + folded operation summaries/paths → endpoints findable by keyword without exploding the index. |

### Reference implementation studied

`novscale/mavira-space` `apps/doc` (Next.js): hand-authored specs in
`content/openapi/*.yaml`, a directory scanner (`lib/apis.ts`), a spec-serving API
route (`app/api/openapi/[...slug]/route.ts`), and `swagger-ui-react` pointed at
the spec URL. DOKAI mirrors the *file convention* but swaps the runtime
(prebuilt-bundle + Vite middleware instead of Next.js SSR) and the renderer
(Scalar instead of swagger-ui-react, for the proxy + React-isolation reasons in
decision #2).

## 3. On-disk model (the consumer's repo)

```
DOKAI/
  openapi/                   ← new scanned area (name configurable via settings)
    _section.json            ← optional: title / order / icon for the APIs group
    auth.yaml
    billing/
      payments.yaml
  settings.json              ← gains an optional "openapi" block
```

- **Scan glob:** `DOKAI/openapi/**/*.{yaml,yml,json}` (recursive, folders allowed).
- **Spec detection:** a file is treated as a spec if it parses and has a top-level
  `openapi:` or `swagger:` key. Otherwise it is recorded as a **non-fatal**
  validation error and skipped (consistent with how `loadSettings` and
  `parseDocFile` collect errors without throwing, so the dev server never crashes
  on a malformed file).
- **Token storage:** **no tokens are ever written to committed files.** The bearer
  token lives only in the browser (Scalar `persistAuth` → `localStorage` on
  `localhost:8128`). The proxy forwards the `Authorization` header but never
  persists it.

### `settings.json` → optional `openapi` block

Added to `projectSettingsSchema` (`packages/core/src/schemas/project-settings.ts`)
as a nested `.default({})` schema, mirroring the existing `theme` / `downloads` /
`repository` blocks so older `settings.json` files remain valid after upgrade:

```jsonc
"openapi": {
  "enabled": true,        // master toggle for the feature
  "dir": "openapi",       // path under DOKAI/ to scan
  "allowedHosts": [],      // extra proxy targets beyond spec servers + loopback
  "persistAuth": true      // Scalar remembers the token in browser localStorage
}
```

No secrets belong in this committed file.

## 4. Architecture integration (by layer)

### 4.1 `dokai-core` — engine (honor the browser/node hard boundary)

**Browser-safe (`src/index.ts` and `src/schemas/`):**
- `OpenApiSpecMeta` type (the sidebar/manifest unit):
  ```ts
  interface OpenApiSpecMeta {
    relativePath: string;   // e.g. "openapi/billing/payments.yaml"
    route: string;          // e.g. "/dokai/_api/billing/payments"
    title: string;          // info.title (fallback: filename)
    version: string;        // info.version (fallback: "")
    hasSecurity: boolean;   // any global or per-operation security present
    operationCount: number;
    serverHosts: string[];  // hosts from servers[] (for the proxy allowlist)
    workspace?: string;     // reuse existing matchWorkspace tagging if applicable
  }
  ```
- `openapiSettingsSchema` (Zod) merged into `projectSettingsSchema`.
- An `_api` route helper (build/parse `/dokai/_api/<relpath>` ↔ spec file path).
- **No `fs`/`yaml` imports here** — a stray Node import in `index.ts` breaks the UI
  bundle silently.

**Node-only (`src/node.ts` + new `src/openapi/`):**
- `scanOpenApiSpecs(repoRoot, dir): { specs: OpenApiSpecMeta[]; errors: ValidationError[] }`
  — fast-glob the configured dir, parse YAML/JSON (add a `yaml` dependency),
  extract only the metadata above. Scalar performs all heavy rendering; DOKAI
  reads just enough for the tree, the lock badge, the search entry, and the proxy
  allowlist. Parse failures are non-fatal.

**Manifest:** add `specs: OpenApiSpecMeta[]` to the manifest output. This is
**additive** — every existing `docs[]` / `tree` consumer is untouched.

**Search (`src/search.ts`):** index each spec as **one** MiniSearch document:
`title` + `info.description` + concatenated operation summaries and method+path
strings, with the spec route as the result target. No per-operation documents.

### 4.2 `dokai-ui` — runtime (`/api` middleware + React app)

**`/api` middleware (`packages/ui/plugin/api/index.ts`)** — follow the existing
`server.middlewares.use('/path', (req, res, next) => { … })` pattern with
`new URL(req.url ?? '/', 'http://x')`; reuse `resolveSafePath`, the JSON-body
reader, and the existing error wrapper:

- `GET /api/openapi/raw/<path>` — serve the raw spec with the correct
  content-type (`application/yaml` / `application/json`). A **dedicated** route is
  required because `/dokai-asset`'s extension allowlist excludes `.yaml`/`.json`.
  Confine IO to `DOKAI/openapi/` via `resolveSafePath`. This is the URL Scalar's
  `url` points at.
- `GET|POST|PUT|… /api/openapi/proxy?scalar_url=<url-encoded target>` —
  **dev-mode only** (gated on `mode === 'dev'`, the same gate as the write
  endpoints). Implements Scalar's proxy contract (see §5). Validates the target,
  forwards method + headers + body, returns the upstream response. Security model
  in §6. Precedent: `packages/ui/plugin/api/pdf.ts` already does allowlisted
  network egress.
- Specs reach the client through the existing `/api/manifest` response (new
  `specs` field) — no extra fetch needed for the sidebar.

**React app (`packages/ui/src/`):**
- New `OpenApiExplorer.tsx` component: renders a container `<div>` and, in a
  `useEffect`, calls
  ```ts
  Scalar.createApiReference(el, {
    url: `/api/openapi/raw/${specPath}`,
    proxyUrl: '/api/openapi/proxy',   // omitted in static build
    persistAuth: settings.openapi.persistAuth,
    // theme mapped onto DOKAI's CSS variables
  })
  ```
  and tears it down on unmount. Scalar manages its own DOM subtree — **no second
  React instance**, sidestepping the pnpm React-dedup footgun. `@scalar/api-reference`
  is a **bundled** `dokai-ui` dependency (no CDN → works offline, in any repo).
- `App.tsx` (`packages/ui/src/App.tsx`): register
  `<Route path="/dokai/_api/*" element={<OpenApiExplorer />} />` **before** the
  greedy `<Route path="/dokai/*" …>` catch-all, mirroring how `/dokai/_settings`
  is placed first, so a spec route can never collide with a markdown doc.
- `lib/api.ts`: add a typed client helper if needed (the spec list comes from the
  manifest; the raw URL is built from the route).
- `Sidebar.tsx`: render `manifest.specs` as a dedicated **APIs** group with an API
  icon; each item shows a lock icon (lucide `Lock` / `LockKeyhole`) when
  `hasSecurity` is true.
- Theme Scalar via its CSS variables mapped onto DOKAI's existing
  `--color-accent` / `--tone-*` tokens, so light/dark follows DOKAI automatically.

### 4.3 `dokai-kit` — CLI scaffolding (must stay idempotent)

- New `scaffoldOpenApiArea` step in `runInit` (`packages/cli/src/commands/init.ts`),
  after `scaffoldDokaiFolder`: seed `DOKAI/openapi/_section.json` and a sample
  `petstore.yaml` using the existing write-once / skip pattern, so re-running
  `dokai init` and `dokai update` never clobber user-edited specs (counted as
  `filesSkipped`).
- `scaffoldSettings` seeds the `openapi` settings block.

### 4.4 `dokai-ai` — agent assets

Small managed addition to the single `dokai` skill and the managed `AGENTS.md`
block: document the `DOKAI/openapi/` convention, that security comes from
`components.securitySchemes` + `security` (→ the lock icon), and that requests run
in `pnpm dokai`. This serves the "let users create specs easily" intent — an agent
can scaffold a spec on request. Slash-command parity is Claude-only and optional
for 1.1.0.

## 5. Scalar proxy contract

Scalar calls its `proxyUrl` like this (verified against Scalar docs):

```
GET|POST|… ${proxyUrl}?scalar_url=<url-encoded absolute target URL>
```

with the **original** method, headers, and body preserved. DOKAI's
`/api/openapi/proxy` handler therefore:

1. Reads `scalar_url` from the query string (the real upstream target).
2. Validates the target host against the allowlist (§6).
3. Forwards the original method, headers (including `Authorization`), and body to
   the target.
4. Streams the upstream response (status, headers, body) back to the browser.

Because DOKAI's UI and proxy are same-origin (`localhost:8128`), the browser
imposes no CORS constraint on the proxy response itself.

## 6. Security model (the local dev proxy)

The proxy runs **only** on the user's machine in `mode === 'dev'`. Because testing
local backends is the primary use case, we deliberately **do not** blanket-block
private/loopback ranges (that would break testing `localhost:3333`-style APIs).
Instead:

- **Allowlist** = loopback (`localhost` / `127.0.0.1` / `::1`)
  ∪ every scanned spec's `serverHosts`
  ∪ `settings.openapi.allowedHosts`.
  A target not on the list → `403` with a message instructing the user to add it
  to `settings.openapi.allowedHosts`.
- **Block** the cloud-metadata IP `169.254.169.254` unconditionally (cheap SSRF
  hardening; never a legitimate target).
- **Body-size caps** on both the proxied request and the response (fixes the
  unbounded request-buffering gotcha in the existing JSON-body reader).
- The proxy is **absent** in `mode === 'build'`.

## 7. Static build (`dokai build`)

The static export renders every spec read-only via Scalar with **no `proxyUrl`**,
so the Send action is inert/hidden. Full try-it-out is a `pnpm dokai` feature.
This matches decision #4 and avoids a deployed public site forwarding bearer
tokens to arbitrary hosts.

## 8. Testing strategy

**Vitest units (live next to source as `*.test.ts`):**
- Scanner: fixtures for valid spec, secured spec (`hasSecurity` true), invalid /
  non-spec file (non-fatal error, skipped), nested folders, JSON + YAML.
- Settings schema: an older `settings.json` without `openapi` still parses;
  defaults applied.
- `_api` route helper: round-trip `route ↔ path`, including nested specs.
- Proxy handler: allowlist allow + deny, `169.254.169.254` blocked, header/body
  forwarding against a mock target, body-size cap, `403` message shape, dev-only
  gate (`405`/absent in build mode).
- Manifest: includes `specs`; existing `docs[]`/`tree` shape unchanged.

**E2E smoke (after `pnpm build`):** add a sample spec to
`examples/project/DOKAI/openapi/`; confirm `dokai dev` scans it, lists it in the
APIs group, and the raw endpoint serves it. (`examples/project` is private and its
`DOKAI/` tree is committed, so this gives the dev server immediate content.)

## 9. Out of scope (YAGNI for 1.1.0)

- In-app spec editor / no-code form builder.
- Per-operation routes (Scalar handles in-page navigation and deep links via hash).
- Try-it-out on deployed static sites (decision #4).
- DOKAI-level public/secured overrides (marking is derived from the spec).
- OAuth flows beyond Scalar's built-ins.
- A standalone `dokai-openapi` npm package (decision #3).

## 10. Constraints carried from the codebase

- **Browser/node boundary in `dokai-core` is hard.** All `fs`/`yaml` work lives in
  `node.ts` / `src/openapi/`; only types and the Zod schema cross into `index.ts`.
- **Route registration order:** `/dokai/_api/*` must precede `/dokai/*` in
  `App.tsx`.
- **Raw specs must not go through `/dokai-asset`** (its allowlist excludes
  json/yaml) — use the dedicated `/api/openapi/raw` route.
- **Idempotent scaffolding:** the new init step skips existing files, like every
  other step (`dokai update` depends on it).
- **Lockstep versioning:** all four packages bump to 1.1.0 together; the
  `examples/project` fixture stays private/unpublished.
- **Preview server, not dev server:** do not touch the `vite preview` +
  `reactAliases()` arrangement in `packages/ui/plugin/index.ts`; mounting Scalar
  as a web component is specifically chosen to stay clear of the React-dedup issue.

## 11. Build sequence (high level — detailed plan follows in writing-plans)

1. `dokai-core`: `OpenApiSpecMeta` type + `openapiSettingsSchema` + `_api` route
   helper (browser-safe) → `scanOpenApiSpecs` (node) → manifest `specs` field →
   search indexing. Unit tests alongside.
2. `dokai-ui` middleware: `/api/openapi/raw` then `/api/openapi/proxy` (with the
   security model + tests).
3. `dokai-ui` app: `OpenApiExplorer` + Scalar mount + `App.tsx` route + Sidebar
   APIs group + theming.
4. `dokai-kit`: `scaffoldOpenApiArea` + settings seeding (idempotent) + sample
   spec; seed `examples/project/DOKAI/openapi/`.
5. `dokai-ai`: skill + `AGENTS.md` guidance.
6. Version bump to 1.1.0 across all four; `CHANGELOG.md`; E2E smoke.
