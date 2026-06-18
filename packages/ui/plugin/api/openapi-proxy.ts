import type { IncomingHttpHeaders } from 'node:http';

/** Cloud-metadata IP — never a legitimate proxy target. */
const BLOCKED_HOSTS = new Set(['169.254.169.254']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
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
  if (BLOCKED_HOSTS.has(h)) return false;
  if (LOOPBACK.has(h)) return true;
  return allowed.has(h);
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
