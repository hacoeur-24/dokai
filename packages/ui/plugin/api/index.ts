import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import type { ServerResponse, IncomingMessage } from 'node:http';
import type { ViteDevServer } from 'vite';
import matter from 'gray-matter';
import {
  buildSearchIndex,
  defaultFrontmatter,
  defaultSearchIndexPath,
  detectRepo,
  frontmatterSchema,
  loadSettings,
  pathToRoute,
  projectSettingsSchema,
  routeToPath,
  saveProjectSettings,
  saveUserSettings,
  scanDokai,
  scanOpenApiSpecs,
  userSettingsSchema,
  type DocNode,
  type SectionNode,
} from 'dokai-core/node';
import { resolveSpecContentType } from './openapi-raw.js';
import {
  buildAllowedHosts,
  filterForwardHeaders,
  isHostAllowed,
  parseTargetUrl,
  readRawBody,
  resolveRedirectTarget,
} from './openapi-proxy.js';

export interface DokaiApiOptions {
  server: ViteDevServer;
  repoRoot: string;
  mode: 'dev' | 'build';
}

/**
 * Mount /api endpoints onto a Vite dev server. Read endpoints are always available; write
 * endpoints are mounted only when mode === 'dev'.
 */
export function mountDokaiApi({ server, repoRoot, mode }: DokaiApiOptions): void {
  const dokaiRoot = join(repoRoot, 'DOKAI');
  const writesEnabled = mode === 'dev';

  server.middlewares.use(
    '/api/manifest',
    wrap(async (_req, res) => {
      const tree = await scanDokai({ dokaiRoot });
      const loaded = await loadSettings(dokaiRoot);
      const { specs } = loaded.project.openapi.enabled
        ? await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir })
        : { specs: [] };
      sendJson(res, {
        tree,
        docs: collectDocSummaries(tree),
        specs,
        capabilities: { tryItOut: mode === 'dev' },
      });
    }),
  );

  // PDF download. Renders the doc to HTML server-side and runs it through headless Chrome
  // (via Puppeteer) to produce a real text-selectable PDF. The browser print dialog is not
  // involved at any point.
  server.middlewares.use(
    '/api/doc/pdf',
    wrap(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x');
      const route = url.searchParams.get('route');
      if (!route) return sendError(res, 400, 'Missing ?route=');
      try {
        const { renderDocPdf } = await import('./pdf.js');
        const { buffer, filename } = await renderDocPdf({ repoRoot, route });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(Buffer.from(buffer));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendError(res, 500, `Failed to render PDF: ${msg}`);
      }
    }),
  );

  // Raw markdown download. Streams the file as text/markdown with an attachment disposition,
  // so a plain anchor tag with `download` triggers a save dialog. Path-traversal-safe.
  server.middlewares.use(
    '/api/doc/raw',
    wrap(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x');
      const route = url.searchParams.get('route');
      if (!route) return sendError(res, 400, 'Missing ?route=');
      const relativePath = routeToPath(route);
      const target = resolveSafePath(dokaiRoot, relativePath);
      if (!target || !existsSync(target)) {
        return sendError(res, 404, `No doc for route "${route}"`);
      }
      const filename = relativePath.split('/').pop() ?? 'document.md';
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      createReadStream(target).pipe(res);
    }),
  );

  server.middlewares.use(
    '/api/openapi/raw',
    wrap(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x');
      const rel = url.searchParams.get('path');
      if (!rel) return sendError(res, 400, 'Missing ?path=');
      const contentType = resolveSpecContentType(rel);
      if (!contentType) return sendError(res, 400, 'Spec path must be .yaml/.yml/.json');
      const target = resolveSafePath(dokaiRoot, rel);
      if (!target || !existsSync(target)) return sendError(res, 404, `No spec at "${rel}"`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      createReadStream(target).pipe(res);
    }),
  );

  server.middlewares.use(
    '/api/doc',
    wrap(async (req, res) => {
      const method = (req.method ?? 'GET').toUpperCase();
      const url = new URL(req.url ?? '/', 'http://x');
      const route = url.searchParams.get('route');
      if (!route) return sendError(res, 400, 'Missing ?route=');

      if (method === 'GET') {
        const tree = await scanDokai({ dokaiRoot });
        const doc = findByRoute(tree, route);
        if (!doc) return sendError(res, 404, `No doc for route "${route}"`);
        return sendJson(res, doc);
      }

      if (!writesEnabled) return sendError(res, 405, 'Writes disabled in static build');

      const target = resolveSafePath(dokaiRoot, routeToPath(route));
      if (!target) return sendError(res, 400, 'Route resolves outside DOKAI/');

      if (method === 'DELETE') {
        await rm(target, { force: true });
        return sendJson(res, { ok: true });
      }

      const body = await readJsonBody(req);

      if (method === 'POST') {
        const title = typeof body['title'] === 'string' ? body['title'] : null;
        if (!title) return sendError(res, 400, 'POST /api/doc requires title');
        const fm = defaultFrontmatter({
          title,
          description:
            typeof body['description'] === 'string' && body['description']
              ? body['description']
              : '',
        });
        const md = typeof body['body'] === 'string' ? body['body'] : `\n# ${title}\n`;
        const content = matter.stringify(md, fm);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
        return sendJson(res, {
          ok: true,
          route: pathToRoute(routeToPath(route)),
        });
      }

      if (method === 'PUT') {
        const fmInput = body['frontmatter'];
        const md = typeof body['bodyMarkdown'] === 'string' ? body['bodyMarkdown'] : '';
        const parsed = frontmatterSchema.safeParse(fmInput);
        if (!parsed.success) {
          return sendError(
            res,
            400,
            parsed.error.issues.map((issue: { message: string }) => issue.message).join('; '),
          );
        }
        const fm = { ...parsed.data, updatedAt: new Date().toISOString() };
        const content = matter.stringify(md, fm);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
        return sendJson(res, { ok: true });
      }

      if (method === 'PATCH') {
        const newRel =
          typeof body['newRelativePath'] === 'string' ? body['newRelativePath'].trim() : '';
        if (!newRel) return sendError(res, 400, 'PATCH /api/doc requires newRelativePath');
        if (!newRel.endsWith('.md'))
          return sendError(res, 400, 'newRelativePath must end with .md');
        const dest = resolveSafePath(dokaiRoot, newRel);
        if (!dest) return sendError(res, 400, 'newRelativePath resolves outside DOKAI/');
        if (dest === target) return sendJson(res, { ok: true, route: pathToRoute(newRel) });
        if (existsSync(dest)) return sendError(res, 409, `Target already exists: ${newRel}`);
        if (!existsSync(target)) return sendError(res, 404, `No doc for route "${route}"`);
        await mkdir(dirname(dest), { recursive: true });
        await rename(target, dest);
        return sendJson(res, { ok: true, route: pathToRoute(newRel) });
      }

      return sendError(res, 405, `Method ${method} not allowed`);
    }),
  );

  server.middlewares.use(
    '/api/settings',
    wrap(async (req, res) => {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        const loaded = await loadSettings(dokaiRoot);
        return sendJson(res, {
          project: loaded.project,
          user: loaded.user,
          errors: loaded.errors,
        });
      }
      if (!writesEnabled) return sendError(res, 405, 'Writes disabled in static build');
      if (method !== 'PUT') return sendError(res, 405, `Method ${method} not allowed`);
      const body = await readJsonBody(req);
      const parsed = projectSettingsSchema.safeParse(body);
      if (!parsed.success) {
        return sendError(
          res,
          400,
          parsed.error.issues.map((issue: { message: string }) => issue.message).join('; '),
        );
      }
      await saveProjectSettings(dokaiRoot, parsed.data);
      return sendJson(res, { ok: true });
    }),
  );

  server.middlewares.use(
    '/api/user-settings',
    wrap(async (req, res) => {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        const loaded = await loadSettings(dokaiRoot);
        return sendJson(res, loaded.user);
      }
      if (!writesEnabled) return sendError(res, 405, 'Writes disabled in static build');
      if (method !== 'PUT') return sendError(res, 405, `Method ${method} not allowed`);
      const body = await readJsonBody(req);
      const parsed = userSettingsSchema.safeParse(body);
      if (!parsed.success) {
        return sendError(
          res,
          400,
          parsed.error.issues.map((issue: { message: string }) => issue.message).join('; '),
        );
      }
      await saveUserSettings(dokaiRoot, parsed.data);
      return sendJson(res, { ok: true });
    }),
  );

  server.middlewares.use(
    '/api/search-index',
    wrap(async (_req, res) => {
      const tree = await scanDokai({ dokaiRoot });
      const loaded = await loadSettings(dokaiRoot);
      const { specs } = loaded.project.openapi.enabled
        ? await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir })
        : { specs: [] };
      const file = await buildSearchIndex(tree, defaultSearchIndexPath(dokaiRoot), { specs });
      sendJson(res, file);
    }),
  );

  server.middlewares.use(
    '/api/repo',
    wrap(async (_req, res) => {
      const info = await detectRepo({ root: repoRoot });
      sendJson(res, info);
    }),
  );

  server.middlewares.use(
    '/api/openapi/proxy',
    wrap(async (req, res) => {
      if (mode !== 'dev') return sendError(res, 405, 'Try-it-out is only available in `dokai dev`');
      const url = new URL(req.url ?? '/', 'http://x');
      const target = parseTargetUrl(url.searchParams.get('scalar_url'));
      if (!target) return sendError(res, 400, 'Missing or invalid ?scalar_url=');

      const loaded = await loadSettings(dokaiRoot);
      const { specs } = await scanOpenApiSpecs({ dokaiRoot, dir: loaded.project.openapi.dir });
      const allowed = buildAllowedHosts({
        settingsHosts: loaded.project.openapi.allowedHosts,
        specHosts: specs.flatMap((s) => s.serverHosts),
      });
      if (!isHostAllowed(target.hostname, allowed)) {
        return sendError(
          res,
          403,
          `Host "${target.hostname}" is not allowed. Add it to settings.json openapi.allowedHosts.`,
        );
      }

      const method = (req.method ?? 'GET').toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const body = hasBody ? await readRawBody(req, 10 * 1024 * 1024) : undefined;
      const forwardedHeaders = filterForwardHeaders(req.headers);

      const MAX_REDIRECTS = 5;
      let currentUrl = target.toString();
      let currentMethod = method;
      let currentBody: Buffer | undefined = body;
      let upstream: Response | null = null;

      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (hop === MAX_REDIRECTS) {
          return sendError(res, 502, 'Too many redirects');
        }
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(currentUrl, {
          method: currentMethod,
          headers: forwardedHeaders,
          body: currentBody,
          redirect: 'manual',
        });
        const status = response.status;
        if (status >= 300 && status < 400) {
          const location = response.headers.get('location');
          const next = resolveRedirectTarget(location, currentUrl, allowed);
          if (!next) {
            return sendError(res, 403, 'Redirect to a disallowed host was blocked');
          }
          currentUrl = next.toString();
          // 307/308: preserve method + body; 301/302/303: switch to GET, drop body
          if (status === 307 || status === 308) {
            // keep currentMethod and currentBody
          } else {
            currentMethod = 'GET';
            currentBody = undefined;
          }
          continue;
        }
        upstream = response;
        break;
      }

      if (!upstream) return sendError(res, 502, 'Too many redirects');
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.statusCode = upstream.status;
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'no-store');
      res.end(buf);
    }),
  );

  // Serves files for use as asset references (logos, images embedded in docs, etc).
  // Path conventions:
  //   "./foo" or "foo"    → resolved relative to DOKAI/
  //   "/foo"              → resolved relative to the repo root (e.g. "/public/logo.svg")
  //   "../foo"            → also resolved relative to DOKAI/ (escape allowed within the repo)
  // The resolved path MUST stay inside the repo root; anything else returns 404. This means
  // settings.json can point at a logo anywhere in the project (a shared `public/` folder is
  // a common case) without duplicating it into DOKAI/.
  server.middlewares.use('/dokai-asset', (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const requested = url.searchParams.get('path');
    if (!requested) {
      next();
      return;
    }
    const safe = resolveAssetPath(repoRoot, dokaiRoot, requested);
    if (!safe || !existsSync(safe)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    // Extension allowlist: only ever serve known image types. Anything else (source files,
    // .env, keys, etc.) is 404'd before a single byte is read, so this endpoint can never be
    // turned into an arbitrary-file-read primitive.
    const ext = (safe.split('.').pop() ?? '').toLowerCase();
    const types: Record<string, string> = {
      svg: 'image/svg+xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      ico: 'image/x-icon',
      avif: 'image/avif',
    };
    const contentType = types[ext];
    if (typeof contentType !== 'string') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    // Symlink hardening: the lexical resolve above can be defeated by a symlink inside the repo
    // that points outside it. Verify the *real* (symlink-resolved) path still lives under the
    // repo root before streaming.
    let real: string;
    try {
      real = realpathSync(safe);
      const realRoot = realpathSync(repoRoot);
      if (real !== realRoot && !real.startsWith(realRoot + sep)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
    } catch {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', contentType);
    // SVGs can carry inline scripts; forbid any active content when one is served.
    if (ext === 'svg') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    }
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(real).pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrap(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
): (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void {
  return (req, res, next) => {
    handler(req, res).catch((err: unknown) => next(err));
  };
}

function collectDocSummaries(
  tree: SectionNode,
): Array<Pick<DocNode, 'route' | 'frontmatter' | 'workspace' | 'relativePath'>> {
  const out: Array<Pick<DocNode, 'route' | 'frontmatter' | 'workspace' | 'relativePath'>> = [];
  const visit = (section: SectionNode): void => {
    for (const doc of section.docs) {
      out.push({
        route: doc.route,
        frontmatter: doc.frontmatter,
        workspace: doc.workspace,
        relativePath: doc.relativePath,
      });
    }
    for (const child of section.sections) visit(child);
  };
  visit(tree);
  return out;
}

function findByRoute(section: SectionNode, route: string): DocNode | null {
  for (const doc of section.docs) {
    if (doc.route === route) return doc;
  }
  for (const child of section.sections) {
    const found = findByRoute(child, route);
    if (found) return found;
  }
  return null;
}

function sendJson(res: ServerResponse, payload: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Resolve a relative path under dokaiRoot, refusing any path that escapes the folder. */
function resolveSafePath(dokaiRoot: string, relativePath: string): string | null {
  const target = resolve(dokaiRoot, relativePath);
  const root = resolve(dokaiRoot);
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

/**
 * Resolve an asset path. Supports:
 *   "./foo" or "foo"  → relative to DOKAI/
 *   "/foo"            → relative to the repo root (e.g. "/public/logo.svg")
 *   "../foo"          → relative to DOKAI/, allowing escape into the repo (but not above)
 * Always pinned inside the repo root; anything else returns null.
 */
function resolveAssetPath(repoRoot: string, dokaiRoot: string, requested: string): string | null {
  const cleaned = requested.replace(/^\.\//, '');
  const target = cleaned.startsWith('/')
    ? resolve(repoRoot, cleaned.slice(1))
    : resolve(dokaiRoot, cleaned);
  const root = resolve(repoRoot);
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}
