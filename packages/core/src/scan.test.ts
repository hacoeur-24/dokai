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

  // A section folder with a _section.json but no markdown docs — mirrors the scaffolded
  // DOKAI/openapi/ folder. It must be pruned so the sidebar never shows an empty folder.
  await mkdir(join(dokaiRoot, 'empty'), { recursive: true });
  await writeFile(
    join(dokaiRoot, 'empty', '_section.json'),
    JSON.stringify({ title: 'Empty APIs' }),
  );

  // A section whose only descendant is itself doc-less — the whole subtree is hollow and
  // must be pruned recursively (parent and child both removed).
  await mkdir(join(dokaiRoot, 'hollow', 'inner'), { recursive: true });
  await writeFile(join(dokaiRoot, 'hollow', '_section.json'), JSON.stringify({ title: 'Hollow' }));
  await writeFile(
    join(dokaiRoot, 'hollow', 'inner', '_section.json'),
    JSON.stringify({ title: 'Inner' }),
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

  it('prunes sections that contain no docs in their entire subtree', async () => {
    const tree = await scanDokai({ dokaiRoot });
    expect(tree.sections.find((s) => s.relativePath === 'empty')).toBeUndefined();
    expect(tree.sections.find((s) => s.relativePath === 'hollow')).toBeUndefined();
  });

  it('keeps intermediate sections that have a doc-bearing subsection', async () => {
    const tree = await scanDokai({ dokaiRoot });
    const packagesSection = tree.sections.find((s) => s.relativePath === 'packages');
    expect(packagesSection).toBeDefined();
    expect(packagesSection?.sections.some((s) => s.relativePath === 'packages/web')).toBe(true);
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
