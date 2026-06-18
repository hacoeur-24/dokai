# OpenAPI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-and-run OpenAPI explorer to DOKAI — scan OpenAPI specs from `DOKAI/openapi/`, list them in a dedicated "APIs" sidebar group, render each with the Scalar web component, and make try-it-out work in `dokai dev` via a CORS-proof local proxy.

**Architecture:** Spec types + settings schema + scanner land in `dokai-core` (honoring the browser/node split). The `dokai-ui` Vite plugin gains `/api/openapi/raw` (serve a spec) and `/api/openapi/proxy` (dev-only request forwarder), and the React app gains an `OpenApiExplorer` that mounts Scalar as a web component (no second React instance). `dokai-kit` scaffolds the area; `dokai-ai` documents it. No new package; all four bump to 1.1.0 in lockstep.

**Tech Stack:** TypeScript (strict, ESM), Zod, fast-glob, `yaml` (already a `dokai-core` dep), MiniSearch, Vite plugin middleware, React 19 + react-router, `@scalar/api-reference` ^1.60.0, Vitest (node env).

## Global Constraints

Copied verbatim from the spec and codebase; every task implicitly includes these.

- **Node ≥ 22** (`.nvmrc` = `22`); **pnpm 10.x** (`packageManager: pnpm@10.28.2`). Do not move to pnpm 11.
- **ESM only.** All relative imports use `.js` extensions (TypeScript `Bundler` resolution). `"type": "module"` everywhere.
- **TypeScript strict:** `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type` for types), `useUnknownInCatchVariables`. Do not disable per-file.
- **No emojis in source code.** (README/docs may use them; code does not.)
- **`dokai-core` browser/node boundary is hard:** `src/index.ts` must NOT import `fs`/`yaml`/`fast-glob`. Only Zod schemas, plain types, and pure helpers cross into `index.ts`. All filesystem/YAML work lives in `src/node.ts` and `src/openapi/`.
- **Lockstep versioning:** all four published packages (`dokai-core`, `dokai-ui`, `dokai-kit`, `dokai-ai`) plus the root bump together to the same version. The `examples/project` fixture is private and never published.
- **Scaffolding must stay idempotent:** every init/scaffold step skips existing files (counted as `skipped`); `dokai update`/`dokai generate` depend on this.
- **Do not touch** the `vite preview` arrangement or `reactAliases()` in `packages/ui/plugin/index.ts`. Mounting Scalar as a web component is deliberately chosen to avoid the "two Reacts under pnpm" bug.
- **Tests are pure-Node Vitest** (`environment: 'node'`, no jsdom/RTL). `dokai-ui` only includes `src/**/*.test.ts` and `plugin/**/*.test.ts` (NOT `.tsx`). Therefore: unit-test extracted pure helpers; verify React components via `pnpm typecheck` + `pnpm build` + the e2e smoke (Task 11). Never add a React component `.test.tsx` — it will not run.
- **Per-package test command:** `pnpm --filter <pkg> test` (alias for `vitest run`). Single file: `pnpm --filter <pkg> exec vitest run <path>`.

### Shared interfaces (defined in Task 1/2, consumed everywhere)

```ts
// dokai-core: src/types.ts
export interface OpenApiOperationMeta {
  method: string;   // upper-case HTTP method, e.g. "GET"
  path: string;     // e.g. "/payments"
  summary: string;  // operation summary, or ""
  secured: boolean; // operation requires auth (after global/op security resolution)
}
export interface OpenApiSpecMeta {
  relativePath: string;   // posix, relative to DOKAI/, e.g. "openapi/billing/payments.yaml"
  route: string;          // e.g. "/dokai/_api/billing/payments"
  title: string;          // info.title, fallback filename
  version: string;        // info.version, fallback ""
  description: string;    // info.description, fallback ""
  hasSecurity: boolean;   // any operation is secured
  operationCount: number;
  serverHosts: string[];  // hostnames parsed from servers[].url (or swagger 2.0 host)
  operations: OpenApiOperationMeta[];
  workspace: string | null;
}
export interface OpenApiScanError {
  relativePath: string;
  message: string;
}
```

```ts
// dokai-core: src/openapi/scan.ts (node-only)
export interface ScanOpenApiOptions { dokaiRoot: string; dir?: string; }
export interface OpenApiScanResult { specs: OpenApiSpecMeta[]; errors: OpenApiScanError[]; }
export function scanOpenApiSpecs(options: ScanOpenApiOptions): Promise<OpenApiScanResult>;
```

```ts
// dokai-core: src/route.ts (browser-safe)
export const API_ROUTE_PREFIX = '/dokai/_api';
export function openapiRouteForRelpath(relpathUnderDir: string): string;
```

---

## Task 1: dokai-core — browser-safe OpenAPI types, settings schema, route helper

**Files:**
- Create: `packages/core/src/schemas/openapi.ts`
- Modify: `packages/core/src/schemas/project-settings.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/route.ts`
- Modify: `packages/core/src/index.ts` (re-exports)
- Test: `packages/core/src/schemas/openapi.test.ts`, add cases to `packages/core/src/route.test.ts`

**Interfaces:**
- Produces: `OpenApiSpecMeta`, `OpenApiOperationMeta`, `OpenApiScanError` (types.ts); `openapiSettingsSchema`, `OpenApiSettings` (schemas/openapi.ts); `API_ROUTE_PREFIX`, `openapiRouteForRelpath` (route.ts). `projectSettingsSchema` now contains an `openapi` key.

- [ ] **Step 1: Write failing test for the settings schema and route helper**

Create `packages/core/src/schemas/openapi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openapiSettingsSchema } from './openapi.js';
import { projectSettingsSchema } from './project-settings.js';

describe('openapiSettingsSchema', () => {
  it('applies defaults when empty', () => {
    const parsed = openapiSettingsSchema.parse(undefined);
    expect(parsed).toEqual({ enabled: true, dir: 'openapi', allowedHosts: [], persistAuth: true });
  });

  it('honors overrides', () => {
    const parsed = openapiSettingsSchema.parse({ dir: 'apis', allowedHosts: ['api.example.com'] });
    expect(parsed.dir).toBe('apis');
    expect(parsed.allowedHosts).toEqual(['api.example.com']);
    expect(parsed.enabled).toBe(true);
  });
});

describe('projectSettingsSchema with openapi', () => {
  it('parses legacy settings without an openapi block and fills defaults', () => {
    const parsed = projectSettingsSchema.parse({ projectName: 'Legacy' });
    expect(parsed.openapi.dir).toBe('openapi');
    expect(parsed.openapi.enabled).toBe(true);
  });
});
```

Add to `packages/core/src/route.test.ts` (inside the existing file, new `describe`):

```ts
import { API_ROUTE_PREFIX, openapiRouteForRelpath } from './route.js';

describe('openapiRouteForRelpath', () => {
  it('builds an _api route from a dir-relative path', () => {
    expect(openapiRouteForRelpath('billing/payments')).toBe('/dokai/_api/billing/payments');
    expect(openapiRouteForRelpath('auth')).toBe('/dokai/_api/auth');
  });
  it('returns the bare prefix for an empty relpath', () => {
    expect(openapiRouteForRelpath('')).toBe(API_ROUTE_PREFIX);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter dokai-core exec vitest run src/schemas/openapi.test.ts src/route.test.ts`
Expected: FAIL — `Cannot find module './openapi.js'` and `openapiRouteForRelpath is not a function`.

- [ ] **Step 3: Create the settings schema**

Create `packages/core/src/schemas/openapi.ts`:

```ts
import { z } from 'zod';

export const openapiSettingsSchema = z
  .object({
    /** Master toggle for the OpenAPI explorer feature. */
    enabled: z.boolean().default(true),
    /** Path under DOKAI/ that holds OpenAPI spec files. */
    dir: z.string().min(1).default('openapi'),
    /** Extra hosts the try-it-out proxy may forward to, beyond loopback and spec servers. */
    allowedHosts: z.array(z.string()).default([]),
    /** Whether Scalar persists the entered auth (bearer token) in the browser. */
    persistAuth: z.boolean().default(true),
  })
  .default({});

export type OpenApiSettings = z.infer<typeof openapiSettingsSchema>;
```

- [ ] **Step 4: Wire it into project settings**

In `packages/core/src/schemas/project-settings.ts`, add the import at the top (after `import { z } from 'zod';`):

```ts
import { openapiSettingsSchema } from './openapi.js';
```

Then add the `openapi` field to `projectSettingsSchema` (after `repository: repositorySchema,`):

```ts
export const projectSettingsSchema = z
  .object({
    projectName: z.string().min(1).default('Project Documentation'),
    logo: z.string().optional(),
    theme: themeSchema,
    downloads: downloadsSchema,
    repository: repositorySchema,
    openapi: openapiSettingsSchema,
  })
  .default({});
```

- [ ] **Step 5: Add the types**

Append to `packages/core/src/types.ts`:

```ts
export interface OpenApiOperationMeta {
  /** Upper-case HTTP method, e.g. "GET". */
  method: string;
  /** Templated path, e.g. "/payments/{id}". */
  path: string;
  /** Operation summary, or "" if absent. */
  summary: string;
  /** True when the operation requires auth after resolving op-level over global security. */
  secured: boolean;
}

export interface OpenApiSpecMeta {
  /** Posix path relative to DOKAI/, e.g. "openapi/billing/payments.yaml". */
  relativePath: string;
  /** In-app route, e.g. "/dokai/_api/billing/payments". */
  route: string;
  title: string;
  version: string;
  description: string;
  /** True when any operation is secured. Drives the sidebar lock icon. */
  hasSecurity: boolean;
  operationCount: number;
  /** Hostnames parsed from servers[].url (or swagger 2.0 `host`). Feed the proxy allowlist. */
  serverHosts: string[];
  operations: OpenApiOperationMeta[];
  workspace: string | null;
}

export interface OpenApiScanError {
  relativePath: string;
  message: string;
}
```

- [ ] **Step 6: Add the route helper**

Append to `packages/core/src/route.ts`:

```ts
/** Route namespace for the OpenAPI explorer. Underscore-prefixed so it can never collide with a
 *  markdown doc route (mirrors how `/dokai/_settings` is reserved). */
export const API_ROUTE_PREFIX = '/dokai/_api';

/** Build the in-app route for a spec given its path relative to the configured openapi dir,
 *  with the extension stripped. e.g. "billing/payments" -> "/dokai/_api/billing/payments". */
export function openapiRouteForRelpath(relpathUnderDir: string): string {
  return relpathUnderDir ? `${API_ROUTE_PREFIX}/${relpathUnderDir}` : API_ROUTE_PREFIX;
}
```

- [ ] **Step 7: Re-export from the browser-safe entry**

In `packages/core/src/index.ts`, add to the existing export surface:

```ts
export { openapiSettingsSchema } from './schemas/openapi.js';
export type { OpenApiSettings } from './schemas/openapi.js';
export { API_ROUTE_PREFIX, openapiRouteForRelpath } from './route.js';
export type { OpenApiSpecMeta, OpenApiOperationMeta, OpenApiScanError } from './types.js';
```

(If `index.ts` already re-exports all of `./route.js` and `./types.js` via `export *`, only add the `schemas/openapi.js` lines and the type re-exports that are missing — check before adding to avoid duplicate-export errors.)

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter dokai-core exec vitest run src/schemas/openapi.test.ts src/route.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/schemas/openapi.ts packages/core/src/schemas/openapi.test.ts \
  packages/core/src/schemas/project-settings.ts packages/core/src/types.ts \
  packages/core/src/route.ts packages/core/src/route.test.ts packages/core/src/index.ts
git commit -m "feat(core): OpenAPI types, settings schema, _api route helper"
```

---

## Task 2: dokai-core — node-only OpenAPI spec scanner

**Files:**
- Create: `packages/core/src/openapi/scan.ts`
- Modify: `packages/core/src/node.ts` (export)
- Test: `packages/core/src/openapi/scan.test.ts`

**Interfaces:**
- Consumes: `OpenApiSpecMeta`, `OpenApiOperationMeta`, `OpenApiScanError` (Task 1, types.ts); `openapiRouteForRelpath` (Task 1, route.ts).
- Produces: `scanOpenApiSpecs(options: ScanOpenApiOptions): Promise<OpenApiScanResult>`; `ScanOpenApiOptions`, `OpenApiScanResult`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/openapi/scan.test.ts`:

```ts
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { scanOpenApiSpecs } from './scan.js';

let dokaiRoot: string;

const SECURED_SPEC = `openapi: 3.1.0
info:
  title: Billing API
  version: 2.0.0
  description: Money moves.
servers:
  - url: https://api.example.com/v1
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
security:
  - bearerAuth: []
paths:
  /payments:
    post:
      summary: Create payment
      responses: { '200': { description: ok } }
  /health:
    get:
      summary: Health
      security: []
      responses: { '200': { description: ok } }
`;

const PUBLIC_JSON = JSON.stringify({
  openapi: '3.0.3',
  info: { title: 'Public', version: '1.0.0' },
  paths: { '/ping': { get: { summary: 'Ping', responses: { '200': { description: 'ok' } } } } },
});

beforeAll(async () => {
  dokaiRoot = await mkdtemp(join(tmpdir(), 'dokai-openapi-'));
  await mkdir(join(dokaiRoot, 'openapi', 'billing'), { recursive: true });
  await writeFile(join(dokaiRoot, 'openapi', 'billing', 'payments.yaml'), SECURED_SPEC);
  await writeFile(join(dokaiRoot, 'openapi', 'public.json'), PUBLIC_JSON);
  await writeFile(join(dokaiRoot, 'openapi', 'notes.yaml'), 'just: some\nrandom: yaml\n');
});

describe('scanOpenApiSpecs', () => {
  it('finds yaml and json specs and builds metadata', async () => {
    const { specs } = await scanOpenApiSpecs({ dokaiRoot });
    const billing = specs.find((s) => s.relativePath === 'openapi/billing/payments.yaml');
    expect(billing).toBeDefined();
    expect(billing?.route).toBe('/dokai/_api/billing/payments');
    expect(billing?.title).toBe('Billing API');
    expect(billing?.version).toBe('2.0.0');
    expect(billing?.serverHosts).toContain('api.example.com');
    expect(billing?.operationCount).toBe(2);
    expect(billing?.hasSecurity).toBe(true);
    const post = billing?.operations.find((o) => o.method === 'POST' && o.path === '/payments');
    expect(post?.secured).toBe(true);
    const health = billing?.operations.find((o) => o.path === '/health');
    expect(health?.secured).toBe(false); // op-level security: [] overrides global
  });

  it('treats a public json spec as not secured', async () => {
    const { specs } = await scanOpenApiSpecs({ dokaiRoot });
    const pub = specs.find((s) => s.relativePath === 'openapi/public.json');
    expect(pub?.hasSecurity).toBe(false);
    expect(pub?.route).toBe('/dokai/_api/public');
  });

  it('records non-spec files as errors without throwing', async () => {
    const { specs, errors } = await scanOpenApiSpecs({ dokaiRoot });
    expect(specs.some((s) => s.relativePath === 'openapi/notes.yaml')).toBe(false);
    expect(errors.some((e) => e.relativePath === 'openapi/notes.yaml')).toBe(true);
  });

  it('returns empty results when the dir is absent', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'dokai-empty-'));
    const { specs, errors } = await scanOpenApiSpecs({ dokaiRoot: empty });
    expect(specs).toEqual([]);
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter dokai-core exec vitest run src/openapi/scan.test.ts`
Expected: FAIL — `Cannot find module './scan.js'`.

- [ ] **Step 3: Implement the scanner**

Create `packages/core/src/openapi/scan.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import { parse as parseYaml } from 'yaml';
import type {
  OpenApiOperationMeta,
  OpenApiScanError,
  OpenApiSpecMeta,
} from '../types.js';
import { openapiRouteForRelpath } from '../route.js';

export interface ScanOpenApiOptions {
  dokaiRoot: string;
  /** Path under DOKAI/ to scan. Defaults to "openapi". */
  dir?: string;
}

export interface OpenApiScanResult {
  specs: OpenApiSpecMeta[];
  errors: OpenApiScanError[];
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

type Json = Record<string, unknown>;
function asObject(value: unknown): Json | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function hostsFromServers(doc: Json): string[] {
  const hosts = new Set<string>();
  const servers = doc['servers'];
  if (Array.isArray(servers)) {
    for (const entry of servers) {
      const server = asObject(entry);
      const url = server?.['url'];
      if (typeof url === 'string') {
        try {
          hosts.add(new URL(url, 'http://localhost').hostname);
        } catch {
          /* templated/relative url that won't parse — skip */
        }
      }
    }
  } else if (typeof doc['host'] === 'string') {
    // Swagger 2.0
    try {
      hosts.add(new URL(`http://${doc['host'] as string}`).hostname);
    } catch {
      /* skip */
    }
  }
  return [...hosts];
}

function collectOperations(doc: Json): OpenApiOperationMeta[] {
  const out: OpenApiOperationMeta[] = [];
  const globalSecurity = Array.isArray(doc['security']) ? (doc['security'] as unknown[]) : null;
  const paths = asObject(doc['paths']);
  if (!paths) return out;
  for (const [path, pathItemRaw] of Object.entries(paths)) {
    const pathItem = asObject(pathItemRaw);
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const op = asObject(pathItem[method]);
      if (!op) continue;
      const opSecurity = op['security'];
      const secured = Array.isArray(opSecurity)
        ? opSecurity.length > 0 // op-level overrides global, including [] meaning public
        : !!globalSecurity && globalSecurity.length > 0;
      out.push({
        method: method.toUpperCase(),
        path,
        summary: typeof op['summary'] === 'string' ? op['summary'] : '',
        secured,
      });
    }
  }
  return out;
}

export async function scanOpenApiSpecs(options: ScanOpenApiOptions): Promise<OpenApiScanResult> {
  const dir = options.dir ?? 'openapi';
  const matches = await fg([`${dir}/**/*.{yaml,yml,json}`], {
    cwd: options.dokaiRoot,
    dot: false,
    onlyFiles: true,
    ignore: ['node_modules/**', '.dokai/**'],
  });

  const specs: OpenApiSpecMeta[] = [];
  const errors: OpenApiScanError[] = [];

  for (const relativePath of matches.sort()) {
    const absolute = join(options.dokaiRoot, relativePath);
    let doc: Json | null;
    try {
      doc = asObject(parseYaml(await readFile(absolute, 'utf8')));
    } catch (err: unknown) {
      errors.push({ relativePath, message: err instanceof Error ? err.message : String(err) });
      continue;
    }
    if (!doc || (!('openapi' in doc) && !('swagger' in doc))) {
      errors.push({ relativePath, message: 'Not an OpenAPI/Swagger document (no openapi/swagger key)' });
      continue;
    }

    const info = asObject(doc['info']) ?? {};
    const relpathUnderDir = relativePath
      .slice(dir.length + 1)
      .replace(/\.(ya?ml|json)$/i, '');
    const operations = collectOperations(doc);
    const filename = relativePath.split('/').pop() ?? relativePath;

    specs.push({
      relativePath,
      route: openapiRouteForRelpath(relpathUnderDir),
      title: typeof info['title'] === 'string' ? info['title'] : filename,
      version: typeof info['version'] === 'string' ? info['version'] : '',
      description: typeof info['description'] === 'string' ? info['description'] : '',
      hasSecurity: operations.some((o) => o.secured),
      operationCount: operations.length,
      serverHosts: hostsFromServers(doc),
      operations,
      workspace: null,
    });
  }

  return { specs, errors };
}
```

- [ ] **Step 4: Export from the node entry**

In `packages/core/src/node.ts`, add:

```ts
export { scanOpenApiSpecs } from './openapi/scan.js';
export type { ScanOpenApiOptions, OpenApiScanResult } from './openapi/scan.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter dokai-core exec vitest run src/openapi/scan.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/openapi/scan.ts packages/core/src/openapi/scan.test.ts packages/core/src/node.ts
git commit -m "feat(core): scanOpenApiSpecs — scan DOKAI/openapi specs into metadata"
```

---

## Task 3: dokai-core — index OpenAPI specs in search

**Files:**
- Modify: `packages/core/src/search.ts`
- Test: add a case to `packages/core/src/search.test.ts`

**Interfaces:**
- Consumes: `OpenApiSpecMeta` (Task 1); existing `SearchDocument`, `SectionNode`, `buildSearchIndex`.
- Produces: `buildSearchIndex(sectionTree, outputPath, options?: { specs?: OpenApiSpecMeta[] })` — third optional arg is additive and backward compatible.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/search.test.ts` (new `describe`; reuse the file's existing imports for `buildSearchIndex`, tmp dir, etc. — add `OpenApiSpecMeta` to the type import from `./types.js` if needed):

```ts
import type { OpenApiSpecMeta } from './types.js';

describe('buildSearchIndex with specs', () => {
  it('adds one search document per spec', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dokai-search-specs-'));
    const emptyTree = {
      relativePath: '',
      absolutePath: dir,
      metadata: null,
      sections: [],
      docs: [],
    };
    const specs: OpenApiSpecMeta[] = [
      {
        relativePath: 'openapi/billing.yaml',
        route: '/dokai/_api/billing',
        title: 'Billing API',
        version: '2.0.0',
        description: 'Money moves.',
        hasSecurity: true,
        operationCount: 1,
        serverHosts: ['api.example.com'],
        operations: [{ method: 'POST', path: '/payments', summary: 'Create payment', secured: true }],
        workspace: null,
      },
    ];
    const file = await buildSearchIndex(emptyTree, join(dir, 'index.json'), { specs });
    const doc = file.documents.find((d) => d.route === '/dokai/_api/billing');
    expect(doc?.title).toBe('Billing API');
    expect(doc?.body).toContain('POST /payments');
    expect(doc?.folderTitle).toBe('APIs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter dokai-core exec vitest run src/search.test.ts`
Expected: FAIL — `buildSearchIndex` does not accept a third argument / no spec document found.

- [ ] **Step 3: Implement**

In `packages/core/src/search.ts`, add the import (with the other type imports):

```ts
import type { DocNode, OpenApiSpecMeta, SectionNode } from './types.js';
```

Add a converter near `toSearchDocument`:

```ts
function specToSearchDocument(spec: OpenApiSpecMeta): SearchDocument {
  return {
    id: spec.route,
    title: spec.title,
    description: spec.description,
    tags: ['api'],
    version: spec.version,
    package: spec.workspace,
    route: spec.route,
    folderPath: 'openapi',
    folderTitle: 'APIs',
    headings: spec.operations.map((o) => `${o.method} ${o.path}`).join('\n'),
    body: spec.operations.map((o) => `${o.method} ${o.path} ${o.summary}`.trim()).join('\n'),
  };
}
```

Change the `buildSearchIndex` signature and body to accept and append specs:

```ts
export async function buildSearchIndex(
  sectionTree: SectionNode,
  outputPath: string,
  options: { specs?: OpenApiSpecMeta[] } = {},
): Promise<SearchIndexFile> {
  const documents = collectDocuments(sectionTree);
  for (const spec of options.specs ?? []) documents.push(specToSearchDocument(spec));
  // ...rest unchanged (tags/statuses loop, MiniSearch, write file)...
```

(Leave the rest of the function body exactly as it is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter dokai-core exec vitest run src/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/search.ts packages/core/src/search.test.ts
git commit -m "feat(core): index OpenAPI specs as one search entry each"
```

---

## Task 4: dokai-ui plugin — /api/openapi/raw + manifest specs + search-index wiring

**Files:**
- Modify: `packages/ui/plugin/api/index.ts`
- Modify: `packages/cli/src/commands/generate.ts` (search index now includes specs)
- Test: `packages/ui/plugin/api/openapi-raw.test.ts` (pure path/content-type helper)

**Interfaces:**
- Consumes: `scanOpenApiSpecs` (Task 2), `loadSettings`, `buildSearchIndex` (Task 3), existing `wrap`, `sendError`, `resolveSafePath`, `collectDocSummaries`, `scanDokai`, `defaultSearchIndexPath`.
- Produces: `GET /api/openapi/raw?path=<rel>`; manifest response now `{ tree, docs, specs, capabilities: { tryItOut } }`; an exported pure helper `resolveSpecContentType(relPath: string): string | null`.

- [ ] **Step 1: Write the failing test for the content-type helper**

Create `packages/ui/plugin/api/openapi-raw.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveSpecContentType } from './openapi-raw.js';

describe('resolveSpecContentType', () => {
  it('maps yaml/yml to application/yaml', () => {
    expect(resolveSpecContentType('openapi/auth.yaml')).toBe('application/yaml; charset=utf-8');
    expect(resolveSpecContentType('openapi/auth.yml')).toBe('application/yaml; charset=utf-8');
  });
  it('maps json to application/json', () => {
    expect(resolveSpecContentType('openapi/auth.json')).toBe('application/json; charset=utf-8');
  });
  it('rejects other extensions', () => {
    expect(resolveSpecContentType('openapi/secret.env')).toBeNull();
    expect(resolveSpecContentType('openapi/auth')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter dokai-ui exec vitest run plugin/api/openapi-raw.test.ts`
Expected: FAIL — `Cannot find module './openapi-raw.js'`.

- [ ] **Step 3: Create the pure helper**

Create `packages/ui/plugin/api/openapi-raw.ts`:

```ts
/** Content-type for a spec file by extension, or null if the extension is not an allowed spec. */
export function resolveSpecContentType(relPath: string): string | null {
  const ext = (relPath.split('.').pop() ?? '').toLowerCase();
  if (ext === 'yaml' || ext === 'yml') return 'application/yaml; charset=utf-8';
  if (ext === 'json') return 'application/json; charset=utf-8';
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter dokai-ui exec vitest run plugin/api/openapi-raw.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the raw handler + manifest specs into the middleware**

In `packages/ui/plugin/api/index.ts`:

Add to the imports from `dokai-core/node` (the existing import block that already includes `scanDokai`, `loadSettings`, `buildSearchIndex`, `defaultSearchIndexPath`):

```ts
import { scanOpenApiSpecs } from 'dokai-core/node';
```

Add the local helper import at the top of the file (with the other `./` imports):

```ts
import { resolveSpecContentType } from './openapi-raw.js';
```

Replace the `/api/manifest` handler with the specs-aware version:

```ts
server.middlewares.use(
  '/api/manifest',
  wrap(async (_req, res) => {
    const tree = await scanDokai({ dokaiRoot });
    const loaded = await loadSettings(dokaiRoot);
    const { specs } = loaded.project.openapi.enabled
      ? await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir })
      : { specs: [] };
    sendJson(res, {
      tree,
      docs: collectDocSummaries(tree),
      specs,
      capabilities: { tryItOut: mode === 'dev' },
    });
  }),
);
```

Add the raw handler immediately after the `/api/doc/raw` handler (and before `/api/doc`):

```ts
server.middlewares.use(
  '/api/openapi/raw',
  wrap(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const rel = url.searchParams.get('path');
    if (!rel) return sendError(res, 400, 'Missing ?path=');
    const contentType = resolveSpecContentType(rel);
    if (!contentType) return sendError(res, 400, 'Spec path must be .yaml/.yml/.json');
    const target = resolveSafePath(dokaiRoot, rel);
    if (!target || !existsSync(target)) return sendError(res, 404, `No spec at "${rel}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(target).pipe(res);
  }),
);
```

Update the `/api/search-index` handler so the index includes specs. Replace its body line that calls `buildSearchIndex(tree, defaultSearchIndexPath(dokaiRoot))` with:

```ts
const tree = await scanDokai({ dokaiRoot });
const loaded = await loadSettings(dokaiRoot);
const { specs } = loaded.project.openapi.enabled
  ? await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir })
  : { specs: [] };
const file = await buildSearchIndex(tree, defaultSearchIndexPath(dokaiRoot), { specs });
```

(`existsSync`, `createReadStream` are already imported in this file for `/api/doc/raw`; confirm and reuse — do not re-import.)

- [ ] **Step 6: Wire specs into the CLI search index too**

In `packages/cli/src/commands/generate.ts`, update the import and the search block:

```ts
import {
  scanDokai,
  buildSearchIndex,
  defaultSearchIndexPath,
  loadSettings,
  scanOpenApiSpecs,
} from 'dokai-core/node';
```

Replace the `if (!options.noSearch) { ... }` body with:

```ts
if (!options.noSearch) {
  const tree = await scanDokai({ dokaiRoot });
  const loaded = await loadSettings(dokaiRoot);
  const { specs } = loaded.project.openapi.enabled
    ? await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir })
    : { specs: [] };
  const indexPath = defaultSearchIndexPath(dokaiRoot);
  const index = await buildSearchIndex(tree, indexPath, { specs });
  log.success(`Built search index (${index.documents.length} docs) → ${indexPath}`);
}
```

- [ ] **Step 7: Typecheck + run the ui test**

Run: `pnpm --filter dokai-ui exec vitest run plugin/api/openapi-raw.test.ts && pnpm --filter dokai-ui typecheck && pnpm --filter dokai-kit typecheck`
Expected: PASS / no type errors. (`dokai-core` must be built first if typecheck resolves from `dist` — run `pnpm --filter dokai-core build` if the import of `scanOpenApiSpecs` is unresolved.)

- [ ] **Step 8: Commit**

```bash
git add packages/ui/plugin/api/openapi-raw.ts packages/ui/plugin/api/openapi-raw.test.ts \
  packages/ui/plugin/api/index.ts packages/cli/src/commands/generate.ts
git commit -m "feat(ui): serve raw specs, add specs+capabilities to manifest, index specs"
```

---

## Task 5: dokai-ui plugin — dev-only try-it-out proxy

**Files:**
- Create: `packages/ui/plugin/api/openapi-proxy.ts` (pure, testable helpers)
- Modify: `packages/ui/plugin/api/index.ts` (mount the proxy route)
- Test: `packages/ui/plugin/api/openapi-proxy.test.ts`

**Interfaces:**
- Consumes: `scanOpenApiSpecs`, `loadSettings`; existing `wrap`, `sendError`.
- Produces: `ANY /api/openapi/proxy?scalar_url=<target>` (dev-only); pure helpers `parseTargetUrl`, `buildAllowedHosts`, `isHostAllowed`, `filterForwardHeaders`, `readRawBody`.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/plugin/api/openapi-proxy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildAllowedHosts,
  filterForwardHeaders,
  isHostAllowed,
  parseTargetUrl,
  readRawBody,
} from './openapi-proxy.js';

describe('parseTargetUrl', () => {
  it('accepts http/https', () => {
    expect(parseTargetUrl('https://api.example.com/x')?.hostname).toBe('api.example.com');
    expect(parseTargetUrl('http://localhost:3000/x')?.hostname).toBe('localhost');
  });
  it('rejects non-http and garbage', () => {
    expect(parseTargetUrl('ftp://x/y')).toBeNull();
    expect(parseTargetUrl('not a url')).toBeNull();
    expect(parseTargetUrl(null)).toBeNull();
  });
});

describe('isHostAllowed', () => {
  const allowed = buildAllowedHosts({ settingsHosts: ['Api.Example.com'], specHosts: ['svc.local'] });
  it('always allows loopback', () => {
    expect(isHostAllowed('localhost', allowed)).toBe(true);
    expect(isHostAllowed('127.0.0.1', allowed)).toBe(true);
  });
  it('allows configured + spec hosts (case-insensitive)', () => {
    expect(isHostAllowed('api.example.com', allowed)).toBe(true);
    expect(isHostAllowed('svc.local', allowed)).toBe(true);
  });
  it('blocks the cloud metadata IP even if listed', () => {
    const withMeta = buildAllowedHosts({ settingsHosts: ['169.254.169.254'], specHosts: [] });
    expect(isHostAllowed('169.254.169.254', withMeta)).toBe(false);
  });
  it('denies unknown hosts', () => {
    expect(isHostAllowed('evil.example.org', allowed)).toBe(false);
  });
});

describe('filterForwardHeaders', () => {
  it('keeps authorization, drops hop-by-hop and host', () => {
    const out = filterForwardHeaders({
      host: 'localhost:8128',
      connection: 'keep-alive',
      'content-length': '10',
      authorization: 'Bearer abc',
      'content-type': 'application/json',
    });
    expect(out['authorization']).toBe('Bearer abc');
    expect(out['content-type']).toBe('application/json');
    expect(out['host']).toBeUndefined();
    expect(out['connection']).toBeUndefined();
    expect(out['content-length']).toBeUndefined();
  });
});

describe('readRawBody', () => {
  async function* gen(parts: string[]) {
    for (const p of parts) yield Buffer.from(p);
  }
  it('concatenates chunks', async () => {
    const buf = await readRawBody(gen(['ab', 'cd']) as AsyncIterable<Buffer>, 1024);
    expect(buf.toString('utf8')).toBe('abcd');
  });
  it('throws past the cap', async () => {
    await expect(readRawBody(gen(['abcdef']) as AsyncIterable<Buffer>, 3)).rejects.toThrow(/too large/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter dokai-ui exec vitest run plugin/api/openapi-proxy.test.ts`
Expected: FAIL — `Cannot find module './openapi-proxy.js'`.

- [ ] **Step 3: Implement the helpers**

Create `packages/ui/plugin/api/openapi-proxy.ts`:

```ts
import type { IncomingHttpHeaders } from 'node:http';

/** Cloud-metadata IP — never a legitimate proxy target. */
const BLOCKED_HOSTS = new Set(['169.254.169.254']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
/** Hop-by-hop / connection headers we must not forward. */
const DROP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'accept-encoding',
]);

/** Parse and validate the Scalar `scalar_url` target. Returns null when missing/invalid. */
export function parseTargetUrl(scalarUrl: string | null): URL | null {
  if (!scalarUrl) return null;
  try {
    const url = new URL(scalarUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function buildAllowedHosts(opts: { settingsHosts: string[]; specHosts: string[] }): Set<string> {
  const set = new Set<string>();
  for (const h of opts.settingsHosts) set.add(h.toLowerCase());
  for (const h of opts.specHosts) set.add(h.toLowerCase());
  return set;
}

export function isHostAllowed(host: string, allowed: ReadonlySet<string>): boolean {
  const h = host.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return false;
  if (LOOPBACK.has(h)) return true;
  return allowed.has(h);
}

export function filterForwardHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (DROP_HEADERS.has(key.toLowerCase())) continue;
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(', ');
  }
  return out;
}

/** Read a request body into a Buffer, throwing if it exceeds maxBytes. */
export async function readRawBody(req: AsyncIterable<Buffer>, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter dokai-ui exec vitest run plugin/api/openapi-proxy.test.ts`
Expected: PASS.

- [ ] **Step 5: Mount the proxy route**

In `packages/ui/plugin/api/index.ts`, add the import:

```ts
import {
  buildAllowedHosts,
  filterForwardHeaders,
  isHostAllowed,
  parseTargetUrl,
  readRawBody,
} from './openapi-proxy.js';
```

Add this handler after the `/api/repo` handler and before the `/dokai-asset` handler:

```ts
server.middlewares.use(
  '/api/openapi/proxy',
  wrap(async (req, res) => {
    if (mode !== 'dev') return sendError(res, 405, 'Try-it-out is only available in `dokai dev`');
    const url = new URL(req.url ?? '/', 'http://x');
    const target = parseTargetUrl(url.searchParams.get('scalar_url'));
    if (!target) return sendError(res, 400, 'Missing or invalid ?scalar_url=');

    const loaded = await loadSettings(dokaiRoot);
    const { specs } = await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir });
    const allowed = buildAllowedHosts({
      settingsHosts: loaded.project.openapi.allowedHosts,
      specHosts: specs.flatMap((s) => s.serverHosts),
    });
    if (!isHostAllowed(target.hostname, allowed)) {
      return sendError(
        res,
        403,
        `Host "${target.hostname}" is not allowed. Add it to settings.json openapi.allowedHosts.`,
      );
    }

    const method = (req.method ?? 'GET').toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const body = hasBody ? await readRawBody(req, 10 * 1024 * 1024) : undefined;

    const upstream = await fetch(target, {
      method,
      headers: filterForwardHeaders(req.headers),
      body,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = upstream.status;
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-store');
    res.end(buf);
  }),
);
```

(`fetch` is global in Node ≥ 22 — no import. `loadSettings` and `scanOpenApiSpecs` are already imported from Task 4.)

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter dokai-ui typecheck`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/plugin/api/openapi-proxy.ts packages/ui/plugin/api/openapi-proxy.test.ts packages/ui/plugin/api/index.ts
git commit -m "feat(ui): dev-only try-it-out proxy with host allowlist + SSRF guard"
```

---

## Task 6: dokai-ui app — OpenApiExplorer (Scalar) + route + client types

**Files:**
- Modify: `packages/ui/package.json` (add `@scalar/api-reference`)
- Create: `packages/ui/src/lib/openapi.ts` (pure helpers)
- Create: `packages/ui/src/lib/openapi.test.ts`
- Create: `packages/ui/src/components/OpenApiExplorer.tsx`
- Create: `packages/ui/src/scalar.d.ts` (CSS module ambient)
- Modify: `packages/ui/src/lib/api.ts` (Manifest type)
- Modify: `packages/ui/src/App.tsx` (route before the catch-all)

**Interfaces:**
- Consumes: `useManifest`, `useSettings` (state.tsx); `OpenApiSpecMeta` (dokai-core); `createApiReference` (@scalar/api-reference).
- Produces: `rawSpecUrl`, `buildScalarConfig`, `findSpecByRoute` (lib/openapi.ts); `OpenApiExplorer` component; `Manifest` now has `specs: OpenApiSpecMeta[]` and `capabilities: { tryItOut: boolean }`.

- [ ] **Step 1: Add the dependency**

In `packages/ui/package.json`, add to `dependencies` (alongside the others — keep insertion tidy):

```json
"@scalar/api-reference": "^1.60.0",
```

Run: `pnpm install`
Expected: lockfile updates, `@scalar/api-reference` resolves.

- [ ] **Step 2: Write the failing test for the pure helpers**

Create `packages/ui/src/lib/openapi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { OpenApiSpecMeta } from 'dokai-core';
import { buildScalarConfig, findSpecByRoute, rawSpecUrl } from './openapi.js';

const spec: OpenApiSpecMeta = {
  relativePath: 'openapi/billing/payments.yaml',
  route: '/dokai/_api/billing/payments',
  title: 'Billing',
  version: '1.0.0',
  description: '',
  hasSecurity: true,
  operationCount: 1,
  serverHosts: ['api.example.com'],
  operations: [],
  workspace: null,
};

describe('rawSpecUrl', () => {
  it('encodes the relative path', () => {
    expect(rawSpecUrl('openapi/billing/payments.yaml')).toBe(
      '/api/openapi/raw?path=openapi%2Fbilling%2Fpayments.yaml',
    );
  });
});

describe('buildScalarConfig', () => {
  it('uses the proxy when try-it-out is available', () => {
    const cfg = buildScalarConfig({ rawUrl: '/x', tryItOut: true, persistAuth: true });
    expect(cfg['proxyUrl']).toBe('/api/openapi/proxy');
    expect(cfg['hideTestRequestButton']).toBeUndefined();
    expect(cfg['persistAuth']).toBe(true);
  });
  it('hides the Send button in read-only mode', () => {
    const cfg = buildScalarConfig({ rawUrl: '/x', tryItOut: false, persistAuth: false });
    expect(cfg['proxyUrl']).toBeUndefined();
    expect(cfg['hideTestRequestButton']).toBe(true);
  });
});

describe('findSpecByRoute', () => {
  it('finds by exact route', () => {
    expect(findSpecByRoute([spec], '/dokai/_api/billing/payments')).toBe(spec);
    expect(findSpecByRoute([spec], '/dokai/_api/other')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter dokai-ui exec vitest run src/lib/openapi.test.ts`
Expected: FAIL — `Cannot find module './openapi.js'`.

- [ ] **Step 4: Implement the pure helpers**

Create `packages/ui/src/lib/openapi.ts`:

```ts
import type { OpenApiSpecMeta } from 'dokai-core';

/** Build the raw-spec URL served by the dev/preview server's /api/openapi/raw route. */
export function rawSpecUrl(relativePath: string): string {
  return `/api/openapi/raw?path=${encodeURIComponent(relativePath)}`;
}

export interface ScalarConfigInput {
  rawUrl: string;
  tryItOut: boolean;
  persistAuth: boolean;
}

/** Scalar configuration: proxy + try-it-out in dev; read-only (Send hidden) otherwise. */
export function buildScalarConfig(input: ScalarConfigInput): Record<string, unknown> {
  const config: Record<string, unknown> = {
    url: input.rawUrl,
    persistAuth: input.persistAuth,
    // Let DOKAI's CSS variables drive colors instead of a baked Scalar theme.
    theme: 'none',
  };
  if (input.tryItOut) {
    config['proxyUrl'] = '/api/openapi/proxy';
  } else {
    config['hideTestRequestButton'] = true;
  }
  return config;
}

export function findSpecByRoute(specs: OpenApiSpecMeta[], route: string): OpenApiSpecMeta | null {
  return specs.find((s) => s.route === route) ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter dokai-ui exec vitest run src/lib/openapi.test.ts`
Expected: PASS.

- [ ] **Step 6: Extend the Manifest type**

In `packages/ui/src/lib/api.ts`, add `OpenApiSpecMeta` to the existing `dokai-core` type import, then extend `Manifest`:

```ts
import type { DocNode, SectionNode, OpenApiSpecMeta } from 'dokai-core';

export interface Manifest {
  tree: SectionNode;
  docs: Array<Pick<DocNode, 'route' | 'frontmatter' | 'workspace' | 'relativePath'>>;
  specs: OpenApiSpecMeta[];
  capabilities: { tryItOut: boolean };
}
```

- [ ] **Step 7: Add the CSS ambient declaration**

Create `packages/ui/src/scalar.d.ts`:

```ts
declare module '@scalar/api-reference/style.css';
```

(`createApiReference` itself is typed by the package; only the CSS side-effect import needs declaring.)

- [ ] **Step 8: Create the explorer component**

Create `packages/ui/src/components/OpenApiExplorer.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { createApiReference } from '@scalar/api-reference';
import '@scalar/api-reference/style.css';
import { useManifest, useSettings } from '../state.js';
import { buildScalarConfig, findSpecByRoute, rawSpecUrl } from '../lib/openapi.js';

export function OpenApiExplorer() {
  const params = useParams<{ '*': string }>();
  const subpath = params['*'] ?? '';
  const route = subpath ? `/dokai/_api/${subpath}` : '/dokai/_api';

  const manifest = useManifest();
  const settings = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const spec = useMemo(
    () => (manifest.data ? findSpecByRoute(manifest.data.specs, route) : null),
    [manifest.data, route],
  );
  const tryItOut = manifest.data?.capabilities.tryItOut ?? false;
  const persistAuth = settings.data?.project.openapi.persistAuth ?? true;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !spec) return;
    const app = createApiReference(
      el,
      buildScalarConfig({ rawUrl: rawSpecUrl(spec.relativePath), tryItOut, persistAuth }),
    );
    return () => {
      app.destroy();
    };
  }, [spec, tryItOut, persistAuth]);

  if (manifest.data && !spec) {
    return <p style={{ color: 'var(--color-fg-subtle)' }}>No API spec found for {route}.</p>;
  }
  return <div ref={containerRef} className="dokai-openapi-explorer" />;
}
```

- [ ] **Step 9: Register the route before the catch-all**

In `packages/ui/src/App.tsx`, import the explorer and add its route inside `<Route element={<Layout />}>`, BEFORE the `/dokai/*` route:

```tsx
import { OpenApiExplorer } from './components/OpenApiExplorer.js';
// ...
<Route element={<Layout />}>
  <Route path="/dokai/_settings" element={<SettingsView />} />
  <Route path="/dokai/_api/*" element={<OpenApiExplorer />} />
  <Route path="/dokai/*" element={<DocOrEditor />} />
</Route>
```

- [ ] **Step 10: Typecheck**

Run: `pnpm --filter dokai-core build && pnpm --filter dokai-ui typecheck`
Expected: no type errors. (Build core first so `OpenApiSpecMeta` resolves from `dokai-core`'s dist types.)
If TypeScript reports `createApiReference` as untyped (`any`), add to `packages/ui/src/scalar.d.ts`:

```ts
declare module '@scalar/api-reference' {
  export interface ApiReferenceInstance {
    destroy(): void;
    updateConfiguration(config: Record<string, unknown>): void;
  }
  export function createApiReference(
    el: Element | string,
    config: Record<string, unknown>,
  ): ApiReferenceInstance;
}
```
…and re-run typecheck. (Only add this block if the package's own types do not resolve — a duplicate ambient declaration errors otherwise.)

- [ ] **Step 11: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml packages/ui/src/lib/openapi.ts \
  packages/ui/src/lib/openapi.test.ts packages/ui/src/components/OpenApiExplorer.tsx \
  packages/ui/src/scalar.d.ts packages/ui/src/lib/api.ts packages/ui/src/App.tsx
git commit -m "feat(ui): OpenApiExplorer mounting Scalar + /dokai/_api route"
```

---

## Task 7: dokai-ui app — dedicated "APIs" sidebar group

**Files:**
- Modify: `packages/ui/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `useManifest` (state.tsx), `Manifest.specs` (Task 6); existing sidebar CSS classes (`dokai-sidebar-folder`, `dokai-sidebar-folder-icon`, `dokai-sidebar-row`, `dokai-sidebar-row-icon`, `dokai-sidebar-row-title`).
- Produces: an `ApiNavGroup` rendered after the doc tree.

No unit test (component; no jsdom). Verified by typecheck + build + e2e smoke (Task 11).

- [ ] **Step 1: Add imports**

In `packages/ui/src/components/Sidebar.tsx`, extend the lucide import and add `useManifest`:

```ts
import { ChevronRight, FileText, Folder, FolderOpen, Globe, Lock, Plus, Webhook } from 'lucide-react';
import { useManifest, useSettings } from '../state.js';
```

- [ ] **Step 2: Render the group in the nav**

In the `Sidebar` component's returned `<nav>`, add `<ApiNavGroup />` after the `<SectionEntry ... />`:

```tsx
return (
  <nav className="px-3 pb-4">
    <SectionEntry
      section={tree}
      depth={0}
      onAddInFolder={onAddInFolder}
      showStatus={showStatus}
      showVersions={showVersions}
      isCollapsed={isCollapsed}
      onToggle={toggle}
      t={t}
    />
    <ApiNavGroup />
  </nav>
);
```

- [ ] **Step 3: Add the ApiNavGroup component**

Add this component to `packages/ui/src/components/Sidebar.tsx` (e.g. after `SectionEntry`):

```tsx
function ApiNavGroup() {
  const manifest = useManifest();
  const specs = manifest.data?.specs ?? [];
  if (specs.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="dokai-sidebar-folder mt-3 mb-1 flex items-center gap-1.5 pr-1">
        <Webhook className="dokai-sidebar-folder-icon" />
        <span className="min-w-0 flex-1 truncate text-left">APIs</span>
      </div>
      <div className="ml-2.75 border-l pl-2" style={{ borderColor: 'var(--color-border)' }}>
        <ul className="flex flex-col gap-px">
          {specs.map((spec) => (
            <li key={spec.route}>
              <NavLink to={spec.route} end className="dokai-sidebar-row">
                {spec.hasSecurity ? (
                  <Lock className="dokai-sidebar-row-icon" />
                ) : (
                  <Globe className="dokai-sidebar-row-icon" />
                )}
                <span className="dokai-sidebar-row-title">{spec.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter dokai-ui typecheck`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Sidebar.tsx
git commit -m "feat(ui): dedicated APIs sidebar group with lock badge"
```

---

## Task 8: dokai-kit — scaffold the DOKAI/openapi area (idempotent)

**Files:**
- Create: `packages/cli/src/scaffold/openapi-area.ts`
- Modify: `packages/cli/src/commands/init.ts`
- Test: `packages/cli/src/scaffold/openapi-area.test.ts`

**Interfaces:**
- Consumes: existing `RepoInfo`, `WorkspaceEntry` types; the `runInit` pipeline.
- Produces: `scaffoldOpenApiArea(opts: { dokaiRoot: string }): Promise<{ written: string[]; skipped: string[] }>`.

Note: the seeded `settings.json` already gains the `openapi` block automatically — `scaffoldSettings` calls `defaultProjectSettings(...)`, and the schema (Task 1) defaults `openapi`. No change to `scaffoldSettings` needed.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/scaffold/openapi-area.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { scaffoldOpenApiArea } from './openapi-area.js';

let dokaiRoot: string;

beforeAll(async () => {
  dokaiRoot = await mkdtemp(join(tmpdir(), 'dokai-openapi-scaffold-'));
});

describe('scaffoldOpenApiArea', () => {
  it('seeds the openapi area on first run', async () => {
    const result = await scaffoldOpenApiArea({ dokaiRoot });
    expect(existsSync(join(dokaiRoot, 'openapi', '_section.json'))).toBe(true);
    expect(existsSync(join(dokaiRoot, 'openapi', 'petstore.yaml'))).toBe(true);
    expect(result.written.length).toBeGreaterThan(0);
    const spec = await readFile(join(dokaiRoot, 'openapi', 'petstore.yaml'), 'utf8');
    expect(spec).toContain('openapi:');
  });

  it('is idempotent on a second run', async () => {
    const result = await scaffoldOpenApiArea({ dokaiRoot });
    expect(result.written).toEqual([]);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter dokai-kit exec vitest run src/scaffold/openapi-area.test.ts`
Expected: FAIL — `Cannot find module './openapi-area.js'`.

- [ ] **Step 3: Implement the scaffolder**

Create `packages/cli/src/scaffold/openapi-area.ts`:

```ts
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ScaffoldOpenApiResult {
  written: string[];
  skipped: string[];
}

const SECTION_JSON = {
  title: 'APIs',
  description: 'OpenAPI specifications, explorable and testable from the DOKAI UI.',
  tags: ['api'],
  order: 50,
  icon: 'webhook',
};

const PETSTORE_YAML = `openapi: 3.1.0
info:
  title: Petstore API
  version: 1.0.0
  description: A tiny sample API. Replace this with your own OpenAPI spec.
servers:
  - url: http://localhost:3000
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
paths:
  /pets:
    get:
      summary: List pets
      responses:
        '200':
          description: A list of pets.
    post:
      summary: Create a pet
      security:
        - bearerAuth: []
      responses:
        '201':
          description: Created.
`;

async function writeOnce(
  path: string,
  contents: string,
  written: string[],
  skipped: string[],
): Promise<void> {
  if (existsSync(path)) {
    skipped.push(path);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
  written.push(path);
}

/** Seed DOKAI/openapi/ with a section marker and a sample spec. Idempotent. */
export async function scaffoldOpenApiArea(opts: { dokaiRoot: string }): Promise<ScaffoldOpenApiResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  const dir = join(opts.dokaiRoot, 'openapi');

  await writeOnce(join(dir, '_section.json'), `${JSON.stringify(SECTION_JSON, null, 2)}\n`, written, skipped);
  await writeOnce(join(dir, 'petstore.yaml'), PETSTORE_YAML, written, skipped);

  return { written, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter dokai-kit exec vitest run src/scaffold/openapi-area.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into runInit**

In `packages/cli/src/commands/init.ts`, add the import (with the other scaffold imports):

```ts
import { scaffoldOpenApiArea } from '../scaffold/openapi-area.js';
```

After the `scaffoldDokaiFolder` block (which pushes `folder.written`/`folder.skipped`) and before `scaffoldSettings`, add:

```ts
const openapi = await scaffoldOpenApiArea({ dokaiRoot });
filesWritten.push(...openapi.written);
filesSkipped.push(...openapi.skipped);
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter dokai-kit typecheck`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/scaffold/openapi-area.ts packages/cli/src/scaffold/openapi-area.test.ts packages/cli/src/commands/init.ts
git commit -m "feat(cli): scaffold DOKAI/openapi area with a sample spec"
```

---

## Task 9: dokai-ai — document the OpenAPI convention for agents

**Files:**
- Modify: `packages/ai/templates/agents/AGENTS.md`
- Modify: the dokai skill template (`packages/ai/templates/skills/dokai/SKILL.md` — confirm exact filename with `ls packages/ai/templates/skills/dokai/`)
- Test: extend `packages/ai/src/copy.test.ts`

**Interfaces:**
- Consumes: existing `patchAgentsMd` (idempotent managed-block writer).
- Produces: AGENTS.md managed block + skill now mention `DOKAI/openapi/`.

- [ ] **Step 1: Write the failing test**

Add to `packages/ai/src/copy.test.ts` (new `it` inside the existing describe; reuse the file's imports for `templatesRoot`, `readFile`, `join`):

```ts
it('documents the OpenAPI convention in the AGENTS template', async () => {
  const body = await readFile(join(templatesRoot(), 'agents', 'AGENTS.md'), 'utf8');
  expect(body).toMatch(/DOKAI\/openapi/);
});
```

(If the test file does not already import `templatesRoot`, `readFile`, `join`, add them at the top.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter dokai-ai exec vitest run src/copy.test.ts`
Expected: FAIL — no match for `DOKAI/openapi`.

- [ ] **Step 3: Update the AGENTS template**

Append to `packages/ai/templates/agents/AGENTS.md` (inside the file content that becomes the managed block):

```markdown
## OpenAPI specs

Put OpenAPI/Swagger specs (`.yaml`/`.yml`/`.json`) under `DOKAI/openapi/` (folders allowed).
DOKAI lists them in the sidebar "APIs" group and renders each as an interactive reference.
A spec's lock icon and the Authorize/bearer-token flow come from the spec's
`components.securitySchemes` plus per-operation `security` — no extra DOKAI config. Run requests
live from the UI in `pnpm dokai` (the static `dokai build` export is read-only).
```

- [ ] **Step 4: Update the skill**

Append the same convention (condensed) to the dokai skill file (`packages/ai/templates/skills/dokai/SKILL.md` or the confirmed filename), in a short "OpenAPI" subsection:

```markdown
## OpenAPI

Author specs under `DOKAI/openapi/` as OpenAPI 3.x YAML or JSON. Security (the lock icon and the
Authorize flow) is derived from the spec's `securitySchemes`/`security`. Requests run in `pnpm dokai`.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter dokai-ai exec vitest run src/copy.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/templates/agents/AGENTS.md packages/ai/templates/skills/dokai/SKILL.md packages/ai/src/copy.test.ts
git commit -m "docs(ai): document DOKAI/openapi convention in AGENTS + skill"
```

---

## Task 10: examples/project — seed a spec fixture

**Files:**
- Create: `examples/project/DOKAI/openapi/_section.json`
- Create: `examples/project/DOKAI/openapi/petstore.yaml`

**Interfaces:** none (fixture data). Gives `pnpm --filter example-project dokai` immediate API content.

No unit test; consumed by Task 11's smoke.

- [ ] **Step 1: Create the section marker**

Create `examples/project/DOKAI/openapi/_section.json`:

```json
{
  "title": "APIs",
  "description": "OpenAPI specifications, explorable and testable from the DOKAI UI.",
  "tags": ["api"],
  "order": 50,
  "icon": "webhook"
}
```

- [ ] **Step 2: Create the sample spec**

Create `examples/project/DOKAI/openapi/petstore.yaml`:

```yaml
openapi: 3.1.0
info:
  title: Petstore API
  version: 1.0.0
  description: A tiny sample API used by the DOKAI example fixture.
servers:
  - url: http://localhost:3000
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
paths:
  /pets:
    get:
      summary: List pets
      responses:
        '200':
          description: A list of pets.
    post:
      summary: Create a pet
      security:
        - bearerAuth: []
      responses:
        '201':
          description: Created.
```

- [ ] **Step 3: Commit**

```bash
git add examples/project/DOKAI/openapi/
git commit -m "test(example): seed DOKAI/openapi fixture spec"
```

---

## Task 11: Version bump to 1.1.0, CHANGELOG, full verification + e2e smoke

**Files:**
- Modify: `package.json`, `packages/core/package.json`, `packages/ui/package.json`, `packages/cli/package.json`, `packages/ai/package.json` (version `1.0.1` → `1.1.0`)
- Modify: `CHANGELOG.md`

**Interfaces:** none. Final integration gate.

- [ ] **Step 1: Bump all five versions**

Change `"version": "1.0.1"` to `"version": "1.1.0"` in: `package.json`, `packages/core/package.json`, `packages/ui/package.json`, `packages/cli/package.json`, `packages/ai/package.json`. (No change to `scripts/pack-release.mjs` — no package was added.)

- [ ] **Step 2: Add the CHANGELOG entry**

In `CHANGELOG.md`, insert directly under the `# Changelog` heading, above the `## v1.0.1` entry:

```markdown
## v1.1.0 — 2026-06-17

- OpenAPI explorer: drop OpenAPI/Swagger specs into `DOKAI/openapi/` and DOKAI renders each as an
  interactive reference (powered by Scalar), grouped under a new "APIs" sidebar section with a lock
  icon on specs that have secured operations.
- Try-it-out: run requests live from the UI in `pnpm dokai` via a local CORS-proof proxy that works
  against any backend (including `localhost`); hosts are limited to spec `servers` + loopback +
  `settings.openapi.allowedHosts`. The static `dokai build` export renders specs read-only.
- Specs are indexed in search (one entry per spec). New optional `openapi` block in
  `DOKAI/settings.json` (`enabled`, `dir`, `allowedHosts`, `persistAuth`).
```

- [ ] **Step 3: Full build + typecheck + lint + test**

Run: `pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test`
Expected: all green. (`pnpm build` must rebuild `dokai-core` and `dokai-ui` so the prebuilt `dist/app` bundle includes the explorer.)

- [ ] **Step 4: E2E smoke against the example fixture**

Run:
```bash
pnpm --filter example-project dokai
```
Then in a browser at `http://localhost:8128`: confirm an **APIs** group appears in the sidebar with **petstore** (showing the rendered reference); the `POST /pets` operation shows a lock; with the server running, **Authorize** + **Send** are present (dev mode). Stop the server (Ctrl-C).

Also verify the raw endpoint directly:
```bash
curl -s 'http://localhost:8128/api/openapi/raw?path=openapi%2Fpetstore.yaml' | head -5
```
Expected: the YAML spec content (starting `openapi: 3.1.0`).

- [ ] **Step 5: Verify the read-only build path**

Run:
```bash
cd examples/project
node ../../packages/cli/dist/index.js build
```
Expected: a static build completes to `examples/project/DOKAI/.dokai/dist` with no errors. (Try-it-out is intentionally absent here; the explorer renders read-only.)

- [ ] **Step 6: Commit**

```bash
git add package.json packages/*/package.json CHANGELOG.md pnpm-lock.yaml
git commit -m "release: v1.1.0 — OpenAPI explorer"
```

---

## Self-Review

**Spec coverage:**
- Read-and-run explorer, Scalar, `DOKAI/openapi/`, dedicated APIs group, one search entry per spec, dev-only proxy, read-only static, folded into 4 packages, idempotent scaffolding, agent docs, lockstep 1.1.0 — each maps to Tasks 1–11. ✓
- Security model (allowlist = loopback ∪ spec servers ∪ `allowedHosts`, metadata-IP block, body-size cap, dev-only) → Task 5. ✓
- Lock icon derived from spec security → Task 2 (`hasSecurity`/`secured`) + Task 7 (icon). ✓
- Token never in committed files → tokens live in Scalar `persistAuth` (browser); proxy forwards but does not persist (Task 5). ✓
- Backward-compat settings (`.default({})`) → Task 1 test asserts legacy parse. ✓

**Placeholder scan:** No TBD/TODO. Every code step has complete code; every test step has real assertions. The only conditional is the Task 6 / Task 10 Scalar `.d.ts` fallback, which is fully written out and guarded. ✓

**Type consistency:** `OpenApiSpecMeta`/`OpenApiOperationMeta`/`OpenApiScanError` defined once (Task 1), consumed identically in Tasks 2, 3, 6, 7. `scanOpenApiSpecs` signature consistent across Tasks 2, 4, 5. `Manifest.specs`/`capabilities` defined in Task 6 and produced by the handler in Task 4 — both use `specs: OpenApiSpecMeta[]` and `capabilities: { tryItOut: boolean }`. `buildScalarConfig`/`rawSpecUrl`/`findSpecByRoute` defined and consumed consistently (Task 6). ✓
```
