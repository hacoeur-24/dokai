import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SCRIPTS: Record<string, string> = {
  dokai: 'dokai dev --port 8128',
  'dokai:build': 'dokai build',
  'dokai:preview': 'dokai preview',
  'dokai:generate': 'dokai generate',
  'dokai:update': 'dokai update',
};

export interface PackageJsonPatchResult {
  path: string;
  /** Scripts we added or updated (key, previous value, next value). */
  changed: Array<{ name: string; previous: string | null; next: string }>;
}

/** Add the canonical DOKAI scripts to the root package.json without overwriting user values. */
export async function patchPackageJsonScripts(
  repoRoot: string,
  options: { overwrite?: boolean } = {},
): Promise<PackageJsonPatchResult> {
  const path = join(repoRoot, 'package.json');
  const raw = await readFile(path, 'utf8');
  const pkg = JSON.parse(raw) as {
    scripts?: Record<string, string>;
    [k: string]: unknown;
  };
  const scripts = (pkg.scripts ??= {} as Record<string, string>);

  const changed: PackageJsonPatchResult['changed'] = [];
  for (const [name, command] of Object.entries(SCRIPTS)) {
    const previous = typeof scripts[name] === 'string' ? scripts[name] : null;
    if (previous === command) continue;
    if (previous && !options.overwrite) continue;
    scripts[name] = command;
    changed.push({ name, previous, next: command });
  }

  if (changed.length > 0) {
    const indent = detectIndent(raw);
    const newline = raw.endsWith('\n') ? '\n' : '';
    await writeFile(path, `${JSON.stringify(pkg, null, indent)}${newline || '\n'}`, 'utf8');
  }
  return { path, changed };
}

function detectIndent(raw: string): number {
  const match = raw.match(/^(\s+)"/m);
  if (!match) return 2;
  const indent = match[1] ?? '';
  if (indent.startsWith('\t')) return 2;
  return indent.length || 2;
}
