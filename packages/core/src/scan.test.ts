import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanDokai } from './scan.js';

let dokaiRoot: string;

beforeAll(async () => {
  dokaiRoot = await mkdtemp(join(tmpdir(), 'dokai-scan-'));
  await mkdir(join(dokaiRoot, 'backend'), { recursive: true });
  await mkdir(join(dokaiRoot, 'packages', 'web'), { recursive: true });

  await writeFile(
    join(dokaiRoot, 'index.md'),
    `---\ntitle: Index\ndescription: Root\n---\n\n# Index\n`,
  );
  await writeFile(
    join(dokaiRoot, 'backend', 'api.md'),
    `---\ntitle: API\ndescription: Backend API\ntags: [backend]\n---\n\n# API\n`,
  );
  await writeFile(
    join(dokaiRoot, 'backend', '_section.json'),
    JSON.stringify({ title: 'Backend', order: 1 }),
  );
  await writeFile(
    join(dokaiRoot, 'packages', 'web', 'overview.md'),
    `---\ntitle: Web\ndescription: Web overview\n---\n\n# Web\n`,
  );
});

afterAll(async () => {
  // Leave the tmp dir for the OS — Vitest test isolation makes manual cleanup brittle.
});

describe('scanDokai', () => {
  it('builds a section tree with docs grouped by folder', async () => {
    const tree = await scanDokai({ dokaiRoot });
    expect(tree.docs.map((d) => d.relativePath)).toContain('index.md');
    const backend = tree.sections.find((s) => s.relativePath === 'backend');
    expect(backend).toBeDefined();
    expect(backend?.metadata?.title).toBe('Backend');
    expect(backend?.docs[0]?.relativePath).toBe('backend/api.md');
  });

  it('attaches the workspace name when a mapping prefix matches', async () => {
    const tree = await scanDokai({
      dokaiRoot,
      workspaceMappings: [{ prefix: 'packages/web', name: 'web' }],
    });
    const packagesSection = tree.sections.find((s) => s.relativePath === 'packages');
    const webSection = packagesSection?.sections.find((s) => s.relativePath === 'packages/web');
    expect(webSection?.docs[0]?.workspace).toBe('web');
  });

  it('computes deterministic routes', async () => {
    const tree = await scanDokai({ dokaiRoot });
    const allRoutes: string[] = [];
    const collect = (n: { sections: unknown[]; docs: { route: string }[] }) => {
      for (const d of n.docs) allRoutes.push(d.route);
      for (const c of n.sections as Array<typeof n>) collect(c);
    };
    collect(tree);
    expect(allRoutes).toEqual(
      expect.arrayContaining(['/dokai', '/dokai/backend/api', '/dokai/packages/web/overview']),
    );
  });
});
