import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSearchIndex, defaultSearchIndexPath, loadSearchIndex } from './search.js';
import type { OpenApiSpecMeta, SectionNode } from './types.js';

function makeDoc(
  overrides: Partial<{
    route: string;
    title: string;
    description: string;
    tags: string[];
    body: string;
  }>,
): SectionNode['docs'][number] {
  return {
    relativePath: 'x.md',
    absolutePath: '/tmp/x.md',
    route: overrides.route ?? '/dokai/x',
    workspace: null,
    frontmatter: {
      title: overrides.title ?? 'Doc',
      description: overrides.description ?? 'A doc',
      tags: overrides.tags ?? [],
      version: '0.1.0',
      status: 'stable',
    },
    headings: [],
    bodyText: overrides.body ?? '',
    bodyMarkdown: overrides.body ?? '',
  };
}

const tree: SectionNode = {
  relativePath: '',
  absolutePath: '/tmp',
  metadata: null,
  sections: [],
  docs: [
    makeDoc({
      route: '/dokai/auth',
      title: 'Authentication',
      description: 'Auth flow',
      tags: ['auth'],
      body: 'tokens are signed with HS256',
    }),
    makeDoc({
      route: '/dokai/billing',
      title: 'Billing',
      description: 'Billing system',
      tags: ['billing'],
      body: 'invoices are generated nightly',
    }),
  ],
};

describe('buildSearchIndex', () => {
  it('writes an index file with matchable documents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-search-'));
    const path = defaultSearchIndexPath(root);
    const file = await buildSearchIndex(tree, path);

    expect(file.documents).toHaveLength(2);
    expect(file.tags).toEqual(['auth', 'billing']);
    expect(file.statuses).toContain('stable');

    const onDisk = JSON.parse(await readFile(path, 'utf8')) as typeof file;
    const search = loadSearchIndex(onDisk);
    const results = search.search('hs256');
    expect(results[0]?.id).toBe('/dokai/auth');
  });

  it('boosts title matches over body matches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-search-'));
    const path = defaultSearchIndexPath(root);
    const file = await buildSearchIndex(tree, path);
    const search = loadSearchIndex(file);
    const results = search.search('billing');
    expect(results[0]?.id).toBe('/dokai/billing');
  });

  it('annotates docs with their folder for grouping in the search palette', async () => {
    const nestedTree: SectionNode = {
      relativePath: '',
      absolutePath: '/tmp',
      metadata: null,
      docs: [makeDoc({ route: '/dokai/index', title: 'Home' })],
      sections: [
        {
          relativePath: 'architecture',
          absolutePath: '/tmp/architecture',
          metadata: { title: 'System Architecture' },
          docs: [
            makeDoc({
              route: '/dokai/architecture/overview',
              title: 'Overview',
            }),
          ],
          sections: [
            {
              relativePath: 'architecture/v2',
              absolutePath: '/tmp/architecture/v2',
              metadata: null,
              docs: [
                makeDoc({
                  route: '/dokai/architecture/v2/redesign',
                  title: 'Redesign',
                }),
              ],
              sections: [],
            },
          ],
        },
      ],
    };
    const root = await mkdtemp(join(tmpdir(), 'dokai-search-'));
    const file = await buildSearchIndex(nestedTree, defaultSearchIndexPath(root));

    const home = file.documents.find((d) => d.id === '/dokai/index');
    const overview = file.documents.find((d) => d.id === '/dokai/architecture/overview');
    const redesign = file.documents.find((d) => d.id === '/dokai/architecture/v2/redesign');

    // Root doc → empty folder fields.
    expect(home?.folderPath).toBe('');
    expect(home?.folderTitle).toBe('');

    // Section with metadata.title → that title wins over the humanized path segment.
    expect(overview?.folderPath).toBe('architecture');
    expect(overview?.folderTitle).toBe('System Architecture');

    // Section without metadata.title → last path segment is humanized.
    expect(redesign?.folderPath).toBe('architecture/v2');
    expect(redesign?.folderTitle).toBe('V2');
  });
});

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
