import { describe, expect, it } from 'vitest';
import { projectSettingsSchema } from './project-settings.js';

describe('projectSettingsSchema github/app URLs', () => {
  it('accepts valid urls', () => {
    const p = projectSettingsSchema.parse({ githubUrl: 'https://github.com/acme/repo', appUrl: 'https://app.acme.com' });
    expect(p.githubUrl).toBe('https://github.com/acme/repo');
    expect(p.appUrl).toBe('https://app.acme.com');
  });
  it('leaves them undefined when absent', () => {
    const p = projectSettingsSchema.parse({});
    expect(p.githubUrl).toBeUndefined();
    expect(p.appUrl).toBeUndefined();
  });
  it('rejects a non-url string', () => {
    expect(() => projectSettingsSchema.parse({ githubUrl: 'not a url' })).toThrow();
  });
});
