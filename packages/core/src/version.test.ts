import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { bumpDoc, bumpSection } from './version.js';

describe('bumpDoc', () => {
  it('increments the frontmatter version and refreshes updatedAt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-bump-'));
    const file = join(root, 'doc.md');
    await writeFile(file, `---\ntitle: T\ndescription: D\nversion: 1.2.3\n---\n\n# Body\n`, 'utf8');

    const before = Date.now();
    const result = await bumpDoc(file, 'minor');
    expect(result.before).toBe('1.2.3');
    expect(result.after).toBe('1.3.0');

    const updated = matter(await readFile(file, 'utf8'));
    expect(updated.data['version']).toBe('1.3.0');
    expect(typeof updated.data['updatedAt']).toBe('string');
    expect(new Date(updated.data['updatedAt'] as string).getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('bumpSection', () => {
  it('increments _section.json version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-section-'));
    const folder = join(root, 'arch');
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, '_section.json'),
      JSON.stringify({ title: 'Arch', version: '0.1.0' }, null, 2),
    );

    const result = await bumpSection(folder, 'major');
    expect(result.before).toBe('0.1.0');
    expect(result.after).toBe('1.0.0');

    const onDisk = JSON.parse(await readFile(join(folder, '_section.json'), 'utf8')) as {
      version: string;
    };
    expect(onDisk.version).toBe('1.0.0');
  });
});
