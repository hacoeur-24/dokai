import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type z } from 'zod';
import { projectSettingsSchema, type ProjectSettings } from './schemas/project-settings.js';
import { userSettingsSchema, type UserSettings } from './schemas/user-settings.js';

export interface LoadedSettings {
  project: ProjectSettings;
  user: UserSettings;
  /** Per-key origin so the UI can label "shared with team" vs "local only". */
  provenance: {
    /** Top-level keys that came from `DOKAI/settings.json` rather than defaults. */
    project: Set<keyof ProjectSettings>;
    /** Top-level keys that came from `DOKAI/user-settings.local.json` rather than defaults. */
    user: Set<keyof UserSettings>;
  };
  /** Validation errors collected without throwing — surfaced in dev as toasts. */
  errors: SettingsLoadError[];
}

export interface SettingsLoadError {
  file: 'settings.json' | 'user-settings.local.json';
  message: string;
}

const PROJECT_FILE = 'settings.json';
const USER_FILE = 'user-settings.local.json';

/** Load both settings files from a DOKAI/ root, validate, and return a merged shape. */
export async function loadSettings(dokaiRoot: string): Promise<LoadedSettings> {
  const errors: SettingsLoadError[] = [];

  const projectRaw = await readJsonIfExists(join(dokaiRoot, PROJECT_FILE));
  const userRaw = await readJsonIfExists(join(dokaiRoot, USER_FILE));

  const project = parseWithFallback(
    projectSettingsSchema,
    projectRaw,
    PROJECT_FILE,
    errors,
  ) as ProjectSettings;
  const user = parseWithFallback(userSettingsSchema, userRaw, USER_FILE, errors) as UserSettings;

  return {
    project,
    user,
    provenance: {
      project: new Set(
        Object.keys((projectRaw as Record<string, unknown> | null) ?? {}) as Array<
          keyof ProjectSettings
        >,
      ),
      user: new Set(
        Object.keys((userRaw as Record<string, unknown> | null) ?? {}) as Array<keyof UserSettings>,
      ),
    },
    errors,
  };
}

/** Persist project settings, creating the file if needed. */
export async function saveProjectSettings(
  dokaiRoot: string,
  settings: ProjectSettings,
): Promise<void> {
  const validated = projectSettingsSchema.parse(settings);
  await writeJson(join(dokaiRoot, PROJECT_FILE), validated);
}

/** Persist user settings, creating the file if needed. */
export async function saveUserSettings(dokaiRoot: string, settings: UserSettings): Promise<void> {
  const validated = userSettingsSchema.parse(settings);
  await writeJson(join(dokaiRoot, USER_FILE), validated);
}

async function readJsonIfExists(path: string): Promise<unknown> {
  if (!existsSync(path)) return null;
  const raw = await readFile(path, 'utf8');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON at ${path}: ${(err as Error).message}`);
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseWithFallback<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  file: SettingsLoadError['file'],
  errors: SettingsLoadError[],
): z.infer<T> {
  const result = schema.safeParse(raw ?? undefined);
  if (result.success) return result.data;

  for (const issue of result.error.issues) {
    errors.push({
      file,
      message: `${issue.path.join('.') || '<root>'}: ${issue.message}`,
    });
  }
  return schema.parse(undefined);
}
