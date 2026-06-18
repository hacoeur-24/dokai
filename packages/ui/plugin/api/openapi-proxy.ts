import type { IncomingHttpHeaders } from 'node:http';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/** True if the hostname is a cloud-metadata endpoint or IPv4 link-local address —
 *  never a legitimate proxy target, refused even if explicitly allowlisted. */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Known metadata hostnames and IPv6 metadata address (AWS IMDS over IPv6).
  if (h === 'metadata.google.internal' || h === 'metadata.goog' || h === 'fd00:ec2::254') {
    return true;
  }
  // Any IPv4 in the 169.254.0.0/16 link-local range (covers 169.254.169.254 — AWS/GCP/Azure metadata).
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const octets = m.slice(1).map((o) => Number(o));
    if (octets.every((o) => o >= 0 && o <= 255) && octets[0] === 169 && octets[1] === 254) {
      return true;
    }
  }
  return false;
}
/** Hop-by-hop / connection headers we must not forward. */
const DROP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'accept-encoding',
]);

/** Parse and validate the Scalar `scalar_url` target. Returns null when missing/invalid. */
export function parseTargetUrl(scalarUrl: string | null): URL | null {
  if (!scalarUrl) return null;
  try {
    const url = new URL(scalarUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function buildAllowedHosts(opts: { settingsHosts: string[]; specHosts: string[] }): Set<string> {
  const set = new Set<string>();
  for (const h of opts.settingsHosts) set.add(h.toLowerCase());
  for (const h of opts.specHosts) set.add(h.toLowerCase());
  return set;
}

export function isHostAllowed(host: string, allowed: ReadonlySet<string>): boolean {
  const h = host.toLowerCase();
  if (isBlockedHost(h)) return false;
  if (LOOPBACK.has(h)) return true;
  return allowed.has(h);
}

/** Resolve a redirect Location against the current URL and re-validate it against the allowlist.
 *  Returns the validated absolute target, or null if the Location is missing/invalid/disallowed. */
export function resolveRedirectTarget(
  location: string | null,
  currentUrl: string,
  allowed: ReadonlySet<string>,
): URL | null {
  if (!location) return null;
  let next: URL;
  try {
    next = new URL(location, currentUrl);
  } catch {
    return null;
  }
  if (next.protocol !== 'http:' && next.protocol !== 'https:') return null;
  if (!isHostAllowed(next.hostname, allowed)) return null;
  return next;
}

export function filterForwardHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (DROP_HEADERS.has(key.toLowerCase())) continue;
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(', ');
  }
  return out;
}

/** Build a clear, actionable message when the upstream API server can't be reached. The native
 *  fetch throws an opaque `TypeError: fetch failed` on connection errors; the useful detail
 *  (ECONNREFUSED, ENOTFOUND, ETIMEDOUT, …) lives on `err.cause.code`. */
export function describeUpstreamError(target: URL, err: unknown): string {
  let code: string | undefined;
  if (err instanceof Error && err.cause && typeof err.cause === 'object') {
    const c = err.cause as { code?: unknown };
    if (typeof c.code === 'string') code = c.code;
  }
  const codePart = code ? ` (${code})` : '';
  return (
    `Could not reach the API server at ${target.origin}${codePart}. ` +
    `Make sure the server is running and reachable from this machine, and that the spec's ` +
    `"servers" URL is correct.`
  );
}

/** Read a request body into a Buffer, throwing if it exceeds maxBytes. */
export async function readRawBody(req: AsyncIterable<Buffer>, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
