import type { OpenApiSpecMeta } from 'dokai-core';

/** Build the raw-spec URL served by the dev/preview server's /api/openapi/raw route. */
export function rawSpecUrl(relativePath: string): string {
  return `/api/openapi/raw?path=${encodeURIComponent(relativePath)}`;
}

export interface ScalarConfigInput {
  rawUrl: string;
  tryItOut: boolean;
  persistAuth: boolean;
}

/** Scalar configuration: proxy + try-it-out in dev; read-only (Send hidden) otherwise. */
export function buildScalarConfig(input: ScalarConfigInput): Record<string, unknown> {
  const config: Record<string, unknown> = {
    url: input.rawUrl,
    persistAuth: input.persistAuth,
    // Let DOKAI's CSS variables drive colors instead of a baked Scalar theme.
    theme: 'none',
  };
  if (input.tryItOut) {
    config['proxyUrl'] = '/api/openapi/proxy';
  } else {
    config['hideTestRequestButton'] = true;
  }
  return config;
}

export function findSpecByRoute(specs: OpenApiSpecMeta[], route: string): OpenApiSpecMeta | null {
  return specs.find((s) => s.route === route) ?? null;
}
