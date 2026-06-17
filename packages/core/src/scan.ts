import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import fg from 'fast-glob';
import { sectionMetadataSchema, type SectionMetadata } from './schemas/section.js';
import { parseDocFile } from './parse.js';
import { pathToRoute } from './route.js';
import type { DocNode, SectionNode } from './types.js';

export interface ScanOptions {
  /** Absolute path to the DOKAI/ folder. */
  dokaiRoot: string;
  /**
   * Optional list of workspace path prefixes (relative to DOKAI/) used to mark docs as belonging
   * to a workspace package. The longest matching prefix wins, so "packages/web" beats "packages".
   */
  workspaceMappings?: Array<{ prefix: string; name: string }>;
}

/** Scan the DOKAI/ folder and return a hierarchical section tree of docs. */
export async function scanDokai(options: ScanOptions): Promise<SectionNode> {
  const { dokaiRoot, workspaceMappings = [] } = options;

  const mdFiles = await fg(['**/*.md'], {
    cwd: dokaiRoot,
    dot: false,
    onlyFiles: true,
    ignore: ['node_modules/**', '.dokai/**'],
  });

  const sectionFiles = await fg(['**/_section.json'], {
    cwd: dokaiRoot,
    dot: false,
    onlyFiles: true,
    ignore: ['node_modules/**', '.dokai/**'],
  });

  const sectionMetaByDir = new Map<string, SectionMetadata>();
  for (const sectionFile of sectionFiles) {
    const absolute = join(dokaiRoot, sectionFile);
    const raw = await readFile(absolute, 'utf8');
    const parsed = sectionMetadataSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      const dir = toPosix(sectionFile).slice(0, -'/_section.json'.length);
      sectionMetaByDir.set(dir, parsed.data);
    }
  }

  const docs: DocNode[] = [];
  for (const file of mdFiles) {
    const relativePath = toPosix(file);
    const absolutePath = join(dokaiRoot, file);
    const parsed = await parseDocFile(absolutePath);
    docs.push({
      relativePath,
      absolutePath,
      route: pathToRoute(relativePath),
      workspace: matchWorkspace(relativePath, workspaceMappings),
      frontmatter: parsed.frontmatter,
      headings: parsed.headings,
      bodyText: parsed.bodyText,
      bodyMarkdown: parsed.bodyMarkdown,
    });
  }

  return buildSectionTree(dokaiRoot, docs, sectionMetaByDir);
}

function buildSectionTree(
  dokaiRoot: string,
  docs: DocNode[],
  sectionMeta: Map<string, SectionMetadata>,
): SectionNode {
  const root: SectionNode = {
    relativePath: '',
    absolutePath: dokaiRoot,
    metadata: sectionMeta.get('') ?? null,
    sections: [],
    docs: [],
  };

  const sectionByPath = new Map<string, SectionNode>();
  sectionByPath.set('', root);

  const ensureSection = (relativeDir: string): SectionNode => {
    const existing = sectionByPath.get(relativeDir);
    if (existing) return existing;
    const parts = relativeDir.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    const parent = ensureSection(parentPath);
    const node: SectionNode = {
      relativePath: relativeDir,
      absolutePath: join(dokaiRoot, relativeDir),
      metadata: sectionMeta.get(relativeDir) ?? null,
      sections: [],
      docs: [],
    };
    parent.sections.push(node);
    sectionByPath.set(relativeDir, node);
    return node;
  };

  for (const dir of sectionMeta.keys()) {
    if (dir) ensureSection(dir);
  }

  for (const doc of docs) {
    const dir = doc.relativePath.includes('/')
      ? doc.relativePath.slice(0, doc.relativePath.lastIndexOf('/'))
      : '';
    const section = dir ? ensureSection(dir) : root;
    section.docs.push(doc);
  }

  sortTree(root);
  return root;
}

function sortTree(section: SectionNode): void {
  section.docs.sort((a, b) => a.frontmatter.title.localeCompare(b.frontmatter.title));
  section.sections.sort((a, b) => {
    const orderA = a.metadata?.order ?? Number.POSITIVE_INFINITY;
    const orderB = b.metadata?.order ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return a.relativePath.localeCompare(b.relativePath);
  });
  for (const child of section.sections) sortTree(child);
}

function matchWorkspace(
  relativePath: string,
  mappings: Array<{ prefix: string; name: string }>,
): string | null {
  let best: { prefix: string; name: string } | null = null;
  for (const m of mappings) {
    if (relativePath === m.prefix || relativePath.startsWith(`${m.prefix}/`)) {
      if (!best || m.prefix.length > best.prefix.length) best = m;
    }
  }
  return best?.name ?? null;
}

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join(posix.sep);
}

/** Helper used in tests + by the dev server to know whether a DOKAI root exists. */
export function dokaiExists(dokaiRoot: string): boolean {
  return existsSync(dokaiRoot);
}

/** Convenience used by integration tests to compute a relative path from repo root. */
export function relativeFromRepo(repoRoot: string, absolute: string): string {
  return toPosix(relative(repoRoot, absolute));
}
