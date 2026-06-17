import { resolve } from 'node:path';
import { runStaticPreview } from 'dokai-ui';
import { log } from '../lib/log.js';

export interface PreviewOptions {
  root?: string;
  port?: number;
}

/** Serve the static build for local verification. */
export async function runPreview(options: PreviewOptions = {}): Promise<void> {
  const repoRoot = resolve(options.root ?? process.cwd());
  const { port } = await runStaticPreview({
    repoRoot,
    ...(options.port !== undefined ? { port: options.port } : {}),
  });
  log.success(`Preview running on http://localhost:${port}`);
}
