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
