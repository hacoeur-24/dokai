import { resolve } from 'node:path';
import { detectPackageManager } from './package-manager.js';
import { detectWorkspaces } from './workspaces.js';
import { detectTurbo } from './turbo.js';
import type { RepoInfo, RepoShape } from '../types.js';

export interface DetectRepoOptions {
  /** Absolute path to the repository root (where the root package.json lives). */
  root: string;
}

/** Inspect a repo and report shape, package manager, workspace packages, and turbo info. */
export async function detectRepo({ root }: DetectRepoOptions): Promise<RepoInfo> {
  const absolute = resolve(root);
  const packageManager = detectPackageManager(absolute);
  const workspaces = await detectWorkspaces(absolute);
  const turbo = detectTurbo(absolute);
  return {
    packageManager,
    shape: classifyShape(workspaces.length > 0, turbo !== null),
    root: absolute,
    workspaces,
    turbo,
  };
}

function classifyShape(hasWorkspaces: boolean, hasTurbo: boolean): RepoShape {
  if (!hasWorkspaces && !hasTurbo) return 'normal';
  if (hasTurbo) return 'turborepo';
  if (hasWorkspaces) return 'workspaces';
  return 'monorepo-non-turbo';
}
