import { describe, expect, it } from 'vitest';
import { resolveSpecContentType } from './openapi-raw.js';

describe('resolveSpecContentType', () => {
  it('maps yaml/yml to application/yaml', () => {
    expect(resolveSpecContentType('openapi/auth.yaml')).toBe('application/yaml; charset=utf-8');
    expect(resolveSpecContentType('openapi/auth.yml')).toBe('application/yaml; charset=utf-8');
  });
  it('maps json to application/json', () => {
    expect(resolveSpecContentType('openapi/auth.json')).toBe('application/json; charset=utf-8');
  });
  it('rejects other extensions', () => {
    expect(resolveSpecContentType('openapi/secret.env')).toBeNull();
    expect(resolveSpecContentType('openapi/auth')).toBeNull();
  });
});
