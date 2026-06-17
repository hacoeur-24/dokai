import { existsSync, readFileSync } from 'node:fs';
import { join, posix, sep, basename, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import fg from 'fast-glob';
import type { WorkspaceEntry } from '../types.js';

interface PackageJson {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
}

/** Resolve workspace package globs to concrete WorkspaceEntry records. */
export async function detectWorkspaces(repoRoot: string): Promise<WorkspaceEntry[]> {
  const patterns = readWorkspaceGlobs(repoRoot);
  if (patterns.length === 0) return [];

  const matches = await fg(
    patterns.map((p) => `${stripTrailingSlash(p)}/package.json`),
    { cwd: repoRoot, onlyFiles: true, ignore: ['**/node_modules/**'] },
  );

  const entries: WorkspaceEntry[] = [];
  for (const match of matches) {
    const absolutePkgPath = join(repoRoot, match);
    const pkgDir = dirname(match);
    let pkg: PackageJson = {};
    try {
      pkg = JSON.parse(readFileSync(absolutePkgPath, 'utf8')) as PackageJson;
    } catch {
      continue;
    }
    entries.push({
      name: pkg.name ?? basename(pkgDir),
      path: toPosix(pkgDir),
      category: classify(pkgDir),
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

/** Read workspace globs from `pnpm-workspace.yaml` or `package.json#workspaces`. */
function readWorkspaceGlobs(repoRoot: string): string[] {
  const pnpmFile = join(repoRoot, 'pnpm-workspace.yaml');
  if (existsSync(pnpmFile)) {
    try {
      const parsed = parseYaml(readFileSync(pnpmFile, 'utf8')) as {
        packages?: string[];
      } | null;
      if (parsed?.packages?.length) return parsed.packages;
    } catch {
      /* fall through */
    }
  }

  const pkgPath = join(repoRoot, 'package.json');
  if (!existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;
    if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
    if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) return pkg.workspaces.packages;
  } catch {
    /* fall through */
  }
  return [];
}

function classify(pkgDir: string): WorkspaceEntry['category'] {
  const top = pkgDir.split(/[\\/]/, 1)[0];
  if (!top) return 'unknown';
  if (top === 'apps') return 'app';
  if (top === 'packages') return 'package';
  if (top === 'services') return 'service';
  if (top === 'tooling' || top === 'tools') return 'tooling';
  return 'unknown';
}

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join(posix.sep);
}

function stripTrailingSlash(p: string): string {
  return p.endsWith('/') ? p.slice(0, -1) : p;
}
