import { describe, expect, it } from 'vitest';
import type { OpenApiSpecMeta } from 'dokai-core';
import { buildScalarConfig, findSpecByRoute, rawSpecUrl, scalarThemeForMode } from './openapi.js';

const spec: OpenApiSpecMeta = {
  relativePath: 'openapi/billing/payments.yaml',
  route: '/dokai/_api/billing/payments',
  title: 'Billing',
  version: '1.0.0',
  description: '',
  hasSecurity: true,
  operationCount: 1,
  serverHosts: ['api.example.com'],
  operations: [],
  workspace: null,
};

describe('rawSpecUrl', () => {
  it('encodes the relative path', () => {
    expect(rawSpecUrl('openapi/billing/payments.yaml')).toBe(
      '/api/openapi/raw?path=openapi%2Fbilling%2Fpayments.yaml',
    );
  });
});

describe('buildScalarConfig', () => {
  it('uses the proxy when try-it-out is available', () => {
    const cfg = buildScalarConfig({ rawUrl: '/x', tryItOut: true, persistAuth: true, mode: 'dark' });
    expect(cfg['proxyUrl']).toBe('/api/openapi/proxy');
    expect(cfg['hideTestRequestButton']).toBeUndefined();
    expect(cfg['persistAuth']).toBe(true);
  });
  it('hides the Send button in read-only mode', () => {
    const cfg = buildScalarConfig({ rawUrl: '/x', tryItOut: false, persistAuth: false, mode: 'light' });
    expect(cfg['proxyUrl']).toBeUndefined();
    expect(cfg['hideTestRequestButton']).toBe(true);
  });
  it('strips Scalar chrome (sidebar, search, dev tools, dark-mode toggle, Ask AI)', () => {
    const cfg = buildScalarConfig({ rawUrl: '/x', tryItOut: true, persistAuth: true, mode: 'dark' });
    expect(cfg['showSidebar']).toBe(false);
    expect(cfg['hideSearch']).toBe(true);
    expect(cfg['showDeveloperTools']).toBe('never');
    expect(cfg['hideDarkModeToggle']).toBe(true);
    const sources = cfg['sources'] as Array<{ url: string; agent: { disabled: boolean } }>;
    expect(sources[0]?.url).toBe('/x');
    expect(sources[0]?.agent.disabled).toBe(true);
  });
  it('uses Purple in dark mode and Blue Planet in light mode (forcing Scalar light/dark)', () => {
    const dark = buildScalarConfig({ rawUrl: '/x', tryItOut: true, persistAuth: true, mode: 'dark' });
    expect(dark['theme']).toBe('purple');
    expect(dark['forceDarkModeState']).toBe('dark');
    const light = buildScalarConfig({ rawUrl: '/x', tryItOut: true, persistAuth: true, mode: 'light' });
    expect(light['theme']).toBe('bluePlanet');
    expect(light['forceDarkModeState']).toBe('light');
  });
});

describe('scalarThemeForMode', () => {
  it('maps dark -> purple and light -> bluePlanet', () => {
    expect(scalarThemeForMode('dark')).toEqual({ theme: 'purple', forceDarkModeState: 'dark' });
    expect(scalarThemeForMode('light')).toEqual({ theme: 'bluePlanet', forceDarkModeState: 'light' });
  });
});

describe('findSpecByRoute', () => {
  it('finds by exact route', () => {
    expect(findSpecByRoute([spec], '/dokai/_api/billing/payments')).toBe(spec);
    expect(findSpecByRoute([spec], '/dokai/_api/other')).toBeNull();
  });
});
