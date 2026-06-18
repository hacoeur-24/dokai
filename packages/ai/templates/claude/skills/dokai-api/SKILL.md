---
name: dokai-api
description: Use when authoring or updating OpenAPI/Swagger specifications stored under DOKAI/openapi/. Covers the OAS 3.x conventions, security scheme wiring, try-it-out behavior, and how to derive specs by reading the repo's routes, controllers, and handlers.
---

# Working with DOKAI API specs

This project stores **OpenAPI 3.x specifications** under `DOKAI/openapi/` as YAML or JSON files.
The DOKAI UI renders them as interactive API references: try-it-out runs live against the server
when `pnpm dokai` (the dev server) is running; `dokai build` produces a static read-only version.

## Where specs live

```
DOKAI/
  openapi/
    api.yaml          # main spec, or split by service
    internal.yaml     # optional: internal/admin API
```

Any `*.yaml` or `*.json` directly under `DOKAI/openapi/` is picked up automatically. Use one file
per API surface; split only when services are genuinely independent.

## Conventions

**OAS 3.x only.** Use OpenAPI 3.0.x or 3.1.x YAML (preferred) or JSON. Do not use Swagger 2.x.

**Security derives from the spec.** The lock icon and the Authorize dialog in the UI come entirely
from the spec's `components.securitySchemes` + per-operation `security` arrays. There is no extra
DOKAI configuration — wire security in the spec and it renders automatically.

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - bearerAuth: []   # global default; override per-operation as needed
```

**Try-it-out** runs requests directly from the browser when `pnpm dokai` is active. The static
`dokai build` is read-only (no try-it-out). Document the real server URL in `servers:` so the
browser knows where to send requests.

**Mark uncertainty explicitly.** Where you cannot infer a field's type, shape, or behavior from
the code, write a `description` comment containing `TBD: <question>` rather than guessing. A spec
with honest gaps is more useful than a confident wrong one.

## How to author a spec from code

Read the codebase to derive the spec — do not invent endpoints. Follow this sequence:

1. **Locate the routes** — find the router/controller files (Express `router.get(...)`,
   NestJS `@Controller`/`@Get`, Fastify `fastify.route(...)`, etc.). List every path and method.
2. **Read the handlers** — for each route, read the handler to understand: request body shape,
   path/query parameters, response shape (happy path + error codes), and any auth guards.
3. **Identify security** — find the auth middleware or guards and translate to a
   `securitySchemes` entry; apply `security` at the global level, then override for public routes.
4. **Write the spec** — paths, request/response schemas (`components/schemas`), and security.
   Use `$ref` to avoid duplicating schemas. Name schemas after their domain concept, not their
   route (e.g. `UserProfile`, not `GetUserResponse`).
5. **Mark gaps** — anything you cannot confidently infer gets `TBD: <question>` in its
   `description`. List the TBDs in your summary so a human can resolve them.
6. **Place the file** under `DOKAI/openapi/<name>.yaml` and confirm it renders in the UI.

## How to update a spec when the API changes

1. Identify which routes/handlers changed (check the diff or commit history).
2. Re-read the affected handlers for the updated shapes, new parameters, removed fields.
3. Edit the corresponding paths and schemas in the spec; remove stale entries.
4. If security changed (new scheme, route now public, etc.), update `securitySchemes` and
   per-operation `security` accordingly.
5. Resolve any existing `TBD` comments if the code now makes them clear.
6. Summarize what changed in the spec and any remaining TBDs.

## Anti-patterns

Swagger 2.x specs; hardcoded bearer tokens in the spec file; copy-pasting request/response schemas
instead of using `$ref`; leaving removed endpoints in the spec; inventing fields not present in
the handler; omitting `security` on protected routes.

---

In Claude Code, the `/set-documentation` and `/update-documentation` slash commands (and the
`dokai` sub-agent) drive these workflows interactively, including the API scope.
