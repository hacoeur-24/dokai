import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  defaultProjectSettings,
  defaultUserSettings,
  type RepoInfo,
  type RepoShape,
  type WorkspaceEntry,
} from 'dokai-core';

const PROJECT_FILE = 'settings.json';
const USER_FILE = 'user-settings.local.json';

export interface ScaffoldSettingsResult {
  written: string[];
  skipped: string[];
}

/** Create DOKAI/settings.json (committed) and DOKAI/user-settings.local.json (gitignored). */
export async function scaffoldSettings(opts: {
  dokaiRoot: string;
  projectName: string;
  repo: RepoInfo;
  workspaceMappings: Array<{ workspace: WorkspaceEntry; dokaiPath: string }>;
}): Promise<ScaffoldSettingsResult> {
  const written: string[] = [];
  const skipped: string[] = [];

  const project = defaultProjectSettings({
    projectName: opts.projectName,
    repository: {
      type: shapeToSettingsType(opts.repo.shape),
      structure: opts.workspaceMappings.length > 0 ? 'workspace-mapped' : 'auto',
      monorepo: opts.repo.workspaces.length > 0,
      turborepo: opts.repo.turbo !== null,
    },
  });

  const user = defaultUserSettings();

  await writeOnce(join(opts.dokaiRoot, PROJECT_FILE), project, written, skipped);
  await writeOnce(join(opts.dokaiRoot, USER_FILE), user, written, skipped);

  return { written, skipped };
}

function shapeToSettingsType(shape: RepoShape): 'normal' | 'workspaces' | 'turborepo' | 'monorepo' {
  switch (shape) {
    case 'normal':
      return 'normal';
    case 'workspaces':
      return 'workspaces';
    case 'turborepo':
      return 'turborepo';
    case 'monorepo-non-turbo':
      return 'monorepo';
  }
}

async function writeOnce(
  path: string,
  value: unknown,
  written: string[],
  skipped: string[],
): Promise<void> {
  if (existsSync(path)) {
    skipped.push(path);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  written.push(path);
}
