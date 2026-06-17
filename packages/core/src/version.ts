import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import semver from 'semver';
import { sectionMetadataSchema } from './schemas/section.js';

export type BumpKind = 'patch' | 'minor' | 'major';

export interface BumpResult {
  path: string;
  kind: BumpKind;
  before: string;
  after: string;
}

/**
 * Bump a doc's frontmatter `version` and refresh `updatedAt`. The file is rewritten in-place
 * with frontmatter and body preserved.
 */
export async function bumpDoc(absolutePath: string, kind: BumpKind): Promise<BumpResult> {
  const raw = await readFile(absolutePath, 'utf8');
  const parsed = matter(raw);
  const before = String(parsed.data['version'] ?? '0.0.0');
  if (!semver.valid(before)) {
    throw new Error(`Invalid version "${before}" in ${absolutePath}`);
  }
  const after = semver.inc(before, kind);
  if (!after) throw new Error(`Failed to bump ${before} (${kind}) in ${absolutePath}`);

  parsed.data['version'] = after;
  parsed.data['updatedAt'] = new Date().toISOString();

  await writeFile(absolutePath, matter.stringify(parsed.content, parsed.data), 'utf8');
  return { path: absolutePath, kind, before, after };
}

/**
 * Bump a section's `_section.json` version. Throws if the file does not exist — the CLI
 * surface should create one explicitly.
 */
export async function bumpSection(folderAbsolutePath: string, kind: BumpKind): Promise<BumpResult> {
  const sectionPath = join(folderAbsolutePath, '_section.json');
  if (!existsSync(sectionPath)) {
    throw new Error(`No _section.json at ${folderAbsolutePath}; cannot bump folder version.`);
  }
  const raw = await readFile(sectionPath, 'utf8');
  const data = sectionMetadataSchema.parse(JSON.parse(raw));
  const before = data.version ?? '0.0.0';
  if (!semver.valid(before)) {
    throw new Error(`Invalid version "${before}" in ${sectionPath}`);
  }
  const after = semver.inc(before, kind);
  if (!after) throw new Error(`Failed to bump ${before} (${kind}) in ${sectionPath}`);

  const next = { ...data, version: after };
  await writeFile(sectionPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return { path: sectionPath, kind, before, after };
}
