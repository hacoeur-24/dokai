import { resolve } from 'node:path';
import { scaffoldAgentAssets } from '../scaffold/agents.js';
import { patchPackageJsonScripts } from '../scaffold/package-json.js';
import { patchGitignore } from '../scaffold/gitignore.js';
import { log } from '../lib/log.js';

export interface UpdateOptions {
  root?: string;
}

/**
 * Re-sync DOKAI-managed files (Claude + agent templates, package.json scripts, .gitignore) to the
 * current package version. User-edited files are not overwritten unless they exactly match
 * the previously-shipped version.
 */
export async function runUpdate(options: UpdateOptions = {}): Promise<void> {
  const root = resolve(options.root ?? process.cwd());

  const assets = await scaffoldAgentAssets({ repoRoot: root });
  if (assets.written.length > 0) log.success(`Refreshed ${assets.written.length} agent file(s)`);
  if (assets.skipped.length > 0) {
    log.detail(`Left ${assets.skipped.length} user-edited agent file(s) alone`);
  }

  const scripts = await patchPackageJsonScripts(root);
  if (scripts.changed.length > 0) {
    log.success(`Updated ${scripts.changed.length} package.json script(s)`);
  }

  const gitignore = await patchGitignore(root);
  if (gitignore.added.length > 0) log.success('Refreshed .gitignore entries');
}
