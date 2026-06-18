/**
 * Translates between filesystem paths inside DOKAI/ and the deterministic web routes used
 * in the documentation UI.
 *
 *   DOKAI/backend/api.md  ↔  /dokai/backend/api
 *   DOKAI/index.md        ↔  /dokai
 *   DOKAI/foo/index.md    ↔  /dokai/foo
 */

const SLASH = '/';
const ROOT_PREFIX = '/dokai';

/** Convert a path relative to DOKAI/ (forward slashes, no leading slash) to a route. */
export function pathToRoute(relativePath: string): string {
  const normalized = stripExtension(stripIndex(stripLeading(relativePath, SLASH)));
  if (!normalized) return ROOT_PREFIX;
  return `${ROOT_PREFIX}/${normalized}`;
}

/** Convert a route back to a relative path. Always returns the canonical `.md` form. */
export function routeToPath(route: string): string {
  const trimmed = stripLeading(route, ROOT_PREFIX);
  const inner = stripLeading(trimmed, SLASH);
  if (!inner) return 'index.md';
  return `${inner}.md`;
}

/** Build an anchor link (route + heading slug). */
export function anchorRoute(route: string, slug: string): string {
  return slug ? `${route}#${slug}` : route;
}

function stripExtension(path: string): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

function stripIndex(path: string): string {
  if (path === 'index.md' || path === 'index') return '';
  if (path.endsWith('/index.md')) return path.slice(0, -'/index.md'.length);
  if (path.endsWith('/index')) return path.slice(0, -'/index'.length);
  return path;
}

function stripLeading(path: string, prefix: string): string {
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** Route namespace for the OpenAPI explorer. Underscore-prefixed so it can never collide with a
 *  markdown doc route (mirrors how `/dokai/_settings` is reserved). */
export const API_ROUTE_PREFIX = '/dokai/_api';

/** Build the in-app route for a spec given its path relative to the configured openapi dir,
 *  with the extension stripped. e.g. "billing/payments" -> "/dokai/_api/billing/payments". */
export function openapiRouteForRelpath(relpathUnderDir: string): string {
  return relpathUnderDir ? `${API_ROUTE_PREFIX}/${relpathUnderDir}` : API_ROUTE_PREFIX;
}
