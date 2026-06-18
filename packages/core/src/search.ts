import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import MiniSearch, { type Options as MiniSearchOptions } from 'minisearch';
import type { DocNode, OpenApiSpecMeta, SectionNode } from './types.js';

export interface SearchDocument {
  /** Stable id used by MiniSearch. We use the route. */
  id: string;
  title: string;
  description: string;
  tags: string[];
  version: string;
  status?: string;
  package: string | null;
  route: string;
  /** Posix-style folder path inside DOKAI/ (e.g. "architecture/v2"). Empty string for root docs.
   *  Used by the search palette to group results under a folder header. */
  folderPath: string;
  /** Human-readable folder title — `_section.json` metadata.title if present, else a humanized
   *  version of the path (last segment with separators stripped). Empty for root docs. */
  folderTitle: string;
  headings: string;
  body: string;
}

export interface SearchIndexFile {
  /** Schema version for forward compatibility. */
  schema: 1;
  generatedAt: string;
  documents: SearchDocument[];
  /** Serialized MiniSearch index for fast client-side load. */
  index: object;
  /** All distinct tags found in the corpus, sorted. */
  tags: string[];
  /** All distinct statuses found, sorted. */
  statuses: string[];
}

const SEARCH_OPTIONS: MiniSearchOptions<SearchDocument> = {
  idField: 'id',
  fields: ['title', 'description', 'tags', 'headings', 'body'],
  storeFields: [
    'title',
    'description',
    'tags',
    'version',
    'status',
    'package',
    'route',
    'folderPath',
    'folderTitle',
  ],
  searchOptions: {
    boost: { title: 4, headings: 2, description: 1.5 },
    fuzzy: 0.15,
    prefix: true,
  },
};

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

/** Build a search index from a scanned section tree and write it to disk. */
export async function buildSearchIndex(
  sectionTree: SectionNode,
  outputPath: string,
  options: { specs?: OpenApiSpecMeta[] } = {},
): Promise<SearchIndexFile> {
  const documents = collectDocuments(sectionTree);
  for (const spec of options.specs ?? []) documents.push(specToSearchDocument(spec));
  const tags = new Set<string>();
  const statuses = new Set<string>();
  for (const doc of documents) {
    for (const t of doc.tags) tags.add(t);
    if (doc.status) statuses.add(doc.status);
  }

  const mini = new MiniSearch<SearchDocument>(SEARCH_OPTIONS);
  mini.addAll(documents);

  const file: SearchIndexFile = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    documents,
    index: mini.toJSON(),
    tags: [...tags].sort(),
    statuses: [...statuses].sort(),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(file), 'utf8');
  return file;
}

/** Compute the canonical on-disk location of the search index for a given DOKAI root. */
export function defaultSearchIndexPath(dokaiRoot: string): string {
  return join(dokaiRoot, '.dokai', 'search-index.json');
}

/** Restore a MiniSearch instance from a stored index file. Used by the UI. */
export function loadSearchIndex(file: SearchIndexFile): MiniSearch<SearchDocument> {
  return MiniSearch.loadJS<SearchDocument>(
    file.index as Parameters<typeof MiniSearch.loadJS>[0],
    SEARCH_OPTIONS,
  );
}

function collectDocuments(section: SectionNode): SearchDocument[] {
  const out: SearchDocument[] = [];
  const folderPath = section.relativePath;
  const folderTitle = folderPath ? (section.metadata?.title ?? humanizeFolderPath(folderPath)) : '';
  for (const doc of section.docs) out.push(toSearchDocument(doc, folderPath, folderTitle));
  for (const child of section.sections) out.push(...collectDocuments(child));
  return out;
}

function toSearchDocument(doc: DocNode, folderPath: string, folderTitle: string): SearchDocument {
  return {
    id: doc.route,
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
    tags: doc.frontmatter.tags,
    version: doc.frontmatter.version,
    ...(doc.frontmatter.status ? { status: doc.frontmatter.status } : {}),
    package: doc.workspace,
    route: doc.route,
    folderPath,
    folderTitle,
    headings: doc.headings.map((h) => h.text).join('\n'),
    body: doc.bodyText,
  };
}

/** Humanize a folder path like "architecture/v2" → "V2". We use just the last segment so the
 *  folder header in the search palette stays compact; the full path is still available via
 *  `folderPath` for tooltips or future breadcrumbs. */
function humanizeFolderPath(folderPath: string): string {
  const last = folderPath.split('/').pop() ?? '';
  return last
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
