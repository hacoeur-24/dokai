import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

export interface CopyAgentAssetsOptions {
  /** Repo root that should receive `.claude/` and `.agents/`. */
  dest: string;
  /** Repository shape — reserved for future variant selection. Currently informational. */
  repoShape?: RepoShape;
  /** When true, overwrite existing files; default `false` (preserve user edits). */
  overwrite?: boolean;
  /** Scaffold Claude Code assets: `.claude/agents/`, `.claude/commands/`, `.claude/skills/`. Default `true`. */
  claude?: boolean;
  /** Scaffold agent-agnostic assets: `.agents/skills/`. Default `true`. */
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
 *   - `.claude/agents/*`            — Claude sub-agents (Claude only)
 *   - `.claude/commands/*`          — Claude Code slash commands (Claude only)
 *   - `.claude/skills/*`            — lean skills for Claude Code
 *   - `.agents/skills/*`            — full skills for any other agent
 *
 * Slash commands and sub-agents are Claude-specific; every other agent relies on the skills under
 * `.agents/`. Existing files are preserved unless `overwrite` is true.
 */
export async function copyAgentAssets(
  options: CopyAgentAssetsOptions,
): Promise<CopyAgentAssetsResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  const overwrite = options.overwrite ?? false;
  const claude = options.claude ?? true;
  const agents = options.agents ?? true;

  if (claude) {
    await copyTree({
      sourceRoot: join(TEMPLATES_ROOT, 'claude', 'agents'),
      targetRoot: join(options.dest, '.claude', 'agents'),
      written,
      skipped,
      overwrite,
    });
    await copyTree({
      sourceRoot: join(TEMPLATES_ROOT, 'claude', 'commands'),
      targetRoot: join(options.dest, '.claude', 'commands'),
      written,
      skipped,
      overwrite,
    });
    await copyTree({
      sourceRoot: join(TEMPLATES_ROOT, 'claude', 'skills'),
      targetRoot: join(options.dest, '.claude', 'skills'),
      written,
      skipped,
      overwrite,
    });
  }

  if (agents) {
    await copyTree({
      sourceRoot: join(TEMPLATES_ROOT, 'agents', 'skills'),
      targetRoot: join(options.dest, '.agents', 'skills'),
      written,
      skipped,
      overwrite,
    });
  }

  return { written, skipped, source: TEMPLATES_ROOT };
}

const MANAGED_MARKER_START = '<!-- dokai:start -->';
const MANAGED_MARKER_END = '<!-- dokai:end -->';

export interface PatchManagedDocResult {
  /** Absolute path of the patched file. */
  path: string;
  /** What the patch did. `unchanged` means the managed block was already current. */
  action: 'created' | 'updated' | 'unchanged';
}

/**
 * Idempotently maintain a DOKAI-managed block in a root-level markdown file (e.g. `AGENTS.md` or
 * `CLAUDE.md`). The block is delimited by `<!-- dokai:start -->` / `<!-- dokai:end -->` markers.
 * User content outside the markers is never touched; re-running only refreshes the managed block.
 *
 * - When the file does not exist: creates it with a heading and the managed block.
 * - When the file exists and already has the markers: replaces the block content in place.
 * - When the file exists but has no markers: appends the block, preserving user content.
 */
export async function patchManagedDoc(options: {
  /** Repo root — the file will be written at `<dest>/<filename>`. */
  dest: string;
  /** Filename to create or patch, e.g. `AGENTS.md` or `CLAUDE.md`. */
  filename: string;
  /** Absolute path to the template file whose contents become the managed-block body. */
  bodyTemplatePath: string;
}): Promise<PatchManagedDocResult> {
  const filePath = join(options.dest, options.filename);
  const body = (await readFile(options.bodyTemplatePath, 'utf8')).trim();
  const block = `${MANAGED_MARKER_START}\n\n${body}\n\n${MANAGED_MARKER_END}`;

  if (!existsSync(filePath)) {
    const heading = `# ${options.filename.replace(/\.md$/i, '')}`;
    await writeFile(filePath, `${heading}\n\n${block}\n`, 'utf8');
    return { path: filePath, action: 'created' };
  }

  const existing = await readFile(filePath, 'utf8');
  const start = existing.indexOf(MANAGED_MARKER_START);
  const end = existing.indexOf(MANAGED_MARKER_END);

  if (start !== -1 && end !== -1 && end > start) {
    const next = `${existing.slice(0, start)}${block}${existing.slice(end + MANAGED_MARKER_END.length)}`;
    if (next === existing) return { path: filePath, action: 'unchanged' };
    await writeFile(filePath, next, 'utf8');
    return { path: filePath, action: 'updated' };
  }

  // No managed block yet: append it, preserving the user's existing content.
  const next = `${existing.replace(/\s+$/, '')}\n\n${block}\n`;
  await writeFile(filePath, next, 'utf8');
  return { path: filePath, action: 'updated' };
}

/**
 * Backward-compatible thin wrapper: patches `AGENTS.md` using the bundled agents template.
 */
export async function patchAgentsMd(options: {
  dest: string;
}): Promise<PatchManagedDocResult> {
  return patchManagedDoc({
    dest: options.dest,
    filename: 'AGENTS.md',
    bodyTemplatePath: join(TEMPLATES_ROOT, 'agents', 'AGENTS.md'),
  });
}

/**
 * Patches `CLAUDE.md` using the bundled Claude template.
 */
export async function patchClaudeMd(options: {
  dest: string;
}): Promise<PatchManagedDocResult> {
  return patchManagedDoc({
    dest: options.dest,
    filename: 'CLAUDE.md',
    bodyTemplatePath: join(TEMPLATES_ROOT, 'claude', 'CLAUDE.md'),
  });
}

export interface RemoveLegacyAssetsResult {
  /** Absolute paths that were removed. Empty when already absent (idempotent). */
  removed: string[];
}

/**
 * Remove the pre-split single `dokai` skill directories if they exist:
 *   - `<dest>/.claude/skills/dokai/`
 *   - `<dest>/.agents/skills/dokai/`
 *
 * These were created by dokai versions before the dokai-docs / dokai-api split. Idempotent: a
 * no-op when the directories are already absent.
 */
export async function removeLegacyAssets(options: {
  dest: string;
}): Promise<RemoveLegacyAssetsResult> {
  const candidates = [
    join(options.dest, '.claude', 'skills', 'dokai'),
    join(options.dest, '.agents', 'skills', 'dokai'),
  ];
  const removed: string[] = [];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      await rm(candidate, { recursive: true, force: true });
      removed.push(candidate);
    }
  }
  return { removed };
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
