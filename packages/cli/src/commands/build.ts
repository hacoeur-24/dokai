import { resolve } from 'node:path';
import { runStaticBuild } from 'dokai-ui';
import { log } from '../lib/log.js';

export interface BuildOptions {
  root?: string;
}

/** Produce a static read-only site to DOKAI/.dokai/dist/. */
export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const repoRoot = resolve(options.root ?? process.cwd());
  const { outDir } = await runStaticBuild({ repoRoot });
  log.success(`Static build → ${outDir}`);
}
