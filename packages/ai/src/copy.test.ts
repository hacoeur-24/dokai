import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyAgentAssets, patchAgentsMd, templatesRoot } from './copy.js';

describe('copyAgentAssets', () => {
  it('copies commands to .claude and the dokai skill to both .claude and .agents', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const result = await copyAgentAssets({ dest });

    expect(result.written.length).toBeGreaterThan(0);
    // Claude Code: slash commands + skill
    expect(existsSync(join(dest, '.claude', 'commands', 'set-documentation.md'))).toBe(true);
    expect(existsSync(join(dest, '.claude', 'commands', 'update-documentation.md'))).toBe(true);
    expect(existsSync(join(dest, '.claude', 'skills', 'dokai', 'SKILL.md'))).toBe(true);
    // Any other agent: the same skill (no commands)
    expect(existsSync(join(dest, '.agents', 'skills', 'dokai', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dest, '.agents', 'commands'))).toBe(false);

    const skill = await readFile(join(dest, '.agents', 'skills', 'dokai', 'SKILL.md'), 'utf8');
    expect(skill.startsWith('---\nname: dokai\n')).toBe(true);
  });

  it('honors the claude / agents flags', async () => {
    const claudeOnly = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await copyAgentAssets({ dest: claudeOnly, agents: false });
    expect(existsSync(join(claudeOnly, '.claude', 'skills', 'dokai', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(claudeOnly, '.agents'))).toBe(false);

    const agentsOnly = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await copyAgentAssets({ dest: agentsOnly, claude: false });
    expect(existsSync(join(agentsOnly, '.agents', 'skills', 'dokai', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(agentsOnly, '.claude'))).toBe(false);
  });

  it('preserves existing files unless overwrite is true', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await copyAgentAssets({ dest });
    const skillPath = join(dest, '.claude', 'skills', 'dokai', 'SKILL.md');
    await writeFile(skillPath, '# user-edited');

    const second = await copyAgentAssets({ dest });
    expect(second.skipped).toContain(skillPath);
    expect(await readFile(skillPath, 'utf8')).toBe('# user-edited');

    const third = await copyAgentAssets({ dest, overwrite: true });
    expect(third.written).toContain(skillPath);
    expect((await readFile(skillPath, 'utf8')).startsWith('---\nname: dokai')).toBe(true);
  });
});

describe('templates', () => {
  it('documents the OpenAPI convention in the AGENTS template', async () => {
    const body = await readFile(join(templatesRoot(), 'agents', 'AGENTS.md'), 'utf8');
    expect(body).toMatch(/DOKAI\/openapi/);
  });
});

describe('patchAgentsMd', () => {
  it('creates AGENTS.md with a managed dokai block when none exists', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    const result = await patchAgentsMd({ dest });

    expect(result.action).toBe('created');
    const content = await readFile(join(dest, 'AGENTS.md'), 'utf8');
    expect(content).toContain('<!-- dokai:start -->');
    expect(content).toContain('<!-- dokai:end -->');
    expect(content).toContain('.agents/skills/dokai/SKILL.md');
  });

  it('is idempotent — re-running reports unchanged and does not duplicate the block', async () => {
    const dest = await mkdtemp(join(tmpdir(), 'dokai-ai-'));
    await patchAgentsMd({ dest });
    const second = await patchAgentsMd({ dest });

    expect(second.action).toBe('unchanged');
    const content = await readFile(join(dest, 'AGENTS.md'), 'utf8');
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
});
