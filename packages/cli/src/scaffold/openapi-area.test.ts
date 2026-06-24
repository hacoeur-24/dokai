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
  it('seeds the sample spec on first run', async () => {
    const result = await scaffoldOpenApiArea({ dokaiRoot });
    expect(existsSync(join(dokaiRoot, 'openapi', 'petstore.yaml'))).toBe(true);
    expect(result.written.length).toBeGreaterThan(0);
    const spec = await readFile(join(dokaiRoot, 'openapi', 'petstore.yaml'), 'utf8');
    expect(spec).toContain('openapi:');
  });

  it('does not write a _section.json (the openapi dir is surfaced as an API group, not a docs folder)', async () => {
    // A _section.json here would make scanDokai emit an empty "APIs" docs section in the sidebar,
    // duplicating the populated API group that ApiNavGroup renders from the scanned specs.
    expect(existsSync(join(dokaiRoot, 'openapi', '_section.json'))).toBe(false);
  });

  it('is idempotent on a second run', async () => {
    const result = await scaffoldOpenApiArea({ dokaiRoot });
    expect(result.written).toEqual([]);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});
