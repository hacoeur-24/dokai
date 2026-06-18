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
    // Single source. `agent.disabled` turns off Scalar's "Ask AI" upsell (otherwise on by
    // default on localhost). `agent` is a per-source option, not top-level — so we pass the
    // spec via `sources` rather than a top-level `url`.
    sources: [{ url: input.rawUrl, agent: { disabled: true } }],
    persistAuth: input.persistAuth,
    // Let DOKAI's CSS variables drive colors instead of a baked Scalar theme.
    theme: 'none',
    // Strip Scalar's own chrome so it embeds cleanly inside DOKAI's shell:
    showSidebar: false, // DOKAI's "APIs" sidebar group handles navigation
    hideSearch: true, // DOKAI's header search (Cmd+K) is the only search
    showDeveloperTools: 'never', // no "Deploy" / Scalar Pro CTAs
    hideDarkModeToggle: true, // DOKAI owns theming via data-theme + tokens
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
