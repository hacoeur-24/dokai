import { describe, expect, it } from 'vitest';
import { openapiSettingsSchema } from './openapi.js';
import { projectSettingsSchema } from './project-settings.js';

describe('openapiSettingsSchema', () => {
  it('applies defaults when empty', () => {
    const parsed = openapiSettingsSchema.parse(undefined);
    expect(parsed).toEqual({ enabled: true, dir: 'openapi', allowedHosts: [], persistAuth: true });
  });

  it('honors overrides', () => {
    const parsed = openapiSettingsSchema.parse({ dir: 'apis', allowedHosts: ['api.example.com'] });
    expect(parsed.dir).toBe('apis');
    expect(parsed.allowedHosts).toEqual(['api.example.com']);
    expect(parsed.enabled).toBe(true);
  });
});

describe('projectSettingsSchema with openapi', () => {
  it('parses legacy settings without an openapi block and fills defaults', () => {
    const parsed = projectSettingsSchema.parse({ projectName: 'Legacy' });
    expect(parsed.openapi.dir).toBe('openapi');
    expect(parsed.openapi.enabled).toBe(true);
  });
});
