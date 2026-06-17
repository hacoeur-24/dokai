import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MARKER = '# DOKAI';
const ENTRIES = [
  'DOKAI/user-settings.local.json',
  'DOKAI/.dokai/cache/',
  'DOKAI/.dokai/local/',
  'DOKAI/.dokai/dist/',
  'DOKAI/.dokai/search-index.json',
];

export interface GitignoreResult {
  /** Path of the .gitignore file (always absolute). */
  path: string;
  /** Lines we appended (empty when nothing changed). */
  added: string[];
  /** True if a .gitignore was created from scratch. */
  created: boolean;
}

/**
 * Append DOKAI-specific patterns to the repo's `.gitignore`. Detects existing entries by exact
 * match per line so re-running init never produces duplicates.
 */
export async function patchGitignore(repoRoot: string): Promise<GitignoreResult> {
  const path = join(repoRoot, '.gitignore');
  const existed = existsSync(path);
  const existing = existed ? await readFile(path, 'utf8') : '';
  const lines = existing.split('\n');

  const haveLine = (line: string) => lines.some((l) => l.trim() === line);
  const missing = ENTRIES.filter((entry) => !haveLine(entry));

  if (missing.length === 0) {
    return { path, added: [], created: false };
  }

  const cleaned = lines.join('\n');
  const block = ['', MARKER, ...missing, ''];
  const trailing = cleaned.endsWith('\n') || !existed ? '' : '\n';
  const next = `${cleaned}${trailing}${block.join('\n')}`;
  await writeFile(path, next, 'utf8');
  return { path, added: missing, created: !existed };
}
