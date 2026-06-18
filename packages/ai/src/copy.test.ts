import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  copyAgentAssets,
  patchAgentsMd,
  patchManagedDoc,
  removeLegacyAssets,
  templatesRoot,
} from './copy.js';

describe('copyAgentAssets', () => {
  it('copies the new asset layout to .claude and .agents', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const result = await copyAgentAssets({ dest });

    expect(result.written.length).toBeGreaterThan(0);

    // Claude Code: sub-agent
    expect(existsSync(join(dest, '.claude', 'agents', 'dokai.md'))).toBe(true);

    // Claude Code: slash commands
    expect(existsSync(join(dest, '.claude', 'commands', 'set-documentation.md'))).toBe(true);
    expect(existsSync(join(dest, '.claude', 'commands', 'update-documentation.md'))).toBe(true);

    // Claude Code: lean skills
    expect(existsSync(join(dest, '.claude', 'skills', 'dokai-docs', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dest, '.claude', 'skills', 'dokai-api', 'SKILL.md'))).toBe(true);

    // Other agents: full skills
    expect(existsSync(join(dest, '.agents', 'skills', 'dokai-docs', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dest, '.agents', 'skills', 'dokai-api', 'SKILL.md'))).toBe(true);

    // Other agents must not get commands
    expect(existsSync(join(dest, '.agents', 'commands'))).toBe(false);
  });

  it('honors the claude / agents flags — claude:false skips .claude/', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await copyAgentAssets({ dest, claude: false });
    expect(existsSync(join(dest, '.agents', 'skills', 'dokai-docs', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dest, '.agents', 'skills', 'dokai-api', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dest, '.claude'))).toBe(false);
  });

  it('honors the claude / agents flags — agents:false skips .agents/', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await copyAgentAssets({ dest, agents: false });
    expect(existsSync(join(dest, '.claude', 'skills', 'dokai-docs', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dest, '.claude', 'skills', 'dokai-api', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dest, '.agents'))).toBe(false);
  });

  it('preserves existing files unless overwrite is true', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await copyAgentAssets({ dest });
    const skillPath = join(dest, '.claude', 'skills', 'dokai-docs', 'SKILL.md');
    await writeFile(skillPath, '# user-edited');

    const second = await copyAgentAssets({ dest });
    expect(second.skipped).toContain(skillPath);
    expect(await readFile(skillPath, 'utf8')).toBe('# user-edited');

    const third = await copyAgentAssets({ dest, overwrite: true });
    expect(third.written).toContain(skillPath);
    expect((await readFile(skillPath, 'utf8')).startsWith('---\nname: dokai-docs\n')).toBe(true);
  });
});

describe('templates', () => {
  it('documents the OpenAPI convention in the AGENTS template', async () => {
    const body = await readFile(join(templatesRoot(), 'agents', 'AGENTS.md'), 'utf8');
    expect(body).toMatch(/DOKAI\/openapi/);
  });
});

describe('patchManagedDoc', () => {
  it('creates AGENTS.md with a managed dokai block when none exists', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const result = await patchAgentsMd({ dest });

    expect(result.action).toBe('created');
    const content = await readFile(join(dest, 'AGENTS.md'), 'utf8');
    expect(content).toContain('<!-- dokai:start -->');
    expect(content).toContain('<!-- dokai:end -->');
    // Confirm the body is the AGENTS template (the .agents skill paths), not the CLAUDE one.
    expect(content).toContain('.agents/skills/dokai-docs');
  });

  it('creates CLAUDE.md with a managed dokai block when none exists', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const result = await patchManagedDoc({
      dest,
      filename: 'CLAUDE.md',
      bodyTemplatePath: join(templatesRoot(), 'claude', 'CLAUDE.md'),
    });

    expect(result.action).toBe('created');
    const content = await readFile(join(dest, 'CLAUDE.md'), 'utf8');
    expect(content).toContain('<!-- dokai:start -->');
    expect(content).toContain('<!-- dokai:end -->');
    expect(content).toContain('/set-documentation');
  });

  it('is idempotent for AGENTS.md — re-running reports unchanged and does not duplicate the block', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await patchAgentsMd({ dest });
    const second = await patchAgentsMd({ dest });

    expect(second.action).toBe('unchanged');
    const content = await readFile(join(dest, 'AGENTS.md'), 'utf8');
    expect(content.match(/<!-- dokai:start -->/g)).toHaveLength(1);
  });

  it('is idempotent for CLAUDE.md — re-running reports unchanged and does not duplicate the block', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const bodyTemplatePath = join(templatesRoot(), 'claude', 'CLAUDE.md');
    await patchManagedDoc({ dest, filename: 'CLAUDE.md', bodyTemplatePath });
    const second = await patchManagedDoc({ dest, filename: 'CLAUDE.md', bodyTemplatePath });

    expect(second.action).toBe('unchanged');
    const content = await readFile(join(dest, 'CLAUDE.md'), 'utf8');
    expect(content.match(/<!-- dokai:start -->/g)).toHaveLength(1);
  });

  it('appends the block to an existing AGENTS.md without touching user content', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const userContent = '# AGENTS.md\n\nUse two-space indents. Run `npm test` before committing.\n';
    await writeFile(join(dest, 'AGENTS.md'), userContent);

    const result = await patchAgentsMd({ dest });
    expect(result.action).toBe('updated');

    const content = await readFile(join(dest, 'AGENTS.md'), 'utf8');
    expect(content).toContain('Use two-space indents.');
    expect(content).toContain('<!-- dokai:start -->');
    // The managed block sits after the user's content.
    expect(content.indexOf('two-space')).toBeLessThan(content.indexOf('<!-- dokai:start -->'));
  });

  it('appends the block to an existing CLAUDE.md without touching user content', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const userContent = '# CLAUDE.md\n\nAlways use TypeScript strict mode.\n';
    await writeFile(join(dest, 'CLAUDE.md'), userContent);

    const result = await patchManagedDoc({
      dest,
      filename: 'CLAUDE.md',
      bodyTemplatePath: join(templatesRoot(), 'claude', 'CLAUDE.md'),
    });
    expect(result.action).toBe('updated');

    const content = await readFile(join(dest, 'CLAUDE.md'), 'utf8');
    expect(content).toContain('TypeScript strict mode');
    expect(content).toContain('<!-- dokai:start -->');
    expect(content.indexOf('TypeScript strict mode')).toBeLessThan(
      content.indexOf('<!-- dokai:start -->'),
    );
  });
});

describe('removeLegacyAssets', () => {
  it('removes pre-existing legacy .claude/skills/dokai and .agents/skills/dokai dirs', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const claudeLegacy = join(dest, '.claude', 'skills', 'dokai');
    const agentsLegacy = join(dest, '.agents', 'skills', 'dokai');
    await mkdir(claudeLegacy, { recursive: true });
    await writeFile(join(claudeLegacy, 'SKILL.md'), '---\nname: dokai\n---\nlegacy');
    await mkdir(agentsLegacy, { recursive: true });
    await writeFile(join(agentsLegacy, 'SKILL.md'), '---\nname: dokai\n---\nlegacy');

    const result = await removeLegacyAssets({ dest });
    expect(result.removed).toContain(claudeLegacy);
    expect(result.removed).toContain(agentsLegacy);
    expect(existsSync(claudeLegacy)).toBe(false);
    expect(existsSync(agentsLegacy)).toBe(false);
  });

  it('is idempotent — returns empty removed array when legacy dirs are absent', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const result = await removeLegacyAssets({ dest });
    expect(result.removed).toHaveLength(0);
  });

  it('only removes the exact legacy dirs, not the new split skills', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    // Create new-style skill dirs (should NOT be removed)
    await mkdir(join(dest, '.claude', 'skills', 'dokai-docs'), { recursive: true });
    await writeFile(
      join(dest, '.claude', 'skills', 'dokai-docs', 'SKILL.md'),
      '---\nname: dokai-docs\n---',
    );

    const result = await removeLegacyAssets({ dest });
    expect(result.removed).toHaveLength(0);
    expect(existsSync(join(dest, '.claude', 'skills', 'dokai-docs', 'SKILL.md'))).toBe(true);
  });
});
