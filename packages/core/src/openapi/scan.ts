import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import { parse as parseYaml } from 'yaml';
import type {
  OpenApiOperationMeta,
  OpenApiScanError,
  OpenApiSpecMeta,
} from '../types.js';
import { openapiRouteForRelpath } from '../route.js';

export interface ScanOpenApiOptions {
  dokaiRoot: string;
  /** Path under DOKAI/ to scan. Defaults to "openapi". */
  dir?: string;
}

export interface OpenApiScanResult {
  specs: OpenApiSpecMeta[];
  errors: OpenApiScanError[];
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

type Json = Record<string, unknown>;
function asObject(value: unknown): Json | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function hostsFromServers(doc: Json): string[] {
  const hosts = new Set<string>();
  const servers = doc['servers'];
  if (Array.isArray(servers)) {
    for (const entry of servers) {
      const server = asObject(entry);
      const url = server?.['url'];
      if (typeof url === 'string') {
        try {
          hosts.add(new URL(url).hostname);
        } catch {
          // Relative or unparseable server URL — no external host to record.
        }
      }
    }
  } else if (typeof doc['host'] === 'string') {
    // Swagger 2.0
    try {
      hosts.add(new URL(`http://${doc['host'] as string}`).hostname);
    } catch {
      /* skip */
    }
  }
  return [...hosts];
}

function collectOperations(doc: Json): OpenApiOperationMeta[] {
  const out: OpenApiOperationMeta[] = [];
  const globalSecurity = Array.isArray(doc['security']) ? (doc['security'] as unknown[]) : null;
  const paths = asObject(doc['paths']);
  if (!paths) return out;
  for (const [path, pathItemRaw] of Object.entries(paths)) {
    const pathItem = asObject(pathItemRaw);
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const op = asObject(pathItem[method]);
      if (!op) continue;
      const opSecurity = op['security'];
      const secured = Array.isArray(opSecurity)
        ? opSecurity.length > 0 // op-level overrides global, including [] meaning public
        : !!globalSecurity && globalSecurity.length > 0;
      out.push({
        method: method.toUpperCase(),
        path,
        summary: typeof op['summary'] === 'string' ? op['summary'] : '',
        secured,
      });
    }
  }
  return out;
}

export async function scanOpenApiSpecs(options: ScanOpenApiOptions): Promise<OpenApiScanResult> {
  const dir = options.dir ?? 'openapi';
  const matches = await fg([`${dir}/**/*.{yaml,yml,json}`], {
    cwd: options.dokaiRoot,
    dot: false,
    onlyFiles: true,
    ignore: ['node_modules/**', '.dokai/**'],
  });

  const specs: OpenApiSpecMeta[] = [];
  const errors: OpenApiScanError[] = [];

  for (const relativePath of matches.sort()) {
    const absolute = join(options.dokaiRoot, relativePath);
    let doc: Json | null;
    try {
      doc = asObject(parseYaml(await readFile(absolute, 'utf8')));
    } catch (err: unknown) {
      errors.push({ relativePath, message: err instanceof Error ? err.message : String(err) });
      continue;
    }
    if (!doc || (!('openapi' in doc) && !('swagger' in doc))) {
      errors.push({ relativePath, message: 'Not an OpenAPI/Swagger document (no openapi/swagger key)' });
      continue;
    }

    const info = asObject(doc['info']) ?? {};
    const relpathUnderDir = relativePath
      .slice(dir.length + 1)
      .replace(/\.(ya?ml|json)$/i, '');
    const operations = collectOperations(doc);
    const filename = relativePath.split('/').pop() ?? relativePath;

    specs.push({
      relativePath,
      route: openapiRouteForRelpath(relpathUnderDir),
      title: typeof info['title'] === 'string' ? info['title'] : filename,
      version: typeof info['version'] === 'string' ? info['version'] : '',
      description: typeof info['description'] === 'string' ? info['description'] : '',
      hasSecurity: operations.some((o) => o.secured),
      operationCount: operations.length,
      serverHosts: hostsFromServers(doc),
      operations,
      workspace: null,
    });
  }

  return { specs, errors };
}
