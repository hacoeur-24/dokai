import type { OpenApiSpecMeta } from 'dokai-core';

/** Build the raw-spec URL served by the dev/preview server's /api/openapi/raw route. */
export function rawSpecUrl(relativePath: string): string {
  return `/api/openapi/raw?path=${encodeURIComponent(relativePath)}`;
}

export interface ScalarConfigInput {
  rawUrl: string;
  tryItOut: boolean;
  persistAuth: boolean;
  /** DOKAI's resolved theme; drives Scalar's named theme + forced light/dark state. */
  mode: 'light' | 'dark';
}

/** Map DOKAI's resolved theme to Scalar's named theme + forced light/dark state:
 *  Blue Planet in light mode, Purple in dark mode. `forceDarkModeState` locks Scalar's
 *  light/dark to DOKAI's (its own toggle is hidden via `hideDarkModeToggle`). */
export function scalarThemeForMode(mode: 'light' | 'dark'): {
  theme: 'purple' | 'bluePlanet';
  forceDarkModeState: 'light' | 'dark';
} {
  return { theme: mode === 'dark' ? 'purple' : 'bluePlanet', forceDarkModeState: mode };
}

/** Scalar configuration: proxy + try-it-out in dev; read-only (Send hidden) otherwise. */
export function buildScalarConfig(input: ScalarConfigInput): Record<string, unknown> {
  const config: Record<string, unknown> = {
    // Single source. `agent.disabled` turns off Scalar's "Ask AI" upsell (otherwise on by
    // default on localhost). `agent` is a per-source option, not top-level — so we pass the
    // spec via `sources` rather than a top-level `url`.
    sources: [{ url: input.rawUrl, agent: { disabled: true } }],
    persistAuth: input.persistAuth,
    // Scalar's named theme + forced light/dark, following DOKAI's resolved theme.
    ...scalarThemeForMode(input.mode),
    // Strip Scalar's own chrome so it embeds cleanly inside DOKAI's shell:
    showSidebar: false, // DOKAI's "APIs" sidebar group handles navigation
    hideSearch: true, // DOKAI's header search (Cmd+K) is the only search
    showDeveloperTools: 'never', // no "Deploy" / Scalar Pro CTAs
    hideDarkModeToggle: true, // DOKAI owns theming via data-theme + tokens
    hideClientButton: true, // no "Open API Client" launcher (links out to Scalar)
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
