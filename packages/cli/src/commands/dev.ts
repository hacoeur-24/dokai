import { resolve } from 'node:path';
import { startDevServer } from 'dokai-ui';
import { log } from '../lib/log.js';

export interface DevOptions {
  port?: number;
  root?: string;
}

/** Boot the Vite + middleware server pointed at the DOKAI/ folder of the consumer's repo. */
export async function runDev(options: DevOptions = {}): Promise<void> {
  const repoRoot = resolve(options.root ?? process.cwd());
  const server = await startDevServer({
    repoRoot,
    ...(options.port !== undefined ? { port: options.port } : {}),
  });
  const port = server.config.preview.port ?? options.port ?? 8128;
  log.success(`DOKAI dev server running on http://localhost:${port}`);
  log.detail(`Repo root: ${repoRoot}`);
}
