#!/usr/bin/env node
/**
 * Pack the four DOKAI packages into release tarballs whose internal cross-deps point at
 * versioned GitHub Release URLs instead of bare workspace versions. This is what makes
 * `pnpm add -D https://.../releases/latest/download/dokai.tgz` work as a single command —
 * pnpm fetches the URL deps transitively, so consumers don't need `pnpm.overrides` to
 * redirect the bare dep names.
 *
 * Workflow per package:
 *   1. Read package.json
 *   2. Rewrite each `workspace:*` dep that targets another DOKAI package → release URL
 *   3. `npm pack` (which now writes the rewritten deps into the tarball's package.json)
 *   4. Restore the original package.json (so the working tree stays clean)
 *
 * Then copy each `dokai-*-X.Y.Z.tgz` to an unversioned alias `dokai-*.tgz` so the
 * `releases/latest/download/<name>.tgz` URL pattern works.
 *
 * URL deps point at `releases/download/v${VERSION}/…` (versioned), NOT `releases/latest/…`.
 * That way a tarball captures its peers at the same version: pinning to v0.2.8 keeps you
 * on v0.2.8 transitively. The `dokai.tgz` alias is just a copy of `dokai-${VERSION}.tgz`,
 * so installing the alias still resolves to a self-consistent version set.
 */
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIR = join(ROOT, 'release');

const PACKAGES = [
  { dir: 'packages/cli', name: 'dokai' },
  { dir: 'packages/core', name: 'dokai-core' },
  { dir: 'packages/ui', name: 'dokai-ui' },
  { dir: 'packages/ai', name: 'dokai-ai' },
];

const cliPkgRaw = await readFile(join(ROOT, 'packages/cli/package.json'), 'utf8');
const VERSION = JSON.parse(cliPkgRaw).version;
const REPO = 'hacoeur-24/dokai';

const releaseUrl = (depName) =>
  `https://github.com/${REPO}/releases/download/v${VERSION}/${depName}-${VERSION}.tgz`;

console.log(`Packing v${VERSION}…`);
await mkdir(RELEASE_DIR, { recursive: true });

const dokaiNames = new Set(PACKAGES.map((p) => p.name));

for (const pkg of PACKAGES) {
  const pkgPath = join(ROOT, pkg.dir, 'package.json');
  const original = await readFile(pkgPath, 'utf8');
  const json = JSON.parse(original);

  // Rewrite each workspace:* dep that targets another DOKAI package to a release URL.
  // Non-DOKAI deps (commander, gray-matter, react, etc.) stay untouched.
  let rewrittenAny = false;
  for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
    const block = json[field];
    if (!block) continue;
    for (const [depName, depValue] of Object.entries(block)) {
      if (typeof depValue !== 'string') continue;
      if (!depValue.startsWith('workspace:')) continue;
      if (!dokaiNames.has(depName)) continue;
      block[depName] = releaseUrl(depName);
      rewrittenAny = true;
    }
  }

  if (rewrittenAny) {
    await writeFile(pkgPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  }

  try {
    execFileSync('npm', ['pack', '--pack-destination', RELEASE_DIR], {
      cwd: join(ROOT, pkg.dir),
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } finally {
    if (rewrittenAny) await writeFile(pkgPath, original, 'utf8');
  }
}

console.log('\nCreating unversioned aliases…');
for (const pkg of PACKAGES) {
  const versioned = join(RELEASE_DIR, `${pkg.name}-${VERSION}.tgz`);
  const alias = join(RELEASE_DIR, `${pkg.name}.tgz`);
  if (!existsSync(versioned)) {
    console.warn(`  skip ${pkg.name} — versioned tarball missing`);
    continue;
  }
  await cp(versioned, alias);
  console.log(`  ${pkg.name}.tgz  ←  ${pkg.name}-${VERSION}.tgz`);
}

console.log(`\nPacked ${PACKAGES.length} packages to release/`);
