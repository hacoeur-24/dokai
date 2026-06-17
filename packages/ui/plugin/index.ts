import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type { Plugin, ViteDevServer } from 'vite';
import { build, preview, type ViteDevServer as ViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { mountDokaiApi } from './api/index.js';

/**
 * Resolve a package's *directory* (not its entry file) from the consumer's repo root, falling
 * back to dokai-ui's own resolution. Used to pin `react` and `react-dom` to a single absolute
 * directory so Vite cannot accidentally load two instances of React (which manifests as the
 * runtime error "useDokai hooks must be used inside <DokaiProvider>").
 *
 * Pnpm's symlinked node_modules layout makes plain `resolve.dedupe` unreliable: the same React
 * package can be reachable through multiple symlinked paths, and Vite may resolve them to
 * different module instances depending on which import gets evaluated first. Forcing every
 * import of `react` and `react/<subpath>` (e.g. `react/jsx-runtime`) to a single physical
 * directory collapses everything to a single instance.
 *
 * We deliberately resolve `<name>/package.json` rather than `<name>` because the latter returns
 * the entry file path (`react/index.js`); aliasing `react` → `react/index.js` and then importing
 * `react/jsx-runtime` would produce `react/index.js/jsx-runtime`, which is a non-existent path.
 */
function resolveConsumerPackageDir(name: string, repoRoot: string): string | undefined {
  const tryResolve = (req: NodeJS.Require): string | undefined => {
    try {
      return dirname(req.resolve(`${name}/package.json`));
    } catch {
      return undefined;
    }
  };
  // Try the consumer's project root first (where peerDependencies install React).
  const fromConsumer = tryResolve(createRequire(resolve(repoRoot, 'noop.js')));
  if (fromConsumer) return fromConsumer;
  // Fall back to dokai-ui's own resolution.
  return tryResolve(createRequire(import.meta.url));
}

function reactAliases(repoRoot: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  const reactDir = resolveConsumerPackageDir('react', repoRoot);
  const reactDomDir = resolveConsumerPackageDir('react-dom', repoRoot);
  if (reactDir) aliases['react'] = reactDir;
  if (reactDomDir) aliases['react-dom'] = reactDomDir;
  return aliases;
}

export interface DokaiPluginOptions {
  /** Repo root that owns the DOKAI/ folder. Required. */
  repoRoot: string;
  /** "dev" exposes write endpoints; "build" hard-removes them. Defaults to "dev". */
  mode?: 'dev' | 'build';
}

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin that mounts /api routes for the DOKAI documentation UI. In dev mode it exposes
 * read + write endpoints; in build mode the same plugin runs once to bake the manifest into a
 * static JSON file and disables writes.
 */
export function dokaiPlugin(options: DokaiPluginOptions): Plugin {
  const repoRoot = resolve(options.repoRoot);
  const mode = options.mode ?? 'dev';

  return {
    name: 'dokai',
    configureServer(server: ViteDevServer) {
      mountDokaiApi({ server, repoRoot, mode });
    },
    configurePreviewServer(server) {
      // Honor the plugin's configured mode rather than forcing 'build'. This lets
      // `startDevServer` reuse the static-preview path with writes enabled (mode:'dev'),
      // while `runStaticPreview` still passes mode:'build' for read-only behavior.
      mountDokaiApi({
        server: server as unknown as ViteDevServer,
        repoRoot,
        mode,
      });
    },
  };
}

/**
 * Resolve the absolute path of the UI package source. Used by the CLI so Vite can be pointed
 * at the installed package's source dir, not the consumer's repo.
 */
export function uiAppRoot(): string {
  // From the published `dist/plugin/index.js`, the package root is two levels up.
  // From source `plugin/index.ts`, it is one level up.
  const candidates = [resolve(HERE, '..'), resolve(HERE, '..', '..')];
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'index.html'))) return candidate;
  }
  throw new Error('Could not locate dokai-ui app root (missing index.html).');
}

export interface BootDevServerOptions {
  repoRoot: string;
  port?: number;
}

/**
 * One-call dev server bootstrap. Returns the running Vite preview server.
 *
 * v0.3.6 architectural change: instead of spinning up a Vite **dev** server (which compiled
 * `src/main.tsx` on the fly inside the consumer's environment and was vulnerable to React
 * module duplication under pnpm's symlinked node_modules), we now serve the prebuilt UI bundle
 * shipped at `<dokai-ui-package>/dist/app/`. That bundle was compiled by Vite at publish time
 * with a clean dependency tree, so there's exactly one React instance baked into the JS chunks
 * and no resolution happens at runtime.
 *
 * `dokaiPlugin({ mode: 'dev' })` keeps the write endpoints (save / delete / rename / settings)
 * mounted on the preview server's middleware stack, so the consumer experience is identical to
 * the old dev server minus the bug class.
 */
export async function startDevServer(options: BootDevServerOptions): Promise<ViteServer> {
  const repoRoot = resolve(options.repoRoot);
  const root = uiAppRoot();
  const outDir = resolve(root, 'dist', 'app');

  if (!existsSync(resolve(outDir, 'index.html'))) {
    throw new Error(
      `DOKAI bundle not found at ${outDir}. The installed dokai-ui ` +
        `package appears to be missing its prebuilt UI — try reinstalling.`,
    );
  }

  const server = await preview({
    root,
    configFile: false,
    preview: {
      port: options.port ?? 8128,
      strictPort: false,
      host: 'localhost',
    },
    plugins: [dokaiPlugin({ repoRoot, mode: 'dev' })],
    build: { outDir },
  });
  server.printUrls();
  return server as unknown as ViteServer;
}

export interface BuildOptions {
  repoRoot: string;
  /** Where to emit the static site. Defaults to <repoRoot>/DOKAI/.dokai/dist. */
  outDir?: string;
}

/** Produce a static read-only build to `<repoRoot>/DOKAI/.dokai/dist`. */
export async function runStaticBuild(options: BuildOptions): Promise<{ outDir: string }> {
  const repoRoot = resolve(options.repoRoot);
  const outDir = options.outDir ?? resolve(repoRoot, 'DOKAI', '.dokai', 'dist');
  await build({
    root: uiAppRoot(),
    configFile: false,
    plugins: [react(), tailwindcss(), dokaiPlugin({ repoRoot, mode: 'build' })],
    resolve: {
      // Same single-React reasoning as `startDevServer`.
      alias: reactAliases(repoRoot),
      dedupe: ['react', 'react-dom'],
    },
    build: { outDir, emptyOutDir: true, sourcemap: true },
    logLevel: 'warn',
  });
  return { outDir };
}

export interface PreviewOptions {
  repoRoot: string;
  port?: number;
}

/** Serve a previously-built static site for verification. */
export async function runStaticPreview(options: PreviewOptions): Promise<{ port: number }> {
  const repoRoot = resolve(options.repoRoot);
  const outDir = resolve(repoRoot, 'DOKAI', '.dokai', 'dist');
  const server = await preview({
    root: uiAppRoot(),
    configFile: false,
    preview: {
      port: options.port ?? 8128,
      strictPort: false,
      host: 'localhost',
    },
    plugins: [dokaiPlugin({ repoRoot, mode: 'build' })],
    build: { outDir },
  });
  server.printUrls();
  const port = server.config.preview.port ?? options.port ?? 8128;
  return { port };
}

export type { DokaiApiOptions } from './api/index.js';
