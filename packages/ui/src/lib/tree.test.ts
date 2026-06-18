import { describe, expect, it } from 'vitest';
import type { SectionNode } from 'dokai-core';
import { flattenFolders } from './tree.js';

const node = (relativePath: string, sections: SectionNode[] = []): SectionNode => ({
  relativePath,
  absolutePath: '',
  metadata: null,
  sections,
  docs: [],
});

describe('flattenFolders', () => {
  it('flattens nested folders with depth, excluding root', () => {
    const tree = node('', [node('a', [node('a/b')]), node('c')]);
    expect(flattenFolders(tree)).toEqual([
      { path: 'a', depth: 0 },
      { path: 'a/b', depth: 1 },
      { path: 'c', depth: 0 },
    ]);
  });

  it('returns empty array for a root with no children', () => {
    const tree = node('');
    expect(flattenFolders(tree)).toEqual([]);
  });

  it('handles deeply nested folders', () => {
    const tree = node('', [node('a', [node('a/b', [node('a/b/c')])])]);
    expect(flattenFolders(tree)).toEqual([
      { path: 'a', depth: 0 },
      { path: 'a/b', depth: 1 },
      { path: 'a/b/c', depth: 2 },
    ]);
  });
});
