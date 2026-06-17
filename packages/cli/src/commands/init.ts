import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import pc from 'picocolors';
import prompts from 'prompts';
import { detectRepo, type RepoInfo, type WorkspaceEntry } from 'dokai-core/node';
import { scaffoldDokaiFolder, suggestWorkspaceMappings } from '../scaffold/dokai-folder.js';
import { scaffoldSettings } from '../scaffold/settings.js';
import { patchGitignore } from '../scaffold/gitignore.js';
import { patchPackageJsonScripts } from '../scaffold/package-json.js';
import { scaffoldAgentAssets } from '../scaffold/agents.js';
import { log } from '../lib/log.js';

export interface InitOptions {
  /** Repo root (resolved). Defaults to process.cwd(). */
  root?: string;
  /** Skip interactive prompts and accept defaults. */
  yes?: boolean;
  /** Skip Claude command/skill scaffolding (`.claude/`). */
  noClaude?: boolean;
  /** Skip agent-agnostic scaffolding (`.agents/` + `AGENTS.md`). */
  noAgents?: boolean;
  /** Skip package.json script patching. */
  skipScripts?: boolean;
  /** Override the default project name. */
  projectName?: string;
  /** Explicitly select which workspace packages to map (by name). */
  workspaces?: string[];
  /** Suppress interactive output (used by tests). */
  quiet?: boolean;
}

export interface InitSummary {
  repo: RepoInfo;
  dokaiRoot: string;
  filesWritten: string[];
  filesSkipped: string[];
  scriptsChanged: Array<{
    name: string;
    previous: string | null;
    next: string;
  }>;
  gitignoreAdded: string[];
}

/** Run the full init flow against the given repo root. Idempotent: re-runs leave state stable. */
export async function runInit(options: InitOptions = {}): Promise<InitSummary> {
  const root = resolve(options.root ?? process.cwd());

  if (!existsSync(join(root, 'package.json'))) {
    throw new Error(
      `No package.json found at ${root}. Run \`dokai init\` from a repo root, or pass --root.`,
    );
  }

  const repo = await detectRepo({ root });

  if (!options.quiet) {
    log.step(`Detected repository`);
    log.detail(`shape: ${repo.shape}`);
    log.detail(`package manager: ${repo.packageManager}`);
    if (repo.workspaces.length) {
      log.detail(`workspaces: ${repo.workspaces.length}`);
    }
    if (repo.turbo) {
      log.detail(`turbo pipelines: ${repo.turbo.pipelines.join(', ') || '(none)'}`);
    }
  }

  const dokaiRoot = join(root, 'DOKAI');
  const projectName = options.projectName ?? deriveProjectName(root);
  const workspaceSelection = await selectWorkspaceMappings(repo.workspaces, options);
  const workspaceMappings = suggestWorkspaceMappings(workspaceSelection);

  const filesWritten: string[] = [];
  const filesSkipped: string[] = [];

  const folder = await scaffoldDokaiFolder({
    dokaiRoot,
    repo,
    workspaceMappings,
  });
  filesWritten.push(...folder.written);
  filesSkipped.push(...folder.skipped);

  const settings = await scaffoldSettings({
    dokaiRoot,
    projectName,
    repo,
    workspaceMappings,
  });
  filesWritten.push(...settings.written);
  filesSkipped.push(...settings.skipped);

  const gitignore = await patchGitignore(root);

  let scriptsChanged: InitSummary['scriptsChanged'] = [];
  if (!options.skipScripts) {
    const patched = await patchPackageJsonScripts(root);
    scriptsChanged = patched.changed;
  }

  if (!options.noClaude || !options.noAgents) {
    const assets = await scaffoldAgentAssets({
      repoRoot: root,
      claude: !options.noClaude,
      agents: !options.noAgents,
    });
    filesWritten.push(...assets.written);
    filesSkipped.push(...assets.skipped);
  }

  if (!options.quiet) {
    printSummary({
      root,
      dokaiRoot,
      filesWritten,
      filesSkipped,
      scriptsChanged,
      gitignoreAdded: gitignore.added,
      packageManager: repo.packageManager,
    });
  }

  return {
    repo,
    dokaiRoot,
    filesWritten,
    filesSkipped,
    scriptsChanged,
    gitignoreAdded: gitignore.added,
  };
}

async function selectWorkspaceMappings(
  workspaces: WorkspaceEntry[],
  options: InitOptions,
): Promise<WorkspaceEntry[]> {
  if (workspaces.length === 0) return [];

  if (options.workspaces) {
    const requested = new Set(options.workspaces);
    return workspaces.filter((w) => requested.has(w.name) || requested.has(w.path));
  }

  if (options.yes) return workspaces;

  const response = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Map workspace packages to DOKAI sections?',
    choices: workspaces.map((w) => ({
      title: `${w.name}  ${pc.dim(`(${w.category}, ${w.path})`)}`,
      value: w.path,
      selected: true,
    })),
    hint: 'Space to toggle. Return to confirm.',
    instructions: false,
  });

  const selected: string[] = response.selected ?? [];
  return workspaces.filter((w) => selected.includes(w.path));
}

function deriveProjectName(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: string };
    if (typeof pkg.name === 'string' && pkg.name.length > 0) {
      return `${humanize(pkg.name)} Documentation`;
    }
  } catch {
    /* fall through */
  }
  return 'Project Documentation';
}

function humanize(name: string): string {
  const stripped = name.replace(/^@[^/]+\//, '');
  return stripped
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function printSummary(input: {
  root: string;
  dokaiRoot: string;
  filesWritten: string[];
  filesSkipped: string[];
  scriptsChanged: InitSummary['scriptsChanged'];
  gitignoreAdded: string[];
  packageManager: string;
}): void {
  log.step('Wrote files');
  for (const path of input.filesWritten) {
    log.detail(relative(input.root, path));
  }

  if (input.filesSkipped.length > 0) {
    log.step(`Left existing files alone (${input.filesSkipped.length})`);
  }

  if (input.scriptsChanged.length > 0) {
    log.step('Updated package.json scripts');
    for (const change of input.scriptsChanged) {
      log.detail(`${change.name}  ${pc.dim(change.previous ? `was: ${change.previous}` : 'new')}`);
    }
  }

  if (input.gitignoreAdded.length > 0) {
    log.step('Updated .gitignore');
    for (const line of input.gitignoreAdded) log.detail(line);
  }

  log.step('Next steps');
  const runner = pickRunner(input.packageManager);
  log.detail(`${runner} dokai            ${pc.dim('# launch the documentation UI on :8128')}`);
  log.detail(`${runner} dokai:build      ${pc.dim('# produce a static read-only site')}`);
  log.success('DOKAI is ready.');
}

function pickRunner(pm: string): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun';
    default:
      return 'npm run';
  }
}
