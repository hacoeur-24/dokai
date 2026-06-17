import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TurboInfo } from '../types.js';

export function detectTurbo(repoRoot: string): TurboInfo | null {
  const turboPath = join(repoRoot, 'turbo.json');
  if (!existsSync(turboPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(turboPath, 'utf8')) as {
      tasks?: Record<string, unknown>;
      pipeline?: Record<string, unknown>;
    };
    const taskMap = raw.tasks ?? raw.pipeline ?? {};
    return { pipelines: Object.keys(taskMap).sort() };
  } catch {
    return null;
  }
}
