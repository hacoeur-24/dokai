import { describe, expect, it } from 'vitest';
import { defaultFrontmatter, frontmatterSchema } from './frontmatter.js';

describe('frontmatterSchema', () => {
  it('accepts a valid full frontmatter', () => {
    const input = {
      title: 'API',
      description: 'Backend API',
      tags: ['backend', 'rest'],
      version: '1.2.3',
      status: 'stable',
      owner: 'team-platform',
      createdAt: '2026-01-15T10:00:00Z',
      updatedAt: '2026-04-20T14:30:00Z',
    };
    const parsed = frontmatterSchema.parse(input);
    expect(parsed.title).toBe('API');
    expect(parsed.tags).toEqual(['backend', 'rest']);
    expect(parsed.status).toBe('stable');
  });

  it('fills defaults for tags and version', () => {
    const parsed = frontmatterSchema.parse({ title: 'X', description: 'Y' });
    expect(parsed.tags).toEqual([]);
    expect(parsed.version).toBe('0.1.0');
  });

  it('rejects non-semver versions', () => {
    expect(() =>
      frontmatterSchema.parse({ title: 'X', description: 'Y', version: 'v1' }),
    ).toThrow();
  });

  it('rejects empty title', () => {
    expect(() => frontmatterSchema.parse({ title: '', description: 'Y' })).toThrow();
  });

  it('rejects unknown status', () => {
    expect(() =>
      frontmatterSchema.parse({
        title: 'X',
        description: 'Y',
        status: 'whatever',
      }),
    ).toThrow();
  });
});

describe('defaultFrontmatter', () => {
  it('produces a valid frontmatter that round-trips through the schema', () => {
    const fm = defaultFrontmatter({ title: 'Hello' });
    expect(() => frontmatterSchema.parse(fm)).not.toThrow();
    expect(fm.status).toBe('draft');
    expect(fm.version).toBe('0.1.0');
  });
});
