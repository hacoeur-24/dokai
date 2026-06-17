import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageManager } from '../types.js';

const LOCKFILES: Array<[string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
];

/**
 * Detect the package manager for a repo. Order:
 * 1. Lockfile presence (most reliable — reflects what the user actually uses).
 * 2. `packageManager` field in package.json.
 * 3. Fallback to `npm`.
 */
export function detectPackageManager(repoRoot: string): PackageManager {
  for (const [lockfile, pm] of LOCKFILES) {
    if (existsSync(join(repoRoot, lockfile))) return pm;
  }

  const pkgPath = join(repoRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        packageManager?: string;
      };
      if (typeof pkg.packageManager === 'string') {
        const name = pkg.packageManager.split('@', 1)[0];
        if (name === 'pnpm' || name === 'yarn' || name === 'npm' || name === 'bun') return name;
      }
    } catch {
      /* fall through */
    }
  }

  return 'npm';
}
