import { describe, expect, it } from 'vitest';
import { anchorRoute, pathToRoute, routeToPath, API_ROUTE_PREFIX, openapiRouteForRelpath } from './route.js';

describe('pathToRoute', () => {
  it('maps the root index to /dokai', () => {
    expect(pathToRoute('index.md')).toBe('/dokai');
  });

  it('maps a top-level doc', () => {
    expect(pathToRoute('backend/api.md')).toBe('/dokai/backend/api');
  });

  it('strips index.md inside a folder', () => {
    expect(pathToRoute('backend/index.md')).toBe('/dokai/backend');
  });

  it('handles nested folders', () => {
    expect(pathToRoute('packages/web/components.md')).toBe('/dokai/packages/web/components');
  });

  it('round-trips back to the canonical path', () => {
    expect(routeToPath(pathToRoute('backend/api.md'))).toBe('backend/api.md');
    expect(routeToPath(pathToRoute('index.md'))).toBe('index.md');
  });
});

describe('routeToPath', () => {
  it('handles the bare root', () => {
    expect(routeToPath('/dokai')).toBe('index.md');
  });

  it('appends .md to non-root routes', () => {
    expect(routeToPath('/dokai/foo/bar')).toBe('foo/bar.md');
  });
});

describe('anchorRoute', () => {
  it('appends a heading slug', () => {
    expect(anchorRoute('/dokai/backend/api', 'authentication-flow')).toBe(
      '/dokai/backend/api#authentication-flow',
    );
  });

  it('returns the route unchanged when slug is empty', () => {
    expect(anchorRoute('/dokai/backend/api', '')).toBe('/dokai/backend/api');
  });
});

describe('openapiRouteForRelpath', () => {
  it('builds an _api route from a dir-relative path', () => {
    expect(openapiRouteForRelpath('billing/payments')).toBe('/dokai/_api/billing/payments');
    expect(openapiRouteForRelpath('auth')).toBe('/dokai/_api/auth');
  });
  it('returns the bare prefix for an empty relpath', () => {
    expect(openapiRouteForRelpath('')).toBe(API_ROUTE_PREFIX);
  });
});
