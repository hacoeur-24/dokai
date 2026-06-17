import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectRepo } from './repo.js';

async function scratchRepo(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'dokai-repo-'));
}

describe('detectRepo', () => {
  it('classifies a normal single-package repo with npm', async () => {
    const root = await scratchRepo();
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'normal' }));
    await writeFile(join(root, 'package-lock.json'), '{}');

    const info = await detectRepo({ root });
    expect(info.shape).toBe('normal');
    expect(info.packageManager).toBe('npm');
    expect(info.workspaces).toEqual([]);
    expect(info.turbo).toBeNull();
  });

  it('classifies a pnpm workspace as "workspaces"', async () => {
    const root = await scratchRepo();
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'mono', private: true }));
    await writeFile(join(root, 'pnpm-lock.yaml'), '');
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    await mkdir(join(root, 'packages', 'web'), { recursive: true });
    await writeFile(
      join(root, 'packages', 'web', 'package.json'),
      JSON.stringify({ name: '@org/web' }),
    );

    const info = await detectRepo({ root });
    expect(info.shape).toBe('workspaces');
    expect(info.packageManager).toBe('pnpm');
    expect(info.workspaces.map((w) => w.name)).toEqual(['@org/web']);
    expect(info.workspaces[0]?.category).toBe('package');
  });

  it('classifies as "turborepo" when turbo.json is present alongside workspaces', async () => {
    const root = await scratchRepo();
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'turbo', workspaces: ['apps/*'] }),
    );
    await writeFile(join(root, 'package-lock.json'), '{}');
    await writeFile(join(root, 'turbo.json'), JSON.stringify({ tasks: { build: {}, lint: {} } }));
    await mkdir(join(root, 'apps', 'admin'), { recursive: true });
    await writeFile(join(root, 'apps', 'admin', 'package.json'), JSON.stringify({ name: 'admin' }));

    const info = await detectRepo({ root });
    expect(info.shape).toBe('turborepo');
    expect(info.turbo?.pipelines).toEqual(['build', 'lint']);
    expect(info.workspaces[0]?.category).toBe('app');
  });
});
