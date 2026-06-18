import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { runInit } from '../src/commands/init.js';

async function makeNormalRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dokai-init-normal-'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'my-app', version: '1.0.0', scripts: { test: 'echo' } }, null, 2),
  );
  await writeFile(join(root, 'package-lock.json'), '{}');
  await writeFile(join(root, '.gitignore'), 'node_modules\n');
  return root;
}

async function makeTurboRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dokai-init-turbo-'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'turbo-app',
      version: '0.1.0',
      workspaces: ['apps/*', 'packages/*'],
    }),
  );
  await writeFile(join(root, 'pnpm-lock.yaml'), '');
  await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n  - "packages/*"\n');
  await writeFile(join(root, 'turbo.json'), JSON.stringify({ tasks: { build: {}, lint: {} } }));
  await mkdir(join(root, 'apps', 'admin'), { recursive: true });
  await mkdir(join(root, 'packages', 'shared-ui'), { recursive: true });
  await writeFile(join(root, 'apps', 'admin', 'package.json'), JSON.stringify({ name: 'admin' }));
  await writeFile(
    join(root, 'packages', 'shared-ui', 'package.json'),
    JSON.stringify({ name: 'shared-ui' }),
  );
  return root;
}

describe('runInit (normal repo)', () => {
  it('creates DOKAI/, patches package.json, .gitignore, and Claude assets', async () => {
    const root = await makeNormalRepo();
    const summary = await runInit({ root, yes: true, quiet: true });

    expect(summary.repo.shape).toBe('normal');
    expect(summary.repo.packageManager).toBe('npm');

    expect(existsSync(join(root, 'DOKAI', 'index.md'))).toBe(true);
    expect(existsSync(join(root, 'DOKAI', '_section.json'))).toBe(true);
    expect(existsSync(join(root, 'DOKAI', 'architecture', 'overview.md'))).toBe(true);
    expect(existsSync(join(root, 'DOKAI', 'architecture', '_section.json'))).toBe(true);
    expect(existsSync(join(root, 'DOKAI', 'settings.json'))).toBe(true);
    expect(existsSync(join(root, 'DOKAI', 'user-settings.local.json'))).toBe(true);

    const archSection = JSON.parse(
      await readFile(join(root, 'DOKAI', 'architecture', '_section.json'), 'utf8'),
    ) as { title: string; order?: number; tags?: string[] };
    expect(archSection.title).toBe('Architecture');
    expect(archSection.order).toBe(1);
    expect(archSection.tags).toContain('architecture');

    const fm = matter(await readFile(join(root, 'DOKAI', 'index.md'), 'utf8'));
    expect(fm.data['title']).toBe('Documentation');
    expect(fm.data['version']).toBe('0.1.0');

    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.dokai).toBe('dokai dev --port 8128');
    expect(pkg.scripts['dokai:build']).toBe('dokai build');
    expect(pkg.scripts.test).toBe('echo'); // pre-existing script preserved

    const gitignore = await readFile(join(root, '.gitignore'), 'utf8');
    expect(gitignore).toContain('DOKAI/user-settings.local.json');
    expect(gitignore).toContain('DOKAI/.dokai/cache/');

    // Claude Code assets (sub-agent, slash commands, split skills).
    expect(existsSync(join(root, '.claude', 'agents', 'dokai.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'commands', 'set-documentation.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'commands', 'update-documentation.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'skills', 'dokai-docs', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(root, '.claude', 'skills', 'dokai-api', 'SKILL.md'))).toBe(true);
    // Legacy single skill must not be present.
    expect(existsSync(join(root, '.claude', 'skills', 'dokai', 'SKILL.md'))).toBe(false);

    // Agent-agnostic assets for non-Claude agents (Gemini, Codex, etc.).
    expect(existsSync(join(root, '.agents', 'skills', 'dokai-docs', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(root, '.agents', 'skills', 'dokai-api', 'SKILL.md'))).toBe(true);
    // Legacy single agent skill must not be present.
    expect(existsSync(join(root, '.agents', 'skills', 'dokai', 'SKILL.md'))).toBe(false);

    const agentsMd = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('<!-- dokai:start -->');
    expect(agentsMd).toContain('.agents/skills/dokai-docs');

    // CLAUDE.md managed block (Claude-optimized context).
    const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('<!-- dokai:start -->');
    expect(claudeMd).toContain('/set-documentation');
  });

  it('is idempotent — re-running does not duplicate or overwrite', async () => {
    const root = await makeNormalRepo();
    await runInit({ root, yes: true, quiet: true });

    // Mutate a doc to verify it is preserved.
    const indexPath = join(root, 'DOKAI', 'index.md');
    await writeFile(indexPath, '---\ntitle: Edited\ndescription: Mine\n---\n\n# Mine\n');

    const second = await runInit({ root, yes: true, quiet: true });
    expect(second.filesSkipped).toEqual(expect.arrayContaining([indexPath]));

    const after = await readFile(indexPath, 'utf8');
    expect(after).toContain('Edited');

    const gitignore = await readFile(join(root, '.gitignore'), 'utf8');
    const occurrences = gitignore.match(/DOKAI\/user-settings\.local\.json/g) ?? [];
    expect(occurrences.length).toBe(1);

    // The AGENTS.md managed block is not duplicated on re-run.
    const agentsMd = await readFile(join(root, 'AGENTS.md'), 'utf8');
    expect(agentsMd.match(/<!-- dokai:start -->/g)).toHaveLength(1);

    // The CLAUDE.md managed block is not duplicated on re-run.
    const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf8');
    expect(claudeMd.match(/<!-- dokai:start -->/g)).toHaveLength(1);
  });
});

describe('runInit (Turborepo)', () => {
  it('detects shape and seeds workspace-mapped sections', async () => {
    const root = await makeTurboRepo();
    const summary = await runInit({ root, yes: true, quiet: true });

    expect(summary.repo.shape).toBe('turborepo');
    expect(summary.repo.packageManager).toBe('pnpm');
    expect(summary.repo.turbo?.pipelines).toEqual(['build', 'lint']);

    expect(existsSync(join(root, 'DOKAI', 'apps', 'admin', 'overview.md'))).toBe(true);
    expect(existsSync(join(root, 'DOKAI', 'packages', 'shared-ui', 'overview.md'))).toBe(true);

    const settings = JSON.parse(await readFile(join(root, 'DOKAI', 'settings.json'), 'utf8')) as {
      repository: { type: string; turborepo: boolean; structure: string };
    };
    expect(settings.repository.type).toBe('turborepo');
    expect(settings.repository.turborepo).toBe(true);
    expect(settings.repository.structure).toBe('workspace-mapped');
  });

  it('respects --workspace filter to map only selected packages', async () => {
    const root = await makeTurboRepo();
    await runInit({
      root,
      yes: true,
      quiet: true,
      workspaces: ['admin'],
    });
    expect(existsSync(join(root, 'DOKAI', 'apps', 'admin', 'overview.md'))).toBe(true);
    expect(existsSync(join(root, 'DOKAI', 'packages', 'shared-ui', 'overview.md'))).toBe(false);
  });
});
