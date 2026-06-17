import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RepoShape } from 'dokai-core';

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * Templates ship next to the package. From the built `dist/` they live two levels up at
 * `<pkg>/templates`. From the source `src/` they live at `../templates`. Both resolutions land
 * on the same on-disk folder when the package is installed.
 */
const TEMPLATES_ROOT = join(HERE, '..', 'templates');

/** The single agent-agnostic skill folder name (under `.claude/skills/` and `.agents/skills/`). */
const SKILL_NAME = 'dokai';

export interface CopyAgentAssetsOptions {
  /** Repo root that should receive `.claude/` and `.agents/`. */
  dest: string;
  /** Repository shape — reserved for future variant selection. Currently informational. */
  repoShape?: RepoShape;
  /** When true, overwrite existing files; default `false` (preserve user edits). */
  overwrite?: boolean;
  /** Scaffold Claude Code assets: `.claude/commands/` + `.claude/skills/dokai/`. Default `true`. */
  claude?: boolean;
  /** Scaffold agent-agnostic assets: `.agents/skills/dokai/`. Default `true`. */
  agents?: boolean;
}

export interface CopyAgentAssetsResult {
  written: string[];
  skipped: string[];
  /** Absolute path of the templates root used as the source. */
  source: string;
}

/**
 * Copy the bundled agent assets into a destination repo:
 *   - `.claude/commands/*`            — Claude Code slash commands (Claude only)
 *   - `.claude/skills/dokai/*`        — the DOKAI skill, for Claude Code
 *   - `.agents/skills/dokai/*`        — the same skill, for any other agent
 *
 * Slash commands are Claude-specific; every other agent relies on the skill. Existing files are
 * preserved unless `overwrite` is true.
 */
export async function copyAgentAssets(
  options: CopyAgentAssetsOptions,
): Promise<CopyAgentAssetsResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  const overwrite = options.overwrite ?? false;
  const claude = options.claude ?? true;
  const agents = options.agents ?? true;

  const skillSource = join(TEMPLATES_ROOT, 'skills', SKILL_NAME);

  if (claude) {
    await copyTree({
      sourceRoot: join(TEMPLATES_ROOT, 'commands'),
      targetRoot: join(options.dest, '.claude', 'commands'),
      written,
      skipped,
      overwrite,
    });
    await copyTree({
      sourceRoot: skillSource,
      targetRoot: join(options.dest, '.claude', 'skills', SKILL_NAME),
      written,
      skipped,
      overwrite,
    });
  }

  if (agents) {
    await copyTree({
      sourceRoot: skillSource,
      targetRoot: join(options.dest, '.agents', 'skills', SKILL_NAME),
      written,
      skipped,
      overwrite,
    });
  }

  return { written, skipped, source: TEMPLATES_ROOT };
}

const AGENTS_MARKER_START = '<!-- dokai:start -->';
const AGENTS_MARKER_END = '<!-- dokai:end -->';

export interface PatchAgentsMdResult {
  /** Absolute path of the AGENTS.md file. */
  path: string;
  /** What the patch did. `unchanged` means the managed block was already current. */
  action: 'created' | 'updated' | 'unchanged';
}

/**
 * Idempotently maintain a DOKAI-managed block in the repo root `AGENTS.md` — the file Codex,
 * Cursor, and other agents read. The block (delimited by `<!-- dokai:start -->` /
 * `<!-- dokai:end -->`) points agents at the `.agents/skills/dokai/` skill. The user's own content
 * outside the markers is never touched; re-running only refreshes the managed block.
 */
export async function patchAgentsMd(options: { dest: string }): Promise<PatchAgentsMdResult> {
  const path = join(options.dest, 'AGENTS.md');
  const body = (await readFile(join(TEMPLATES_ROOT, 'agents', 'AGENTS.md'), 'utf8')).trim();
  const block = `${AGENTS_MARKER_START}\n\n${body}\n\n${AGENTS_MARKER_END}`;

  if (!existsSync(path)) {
    await writeFile(path, `# AGENTS.md\n\n${block}\n`, 'utf8');
    return { path, action: 'created' };
  }

  const existing = await readFile(path, 'utf8');
  const start = existing.indexOf(AGENTS_MARKER_START);
  const end = existing.indexOf(AGENTS_MARKER_END);

  if (start !== -1 && end !== -1 && end > start) {
    const next = `${existing.slice(0, start)}${block}${existing.slice(end + AGENTS_MARKER_END.length)}`;
    if (next === existing) return { path, action: 'unchanged' };
    await writeFile(path, next, 'utf8');
    return { path, action: 'updated' };
  }

  // No managed block yet: append it, preserving the user's existing content.
  const next = `${existing.replace(/\s+$/, '')}\n\n${block}\n`;
  await writeFile(path, next, 'utf8');
  return { path, action: 'updated' };
}

async function copyTree(args: {
  sourceRoot: string;
  targetRoot: string;
  written: string[];
  skipped: string[];
  overwrite: boolean;
}): Promise<void> {
  const { sourceRoot, targetRoot } = args;
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    const source = join(sourceRoot, entry.name);
    const target = join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      await copyTree({ ...args, sourceRoot: source, targetRoot: target });
      continue;
    }
    if (existsSync(target) && !args.overwrite) {
      args.skipped.push(target);
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    const buf = await readFile(source);
    await writeFile(target, buf);
    args.written.push(target);
  }
  // ensure target dir exists even when source dir was empty
  if (!existsSync(targetRoot)) {
    const stats = await stat(sourceRoot);
    if (stats.isDirectory()) await mkdir(targetRoot, { recursive: true });
  }
}

/** Resolve the absolute path to the templates folder, used by tests and the CLI. */
export function templatesRoot(): string {
  return TEMPLATES_ROOT;
}

/** Compute the relative path of a template file (used for human-friendly logging). */
export function relativeTemplatePath(absolute: string): string {
  return relative(TEMPLATES_ROOT, absolute);
}
